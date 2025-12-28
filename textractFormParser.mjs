// Lambda function for Textract form parsing with multi-page support

import {
  TextractClient,
  StartDocumentAnalysisCommand,
  GetDocumentAnalysisCommand
} from "@aws-sdk/client-textract";

const textract = new TextractClient({ region: process.env.AWS_REGION });

export const handler = async (event) => {
  console.log("Lambda triggered with event:", event);

  const bucket = event.bucket;
  const key = event.key;

  if (!bucket || !key) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Bucket and key are required" }),
    };
  }

  try {
    // 1. Start Textract job (async for multi-page support)
    const startCommand = new StartDocumentAnalysisCommand({
      DocumentLocation: { S3Object: { Bucket: bucket, Name: key } },
      FeatureTypes: ["FORMS"],
    });

    const startResponse = await textract.send(startCommand);
    const jobId = startResponse.JobId;
    console.log("Started Textract job:", jobId);

    // 2. Poll until job completes
    let status = "IN_PROGRESS";

    while (status === "IN_PROGRESS") {
      await new Promise((r) => setTimeout(r, 5000)); // wait 5s
      const getResponse = await textract.send(
        new GetDocumentAnalysisCommand({ JobId: jobId })
      );
      status = getResponse.JobStatus;
      console.log("Job status:", status);
      if (status === "FAILED") {
        throw new Error("Textract job failed");
      }
    }

    // 3. Collect blocks from up to 2 pages using pagination
    console.log("Collecting blocks from pages...");
    let allBlocks = [];
    let nextToken = null;
    let pageCount = 0;
    const MAX_PAGES = 2; // Limit to 2 pages

    do {
      pageCount++;
      const getResponse = await textract.send(
        new GetDocumentAnalysisCommand({
          JobId: jobId,
          NextToken: nextToken
        })
      );

      if (getResponse.Blocks) {
        allBlocks = allBlocks.concat(getResponse.Blocks);
        console.log(`Page ${pageCount}: Collected ${getResponse.Blocks.length} blocks`);
      }

      nextToken = getResponse.NextToken;
    } while (nextToken && pageCount < MAX_PAGES);

    console.log(`Total blocks collected from ${pageCount} page(s): ${allBlocks.length}`);

    // 4. Parse into key-value pairs
    const blockMap = {};
    const keyMap = {};
    const valueMap = {};

    allBlocks.forEach((block) => {
      blockMap[block.Id] = block;
      if (block.BlockType === "KEY_VALUE_SET") {
        if (block.EntityTypes && block.EntityTypes.includes("KEY")) {
          keyMap[block.Id] = block;
        } else {
          valueMap[block.Id] = block;
        }
      }
    });

    const getText = (block, blockMap) => {
      let text = "";
      if (block.Relationships) {
        for (const rel of block.Relationships) {
          if (rel.Type === "CHILD") {
            for (const id of rel.Ids) {
              const word = blockMap[id];
              if (word.BlockType === "WORD") {
                text += word.Text + " ";
              }
              if (
                word.BlockType === "SELECTION_ELEMENT" &&
                word.SelectionStatus === "SELECTED"
              ) {
                text += "✔ ";
              }
            }
          }
        }
      }
      return text.trim();
    };

    const keyValues = {};
    for (const keyId in keyMap) {
      const keyBlock = keyMap[keyId];
      let valueBlock;
      if (keyBlock.Relationships) {
        for (const rel of keyBlock.Relationships) {
          if (rel.Type === "VALUE") {
            for (const vId of rel.Ids) {
              valueBlock = valueMap[vId];
            }
          }
        }
      }
      const keyText = getText(keyBlock, blockMap);
      const valueText = valueBlock ? getText(valueBlock, blockMap) : "";
      if (keyText) {
        keyValues[keyText] = valueText;
      }
    }

    // 5. Also collect all text lines for fallback extraction
    const allText = allBlocks
      .filter(b => b.BlockType === "LINE")
      .map(b => b.Text);

    // 6. Return as JSON with metadata
    console.log(`Extracted ${Object.keys(keyValues).length} key-value pairs from ${pageCount} page(s)`);
    return {
      statusCode: 200,
      body: JSON.stringify({
        extractedData: keyValues,
        allText: allText,
        metadata: {
          totalBlocks: allBlocks.length,
          totalPages: pageCount,
          totalKeyValuePairs: Object.keys(keyValues).length
        }
      }),
    };
  } catch (err) {
    console.error("Textract error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
