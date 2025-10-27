import dotenv from "dotenv";
dotenv.config();
import express from "express";
import multer from "multer";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { fileURLToPath } from "url";
import path from "path";
import OpenAI from "openai";
import cors from "cors";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Multer memory storage for file upload
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only images allowed"), false);
  },
});

// S3 client
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});
const lambda = new LambdaClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});
// ---------- ROUTES ----------

app.use(cors());
app.post("/upload-license", upload.single("file"), async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: "No file uploaded" });

    const fileKey = `${Date.now()}_${file.originalname}`;

    await s3.send(
      new PutObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET_NAME,
        Key: fileKey,
        Body: file.buffer,
        ContentType: file.mimetype,
      })
    );
    const lambdaRes = await lambda.send(
      new InvokeCommand({
        FunctionName: process.env.AWS_LAMBDA_FUNCTION_NAME,
        Payload: Buffer.from(
          JSON.stringify({
            bucket: process.env.AWS_S3_BUCKET_NAME,
            key: fileKey,
          })
        ),
      })
    );

    const result = JSON.parse(Buffer.from(lambdaRes.Payload).toString());
    const textractData = JSON.parse(result.body);

    const schema = {
      Province: "",
      Country: "",
      Document_Type: "Driver's Licence",
      Document_Type_French: "Permis de conduire",
      Abbreviation: "",
      "Name/Nom": {
        First_Name: "",
        Last_Name: "",
        Middle_Name: "",
      },
      Address: "",
      Number: "",
      ISS: "",
      EXP: "",
      DD: "",
      HGT: "",
      SEX: "",
      CLASS: "",
      REST: "",
      DOB: "",
    };

    const gptRes = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a data parser that maps OCR (Textract) results into a clean structured JSON based on the provided schema.",
        },
        {
          role: "user",
          content: `Schema: ${JSON.stringify(
            schema,
            null,
            2
          )}\n\nExtracted Data:\n${JSON.stringify(
            textractData,
            null,
            2
          )}\n\nReturn only JSON that matches the schema.`,
        },
      ],
      temperature: 0,
      response_format: { type: "json_object" }, // ensures JSON output
    });

    const refinedData = JSON.parse(gptRes.choices[0].message.content);

    // Send final response
    res.json({
      bucket: process.env.AWS_S3_BUCKET_NAME,
      key: fileKey,
      textractData,
      refinedData,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
  // Generate presigned GET URL (valid for 15 minutes)
  //     const getCmd = new GetObjectCommand({
  //       Bucket: process.env.AWS_S3_BUCKET_NAME,
  //       Key: fileKey,
  //     });
  //     const signedUrl = await getSignedUrl(s3, getCmd, { expiresIn: 900 });

  //     res.json({
  //       message: 'File uploaded successfully!',
  //       key: fileKey,
  //       url: signedUrl,
  //     });
  //   } catch (err) {
  //     console.error('Upload error:', err);
  //     res.status(500).json({ error: err.message });
  //   }
});
app.post("/upload-passport", upload.single("file"), async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: "No file uploaded" });

    const fileKey = `${Date.now()}_${file.originalname}`;

    // Upload to S3 (private by default)
    await s3.send(
      new PutObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET_NAME,
        Key: fileKey,
        Body: file.buffer,
        ContentType: file.mimetype,
      })
    );
    const lambdaRes = await lambda.send(
      new InvokeCommand({
        FunctionName: process.env.AWS_LAMBDA_FUNCTION_NAME,
        Payload: Buffer.from(
          JSON.stringify({
            bucket: process.env.AWS_S3_BUCKET_NAME,
            key: fileKey,
          })
        ),
      })
    );

    const result = JSON.parse(Buffer.from(lambdaRes.Payload).toString());
    const textractData = JSON.parse(result.body);

    const schema = {
      Province: "",
      Country: "",
      Document_Type: "Driver's Licence",
      Document_Type_French: "Permis de conduire",
      Abbreviation: "",
      "Name/Nom": {
        First_Name: "",
        Last_Name: "",
        Middle_Name: "",
      },
      Address: "",
      Number: "",
      ISS: "",
      EXP: "",
      DD: "",
      HGT: "",
      SEX: "",
      CLASS: "",
      REST: "",
      DOB: "",
    };

    const gptRes = await openai.chat.completions.create({
      model: "gpt-4o-mini", 
      messages: [
        {
          role: "system",
          content:
            "You are a data parser that maps OCR (Textract) results into a clean structured JSON based on the provided schema.",
        },
        {
          role: "user",
          content: `Schema: ${JSON.stringify(
            schema,
            null,
            2
          )}\n\nExtracted Data:\n${JSON.stringify(
            textractData,
            null,
            2
          )}\n\nReturn only JSON that matches the schema.`,
        },
      ],
      temperature: 0,
      response_format: { type: "json_object" }, 
    });

    const refinedData = JSON.parse(gptRes.choices[0].message.content);

    
    res.json({
      bucket: process.env.AWS_S3_BUCKET_NAME,
      key: fileKey,
      textractData,
      refinedData,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

//Presign PUT URL for direct browser upload
app.get("/presign-put", async (req, res) => {
  try {
    const { filename, contentType } = req.query;
    if (!filename || !contentType)
      return res
        .status(400)
        .json({ error: "filename and contentType required" });

    const fileKey = `${Date.now()}_${path.basename(filename)}`;

    const putCmd = new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: fileKey,
      ContentType: contentType,
    });

    const signedPutUrl = await getSignedUrl(s3, putCmd, { expiresIn: 300 }); // 5 min

    res.json({ uploadUrl: signedPutUrl, key: fileKey });
  } catch (err) {
    console.error("Presign PUT error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Generate presigned GET URL for any file key
app.get("/get-presigned", async (req, res) => {
  try {
    const { key } = req.query;
    if (!key) return res.status(400).json({ error: "key required" });

    const getCmd = new GetObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: key,
    });
    const signedUrl = await getSignedUrl(s3, getCmd, { expiresIn: 900 });

    res.json({ url: signedUrl });
  } catch (err) {
    console.error("Get presigned error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ---------- SERVER ----------

const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`🚀 Server running on http://localhost:${PORT}`)
);
