import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { buildDynamicPrompt, buildUnifiedClassificationAndExtractionPrompt, estimateTokens, validateExtractedData, formatExtractedData } from './promptBuilder.js';

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

    const startTime = Date.now();

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

    const requestDuration = Date.now() - startTime;

    const parsedData = JSON.parse(gptResponse.choices[0].message.content);
    console.log('AI Parsed Data:', parsedData);

    // Return parsed data with usage information
    return {
      parsedData,
      usage: {
        promptTokens: gptResponse.usage?.prompt_tokens || 0,
        completionTokens: gptResponse.usage?.completion_tokens || 0,
        totalTokens: gptResponse.usage?.total_tokens || 0,
        model: gptResponse.model || 'gpt-4o-mini',
        requestDuration
      }
    };
  } catch (error) {
    console.error('AI parsing error:', error);
    throw new Error(`Failed to parse document data: ${error.message}`);
  }
};

/**
 * Unified parsing: Classify document type AND extract fields in ONE AI call
 * This is the MOST EFFICIENT version - use when document type is unknown
 * @param {Object} textractData - Raw Textract output
 * @param {Object} allDocumentTypeConfigs - All available document type configurations
 * @returns {Promise<Object>} Structured document data with detected type and validation
 */
export const parseWithAIUnified = async (textractData, allDocumentTypeConfigs) => {
  try {
    // Build unified prompt that can classify AND extract
    const { systemPrompt, userPromptBuilder, getConfigForType, availableTypes } =
      buildUnifiedClassificationAndExtractionPrompt(allDocumentTypeConfigs);

    const userPrompt = userPromptBuilder(textractData);

    // Estimate token usage
    const estimatedInputTokens = estimateTokens(systemPrompt + userPrompt);
    console.log(`📊 Estimated input tokens for unified classification+extraction: ${estimatedInputTokens}`);

    // Import OpenAI dynamically
    const { default: OpenAI } = await import('openai');

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const startTime = Date.now();

    // Call OpenAI with unified prompt
    const gptResponse = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: userPrompt,
        },
      ],
      temperature: 0,
      response_format: { type: 'json_object' },
    });

    const requestDuration = Date.now() - startTime;

    const parsedData = JSON.parse(gptResponse.choices[0].message.content);
    const detectedType = parsedData.documentType;

    console.log('✅ AI Unified Classification+Extraction complete:', { detectedType, confidence: parsedData.confidence });

    // Get the configuration for the detected type
    const documentTypeConfig = getConfigForType(detectedType);

    if (!documentTypeConfig) {
      throw new Error(`Detected document type "${detectedType}" is not in the available configurations`);
    }

    // Validate extracted data if in field extraction mode
    let validation = { valid: true, errors: [], warnings: [] };
    if (documentTypeConfig.extractionMode === 'fields' && documentTypeConfig.fields && documentTypeConfig.fields.length > 0) {
      validation = validateExtractedData(parsedData, documentTypeConfig.fields);

      if (!validation.valid) {
        console.warn('⚠️  Validation errors in extracted data:', validation.errors);
      }

      if (validation.warnings.length > 0) {
        console.warn('⚠️  Validation warnings:', validation.warnings);
      }
    }

    // Format extracted data for database storage
    let formattedData = parsedData;
    if (documentTypeConfig.extractionMode === 'fields' && documentTypeConfig.fields && documentTypeConfig.fields.length > 0) {
      formattedData = formatExtractedData(parsedData, documentTypeConfig.fields);
    }

    // Ensure documentType is always present
    formattedData.documentType = detectedType;

    // Return parsed data with usage information and validation results
    return {
      parsedData: formattedData,
      rawParsedData: parsedData,
      detectedType,
      documentTypeConfig,
      validation,
      usage: {
        promptTokens: gptResponse.usage?.prompt_tokens || 0,
        completionTokens: gptResponse.usage?.completion_tokens || 0,
        totalTokens: gptResponse.usage?.total_tokens || 0,
        estimatedInputTokens,
        model: gptResponse.model || 'gpt-4o-mini',
        requestDuration,
        extractionMode: documentTypeConfig.extractionMode,
        fieldsExtracted: documentTypeConfig.extractionMode === 'fields' && documentTypeConfig.fields
          ? documentTypeConfig.fields.filter(f => f.aiExtractable).length
          : 0
      },
      metadata: {
        documentType: detectedType,
        extractionMode: documentTypeConfig.extractionMode,
        aiEnabled: documentTypeConfig.aiEnabled,
        timestamp: new Date().toISOString(),
        confidence: parsedData.confidence || null
      }
    };
  } catch (error) {
    console.error('❌ AI unified parsing error:', error);
    throw new Error(`Failed to parse document data: ${error.message}`);
  }
};

