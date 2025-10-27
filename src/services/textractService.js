import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';

// Initialize Lambda client
const lambdaClient = new LambdaClient({
  region: process.env.AWS_REGION,
  endpoint: `https://lambda.${process.env.AWS_REGION}.amazonaws.com`,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

/**
 * Invoke AWS Textract Lambda to extract document data
 * @param {string} s3Key - S3 object key
 * @returns {Promise<Object>} Extracted text data from Textract
 */
export const extractDocumentData = async (s3Key) => {
  try {
    const lambdaResponse = await lambdaClient.send(
      new InvokeCommand({
        FunctionName: process.env.AWS_LAMBDA_FUNCTION_NAME,
        Payload: Buffer.from(
          JSON.stringify({
            bucket: process.env.AWS_S3_BUCKET_NAME,
            key: s3Key,
          })
        ),
      })
    );

    const result = JSON.parse(Buffer.from(lambdaResponse.Payload).toString());
    const textractData = JSON.parse(result.body);

    return textractData;
  } catch (error) {
    console.error('Textract extraction error:', error);
    throw new Error(`Failed to extract document data: ${error.message}`);
  }
};

/**
 * Parse Textract data using OpenAI to structure it
 * This uses GPT to map raw Textract OCR into structured document fields
 * @param {Object} textractData - Raw Textract output
 * @param {string} documentType - Type of document (Driver's License, Passport, etc.)
 * @returns {Promise<Object>} Structured document data
 */
export const parseWithAI = async (textractData, documentType = 'Driver\'s License') => {
  try {
    // Import OpenAI dynamically to avoid issues if not installed
    const { default: OpenAI } = await import('openai');

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Define schema based on document type
    const schema = {
      type: '',
      documentNumber: '',
      issuedDate: '', // Frontend uses issuedDate
      expiryDate: '',
      firstName: '',
      lastName: '',
      dateOfBirth: '',
      address: '',
      province: '',
      country: '',
      class: '',
      restrictions: '',
      sex: '',
      height: '',
    };

    const gptResponse = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a data parser that extracts information from ${documentType} OCR data.
          Extract the following fields and return them in JSON format.
          Use standard date format YYYY-MM-DD for dates.
          For the 'type' field, identify the document type (e.g., "Driver's License", "Passport", "ID Card", "Commercial License", etc.).
          If a field is not found, use an empty string.`,
        },
        {
          role: 'user',
          content: `Schema: ${JSON.stringify(schema, null, 2)}\n\nExtracted OCR Data:\n${JSON.stringify(
            textractData,
            null,
            2
          )}\n\nReturn only JSON that matches the schema.`,
        },
      ],
      temperature: 0,
      response_format: { type: 'json_object' },
    });

    const parsedData = JSON.parse(gptResponse.choices[0].message.content);
    console.log('AI Parsed Data:', parsedData);
    return parsedData;
  } catch (error) {
    console.error('AI parsing error:', error);
    throw new Error(`Failed to parse document data: ${error.message}`);
  }
};