/**
 * Parse Textract data using OpenAI with dynamic prompting based on document type configuration
 * This is the NEW enhanced version that uses company-specific field configurations
 * @param {Object} textractData - Raw Textract output
 * @param {Object} documentTypeConfig - Document type configuration object
 * @param {string} documentTypeName - Name of the document type
 * @returns {Promise<Object>} Structured document data with validation
 */
export const parseWithAIDynamic = async (textractData, documentTypeConfig, documentTypeName) => {
  try {
    const { aiEnabled, extractionMode, fields } = documentTypeConfig;

    // Check if AI extraction is enabled for this document type
    if (!aiEnabled) {
      console.log(`AI extraction is disabled for document type: ${documentTypeName}`);
      return {
        parsedData: {
          documentType: documentTypeName,
          aiEnabled: false,
          message: 'AI extraction is disabled for this document type'
        },
        usage: {
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          model: 'none',
          requestDuration: 0
        }
      };
    }

    // Build dynamic prompt based on configuration
    const { systemPrompt, userPromptBuilder } = buildDynamicPrompt(documentTypeConfig, documentTypeName);
    const userPrompt = userPromptBuilder(textractData);

    // Estimate token usage before making the call
    const estimatedInputTokens = estimateTokens(systemPrompt + userPrompt);
    console.log(`📊 Estimated input tokens for ${documentTypeName}: ${estimatedInputTokens}`);

    // Import OpenAI dynamically
    const { default: OpenAI } = await import('openai');

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const startTime = Date.now();

    // Call OpenAI with dynamic prompts
    const gptResponse = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: userPrompt,
        },
      ],
      temperature: 0,
      response_format: { type: 'json_object' },
    });

    const requestDuration = Date.now() - startTime;

    const parsedData = JSON.parse(gptResponse.choices[0].message.content);
    console.log('✅ AI Parsed Data (Dynamic):', parsedData);

    // Validate extracted data if in field extraction mode
    let validation = { valid: true, errors: [], warnings: [] };
    if (extractionMode === 'fields' && fields.length > 0) {
      validation = validateExtractedData(parsedData, fields);

      if (!validation.valid) {
        console.warn('⚠️  Validation errors in extracted data:', validation.errors);
      }

      if (validation.warnings.length > 0) {
        console.warn('⚠️  Validation warnings:', validation.warnings);
      }
    }

    // Format extracted data for database storage
    let formattedData = parsedData;
    if (extractionMode === 'fields' && fields.length > 0) {
      formattedData = formatExtractedData(parsedData, fields);
    }

    // Return parsed data with usage information and validation results
    return {
      parsedData: formattedData,
      rawParsedData: parsedData, // Keep original for debugging
      validation,
      usage: {
        promptTokens: gptResponse.usage?.prompt_tokens || 0,
        completionTokens: gptResponse.usage?.completion_tokens || 0,
        totalTokens: gptResponse.usage?.total_tokens || 0,
        estimatedInputTokens,
        model: gptResponse.model || 'gpt-4o-mini',
        requestDuration,
        extractionMode,
        fieldsExtracted: extractionMode === 'fields' ? fields.filter(f => f.aiExtractable).length : 0
      },
      metadata: {
        documentType: documentTypeName,
        extractionMode,
        aiEnabled,
        timestamp: new Date().toISOString()
      }
    };
  } catch (error) {
    console.error('❌ AI dynamic parsing error:', error);
    throw new Error(`Failed to parse document data: ${error.message}`);
  }
};
