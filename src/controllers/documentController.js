import prisma from '../../prisma/client.js';
import { z } from 'zod';
import {
  generatePresignedUploadUrl,
  generatePresignedDownloadUrl,
  generateDocumentKey,
  deleteFile,
} from '../services/s3Service.js';
import { extractDocumentData, parseWithAI, parseWithAIDynamic, parseWithAIUnified } from '../services/textractService.js';
import { deductCredits, checkLimit } from '../services/billingService.js';
import auditService from '../services/auditService.js';
import { mergeWithDefaults } from '../utils/documentTypeDefaults.js';
import { calculateDocumentStatus } from '../utils/documentStatusUtils.js';

/**
 * Generate presigned URLs for multiple file uploads
 * POST /api/documents/presigned-urls/:driverId
 */
export const generatePresignedUrls = async (req, res) => {
  try {
    const userId = req.auth?.userId;
    const { driverId } = req.params;
    const { files } = req.body; // Array of { filename, contentType }

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized - No user ID found' });
    }

    // Validate files array
    if (!files || !Array.isArray(files) || files.length === 0) {
      return res.status(400).json({
        error: 'Files array is required',
        message: 'Provide an array of files with filename and contentType',
      });
    }

    // Get user and verify they have access to this driver
    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
    });

    if (!user || !user.companyId) {
      return res.status(404).json({ error: 'User or company not found' });
    }

    // Verify driver belongs to this company
    const driver = await prisma.driver.findFirst({
      where: {
        id: driverId,
        companyId: user.companyId,
      },
    });

    if (!driver) {
      return res.status(404).json({ error: 'Driver not found' });
    }

    // Generate presigned URLs for each file
    const presignedUrls = await Promise.all(
      files.map(async (file) => {
        const { filename, contentType } = file;

        // Generate unique S3 key
        const key = generateDocumentKey(
          user.companyId,
          driverId,
          filename
        );

        // Generate presigned upload URL (valid for 5 minutes)
        const uploadUrl = await generatePresignedUploadUrl(key, contentType, 300);

        console.log(`Generated presigned URL for ${filename}:`, {
          key,
          contentType,
          urlLength: uploadUrl.length,
          bucket: process.env.AWS_S3_BUCKET_NAME,
          region: process.env.AWS_REGION,
        });

        return {
          filename,
          key,
          uploadUrl,
        };
      })
    );

    return res.status(200).json({
      success: true,
      data: presignedUrls,
    });
  } catch (error) {
    console.error('Error generating presigned URLs:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

/**
 * Create document record after successful upload to S3
 * POST /api/documents/:driverId
 */
export const createDocument = async (req, res) => {
  try {
    const userId = req.auth?.userId;
    const { driverId } = req.params;
    const { key, filename, contentType, size } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized - No user ID found' });
    }

    // Validate required fields
    if (!key || !filename) {
      return res.status(400).json({
        error: 'Key and filename are required',
      });
    }

    // Get user and verify access
    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
    });

    if (!user || !user.companyId) {
      return res.status(404).json({ error: 'User or company not found' });
    }

    // Verify driver
    const driver = await prisma.driver.findFirst({
      where: {
        id: driverId,
        companyId: user.companyId,
      },
    });

    if (!driver) {
      return res.status(404).json({ error: 'Driver not found' });
    }

    // Generate a permanent download URL (we'll regenerate when needed)
    const s3Url = `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;

    // Create document record with PENDING status (needs manual entry or AI scan)
    const document = await prisma.document.create({
      data: {
        driverId,
        type: 'Pending Classification', // Will be updated after manual entry or AI scan
        status: 'PENDING',
        s3Url,
        s3Key: key,
        s3UploadedAt: new Date(),
        fileName: filename,
        fileSize: size || null,
        mimeType: contentType || null,
      },
    });

    // Log document upload
    await auditService.logDocumentOperation({
      userId: user.id,
      userEmail: user.email,
      userName: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
      companyId: user.companyId,
      action: "DOCUMENT_UPLOADED",
      documentId: document.id,
      documentType: document.type,
      driverId: driver.id,
      driverName: driver.name,
      ipAddress: req.ip || req.headers["x-forwarded-for"] || req.connection?.remoteAddress,
      userAgent: req.headers["user-agent"],
      metadata: {
        fileName: filename,
        fileSize: size,
        mimeType: contentType,
      },
    });

    return res.status(201).json({
      success: true,
      message: 'Document uploaded successfully',
      data: document,
    });
  } catch (error) {
    console.error('Error creating document:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

/**
 * Update document details (after manual entry or AI scan)
 * PUT /api/documents/:documentId
 */
export const updateDocumentDetails = async (req, res) => {
  try {
    const userId = req.auth?.userId;
    const { documentId } = req.params;
    const { type, documentNumber, issuedDate, expiryDate, notes } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized - No user ID found' });
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
    });

    if (!user || !user.companyId) {
      return res.status(404).json({ error: 'User or company not found' });
    }

    // Get document and verify ownership
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: { driver: true },
    });

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    if (document.driver.companyId !== user.companyId) {
      return res.status(403).json({ error: 'Unauthorized access to document' });
    }

    // Calculate status based on expiry date
    let status = 'ACTIVE';
    if (expiryDate) {
      const expiry = new Date(expiryDate);
      const now = new Date();
      const daysUntilExpiry = Math.floor((expiry - now) / (1000 * 60 * 60 * 24));

      if (daysUntilExpiry < 0) {
        status = 'EXPIRED';
      } else if (daysUntilExpiry <= 30) {
        status = 'EXPIRING_SOON';
      }
    }

    // Get company's reminder settings to inform the user
    const companyData = await prisma.company.findUnique({
      where: { id: user.companyId },
      select: { reminderDays: true },
    });

    // Update document
    const updatedDocument = await prisma.document.update({
      where: { id: documentId },
      data: {
        type: type || document.type,
        documentNumber: documentNumber || document.documentNumber,
        issueDate: issuedDate ? new Date(issuedDate) : document.issueDate,
        expiryDate: expiryDate ? new Date(expiryDate) : document.expiryDate,
        notes: notes || document.notes,
        status,
        uploadedAt: new Date(), // Mark as fully uploaded
      },
    });

    // Log reminder eligibility
    if (expiryDate && companyData.reminderDays && companyData.reminderDays.length > 0) {
      console.log(`✅ Document ${documentId} is eligible for automatic reminders`);
      console.log(`   Expiry Date: ${expiryDate}`);
      console.log(`   Status: ${status}`);
      console.log(`   Company Reminder Settings: ${companyData.reminderDays.join(', ')}`);
      console.log(`   Reminders will be sent automatically by cron job`);
    }

    return res.status(200).json({
      success: true,
      message: 'Document updated successfully',
      data: updatedDocument,
      reminderInfo: expiryDate && companyData.reminderDays?.length > 0 ? {
        enabled: true,
        expiryDate: expiryDate,
        status: status,
        reminderDays: companyData.reminderDays,
        message: `Automatic reminders configured for ${companyData.reminderDays.join(', ')} before expiry`
      } : {
        enabled: false,
        message: expiryDate ? 'No reminder settings configured for your company' : 'No expiry date provided'
      }
    });
  } catch (error) {
    console.error('Error updating document:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

/**
 * Get all documents for a driver
 * GET /api/documents/driver/:driverId
 */
export const getDriverDocuments = async (req, res) => {
  try {
    const userId = req.auth?.userId;
    const { driverId } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized - No user ID found' });
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
    });

    if (!user || !user.companyId) {
      return res.status(404).json({ error: 'User or company not found' });
    }

    // Verify driver
    const driver = await prisma.driver.findFirst({
      where: {
        id: driverId,
        companyId: user.companyId,
      },
    });

    if (!driver) {
      return res.status(404).json({ error: 'Driver not found' });
    }

    // Get documents
    const documents = await prisma.document.findMany({
      where: { driverId },
      orderBy: { uploadedAt: 'desc' },
    });

    return res.status(200).json({
      success: true,
      data: documents,
    });
  } catch (error) {
    console.error('Error fetching documents:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

/**
 * Delete a document
 * DELETE /api/documents/:documentId
 */
export const deleteDocument = async (req, res) => {
  try {
    const userId = req.auth?.userId;
    const { documentId } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized - No user ID found' });
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
    });

    if (!user || !user.companyId) {
      return res.status(404).json({ error: 'User or company not found' });
    }

    // Get document
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: { driver: true },
    });

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    if (document.driver.companyId !== user.companyId) {
      return res.status(403).json({ error: 'Unauthorized access to document' });
    }

    // Delete from S3 if s3Key exists
    if (document.s3Key) {
      try {
        await deleteFile(document.s3Key);
      } catch (s3Error) {
        console.error('Error deleting from S3:', s3Error);
        // Continue with database deletion even if S3 deletion fails
      }
    }

    // Delete from database
    await prisma.document.delete({
      where: { id: documentId },
    });

    // Log document deletion
    await auditService.logDocumentOperation({
      userId: user.id,
      userEmail: user.email,
      userName: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
      companyId: user.companyId,
      action: "DOCUMENT_DELETED",
      documentId: document.id,
      documentType: document.type,
      driverId: document.driver.id,
      driverName: document.driver.name,
      ipAddress: req.ip || req.headers["x-forwarded-for"] || req.connection?.remoteAddress,
      userAgent: req.headers["user-agent"],
      metadata: {
        fileName: document.fileName,
        fileSize: document.fileSize,
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Document deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting document:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

/**
 * Generate presigned download URL for a document
 * GET /api/documents/:documentId/download-url
 */
export const getDocumentDownloadUrl = async (req, res) => {
  try {
    const userId = req.auth?.userId;
    const { documentId } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized - No user ID found' });
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
    });

    if (!user || !user.companyId) {
      return res.status(404).json({ error: 'User or company not found' });
    }

    // Get document
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: { driver: true },
    });

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    if (document.driver.companyId !== user.companyId) {
      return res.status(403).json({ error: 'Unauthorized access to document' });
    }

    if (!document.s3Key) {
      return res.status(400).json({ error: 'Document has no S3 key' });
    }

    // Generate presigned download URL (valid for 15 minutes)
    const expiresIn = 900;
    const downloadUrl = await generatePresignedDownloadUrl(document.s3Key, expiresIn);

    // Log document download for security audit trail and compliance
    await auditService.logDocumentDownload({
      userId: user.id,
      userEmail: user.email,
      userName: user.name,
      companyId: user.companyId,
      documentId: document.id,
      documentType: document.type,
      driverId: document.driver.id,
      driverName: document.driver.name,
      s3Key: document.s3Key,
      expiresIn,
      ipAddress: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'],
    });

    return res.status(200).json({
      success: true,
      data: {
        downloadUrl,
        expiresIn, // seconds
      },
    });
  } catch (error) {
    console.error('Error generating download URL:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

/**
 * Scan document with AI (AWS Textract + OpenAI)
 * POST /api/documents/:documentId/ai-scan
 */
export const scanDocumentWithAI = async (req, res) => {
  try {
    const userId = req.auth?.userId;
    const { documentId } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized - No user ID found' });
    }

    // Get user and company
    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
    });

    if (!user || !user.companyId) {
      return res.status(404).json({ error: 'User or company not found' });
    }

    const companyId = user.companyId;

    // Get document
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: { driver: true },
    });

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    if (document.driver.companyId !== user.companyId) {
      return res.status(403).json({ error: 'Unauthorized access to document' });
    }

    if (!document.s3Key) {
      return res.status(400).json({ error: 'Document has no S3 key' });
    }

    // Get company's document type configurations
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: {
        documentTypeConfigs: true,
        name: true
      }
    });

    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    // Get configuration for this document type
    const customConfigs = company.documentTypeConfigs || {};
    const mergedConfigs = mergeWithDefaults(customConfigs);

    // Check credits (we'll need 1 credit for the scan)
    const creditCheck = await checkLimit(companyId, 'credits', { amount: 1 });

    if (!creditCheck.allowed) {
      return res.status(402).json({
        error: 'Insufficient AI credits',
        message: creditCheck.message,
        current: creditCheck.current,
        required: creditCheck.required,
        purchaseCreditsRequired: true,
        errorCode: 'INSUFFICIENT_CREDITS'
      });
    }

    let detectedDocumentType;
    let documentTypeConfig;
    let parsedData;
    let usage;
    let validation;
    let metadata;

    // Extract data using Textract ONCE
    console.log('Extracting data with Textract...');
    const textractData = await extractDocumentData(document.s3Key);
    console.log('Textract extraction complete');

    // If document type is NOT set or is "Pending Classification", use UNIFIED parsing (classify + extract in ONE call)
    if (!document.type || document.type === 'Pending Classification') {
      console.log('Document type not set - using UNIFIED classification + extraction');

      // Use unified parsing (classifies AND extracts in single AI call)
      const unifiedResult = await parseWithAIUnified(textractData, mergedConfigs);

      detectedDocumentType = unifiedResult.detectedType;
      documentTypeConfig = unifiedResult.documentTypeConfig;
      parsedData = unifiedResult.parsedData;
      usage = unifiedResult.usage;
      validation = unifiedResult.validation;
      metadata = unifiedResult.metadata;

      console.log('✅ Unified parsing complete:', {
        detectedType: detectedDocumentType,
        confidence: metadata.confidence,
        fieldsExtracted: usage.fieldsExtracted
      });

      // Check if AI is enabled for detected document type
      if (!documentTypeConfig.aiEnabled) {
        return res.status(400).json({
          error: 'AI extraction is disabled for this document type',
          message: `AI detected document type "${detectedDocumentType}" but AI extraction is not enabled for it.`,
          documentType: detectedDocumentType
        });
      }

    } else {
      // Document type IS set, use standard dynamic parsing
      console.log('Document type already set:', document.type);

      detectedDocumentType = document.type;
      documentTypeConfig = mergedConfigs[document.type];

      if (!documentTypeConfig) {
        return res.status(400).json({
          error: 'Document type configuration not found',
          message: `No configuration found for document type: ${document.type}`,
          availableTypes: Object.keys(mergedConfigs)
        });
      }

      // Check if AI is enabled for this document type
      if (!documentTypeConfig.aiEnabled) {
        return res.status(400).json({
          error: 'AI extraction is disabled for this document type',
          message: `AI extraction is not enabled for ${detectedDocumentType}. Please enable it in settings first.`,
          documentType: detectedDocumentType
        });
      }

      console.log('Starting AI extraction for document:', {
        documentId,
        s3Key: document.s3Key,
        documentType: detectedDocumentType,
        extractionMode: documentTypeConfig.extractionMode,
        fieldsToExtract: documentTypeConfig.fields?.length || 0
      });

      // Parse with OpenAI using dynamic prompting
      console.log('Parsing with OpenAI (Dynamic)...');
      const parseResult = await parseWithAIDynamic(textractData, documentTypeConfig, detectedDocumentType);
      parsedData = parseResult.parsedData;
      usage = parseResult.usage;
      validation = parseResult.validation;
      metadata = parseResult.metadata;
      console.log('OpenAI parsing complete:', parsedData);
    }

    // Ensure documentType field is set in parsed data
    if (!parsedData.documentType) {
      parsedData.documentType = detectedDocumentType;
    }

    // Special logic for Driver's Abstract: Calculate expiry date from issue date + 30 days
    if (detectedDocumentType === "Driver Abstract" && parsedData.issueDate) {
      try {
        const issueDate = new Date(parsedData.issueDate);
        if (!isNaN(issueDate.getTime())) {
          // Add 30 days to the issue date
          const expiryDate = new Date(issueDate);
          expiryDate.setDate(expiryDate.getDate() + 30);

          // Format as YYYY-MM-DD
          parsedData.expiryDate = expiryDate.toISOString().split('T')[0];

          console.log('✅ Driver Abstract expiry date calculated:', {
            issueDate: parsedData.issueDate,
            expiryDate: parsedData.expiryDate
          });
        }
      } catch (error) {
        console.error('Error calculating Driver Abstract expiry date:', error);
      }
    }

    // Special logic for Work Eligibility: Map document sub-type to status
    if (detectedDocumentType === "Work Eligibility" && parsedData.documentSubType) {
      try {
        const subType = parsedData.documentSubType.toLowerCase();

        // Map document sub-type to status
        if (subType.includes('passport')) {
          parsedData.status = 'Citizen';
          console.log('✅ Work Eligibility: Detected Passport → Status: Citizen');
        } else if (subType.includes('pr') || subType.includes('permanent resident')) {
          parsedData.status = 'Permanent Resident';
          console.log('✅ Work Eligibility: Detected PR Card → Status: Permanent Resident');
        } else if (subType.includes('work permit') || subType.includes('permit')) {
          parsedData.status = 'Work Permit';
          console.log('✅ Work Eligibility: Detected Work Permit → Status: Work Permit');
        }

        console.log('Work Eligibility mapping complete:', {
          documentSubType: parsedData.documentSubType,
          status: parsedData.status,
          expiryDate: parsedData.expiryDate
        });
      } catch (error) {
        console.error('Error mapping Work Eligibility status:', error);
      }
    }

    // Deduct credits ONLY if AI extraction actually happened
    const deductResult = await deductCredits(companyId, documentId, 1);

    if (!deductResult.success) {
      return res.status(402).json({
        error: 'Failed to deduct credits',
        message: deductResult.message
      });
    }

    // Track AI usage
    try {
      const company = await prisma.company.findUnique({
        where: { id: companyId },
        select: { name: true }
      });

      // Calculate cost for GPT-4o-mini
      // Input: $0.150 per 1M tokens, Output: $0.600 per 1M tokens
      const inputCost = (usage.promptTokens / 1_000_000) * 0.150;
      const outputCost = (usage.completionTokens / 1_000_000) * 0.600;
      const lambdaCost = 0.09; // Lambda function text extraction cost
      const totalCost = inputCost + outputCost + lambdaCost;

      await prisma.aIUsage.create({
        data: {
          companyId,
          companyName: company?.name || 'Unknown',
          userId: user.id,
          userName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Unknown',
          userEmail: user.email,
          feature: 'DOCUMENT_ANALYSIS',
          action: `AI scan of ${document.type || 'document'}`,
          tokensUsed: usage.totalTokens,
          inputTokens: usage.promptTokens,
          outputTokens: usage.completionTokens,
          cost: totalCost,
          model: usage.model,
          provider: 'openai',
          requestDuration: usage.requestDuration,
          status: 'SUCCESS',
          metadata: {
            documentId,
            documentType: document.type,
            s3Key: document.s3Key
          },
          ipAddress: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
          userAgent: req.headers['user-agent']
        }
      });

      console.log('✅ AI usage tracked successfully');
    } catch (trackingError) {
      console.error('⚠️ Failed to track AI usage:', trackingError);
      // Don't fail the request if tracking fails
    }

    console.log('Returning extracted data to frontend');

    // Return extracted data (don't auto-save, let user review and save manually)
    return res.status(200).json({
      success: true,
      data: {
        extractedData: parsedData,
        rawTextractData: textractData,
        creditsUsed: 1,
        creditsRemaining: deductResult.balanceAfter,
        validation,
        metadata,
        usage: {
          tokensUsed: usage.totalTokens,
          inputTokens: usage.promptTokens,
          outputTokens: usage.completionTokens,
          extractionMode: usage.extractionMode,
          fieldsExtracted: usage.fieldsExtracted
        }
      },
    });
  } catch (error) {
    console.error('Error scanning document:', error);

    // Track failed AI usage attempt
    try {
      const company = await prisma.company.findUnique({
        where: { id: user?.companyId },
        select: { name: true }
      });

      if (user && user.companyId) {
        await prisma.aIUsage.create({
          data: {
            companyId: user.companyId,
            companyName: company?.name || 'Unknown',
            userId: user.id,
            userName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Unknown',
            userEmail: user.email,
            feature: 'DOCUMENT_ANALYSIS',
            action: `Failed AI scan attempt`,
            tokensUsed: 0,
            inputTokens: 0,
            outputTokens: 0,
            cost: 0,
            status: 'FAILED',
            errorMessage: error.message,
            errorCode: error.code || 'UNKNOWN_ERROR',
            metadata: {
              documentId: req.params.documentId
            },
            ipAddress: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
            userAgent: req.headers['user-agent']
          }
        });
      }
    } catch (trackingError) {
      console.error('⚠️ Failed to track failed AI usage:', trackingError);
    }

    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

/**
 * Bulk scan multiple documents with AI
 * POST /api/documents/bulk-ai-scan
 * Body: { documentIds: string[] }
 */
export const bulkScanDocumentsWithAI = async (req, res) => {
  try {
    const userId = req.auth?.userId;
    const { documentIds } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized - No user ID found' });
    }

    if (!documentIds || !Array.isArray(documentIds) || documentIds.length === 0) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'documentIds array is required',
      });
    }

    // Get user and company
    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
    });

    if (!user || !user.companyId) {
      return res.status(404).json({ error: 'User or company not found' });
    }

    const companyId = user.companyId;
    const creditsRequired = documentIds.length;

    // Check credits using billing service
    const creditCheck = await checkLimit(companyId, 'credits', { amount: creditsRequired });

    if (!creditCheck.allowed) {
      return res.status(402).json({
        error: 'Insufficient AI credits',
        message: creditCheck.message,
        current: creditCheck.current,
        required: creditCheck.required,
        purchaseCreditsRequired: true,
        errorCode: 'INSUFFICIENT_CREDITS'
      });
    }

    // Get all documents and verify access
    const documents = await prisma.document.findMany({
      where: {
        id: { in: documentIds },
      },
      include: { driver: true },
    });

    // Verify all documents belong to this company
    const unauthorizedDocs = documents.filter(
      (doc) => doc.driver.companyId !== user.companyId
    );

    if (unauthorizedDocs.length > 0) {
      return res.status(403).json({
        error: 'Unauthorized access to one or more documents',
      });
    }

    if (documents.length !== documentIds.length) {
      return res.status(404).json({
        error: 'Some documents not found',
        message: `Found ${documents.length} out of ${documentIds.length} requested documents`,
      });
    }

    console.log(`Starting bulk AI scan for ${documents.length} documents`);

    // Get company info for AI usage tracking and document type configurations
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: {
        name: true,
        documentTypeConfigs: true
      }
    });

    // Get merged document type configurations
    const customConfigs = company.documentTypeConfigs || {};
    const mergedConfigs = mergeWithDefaults(customConfigs);

    // Scan all documents in parallel
    const scanResults = await Promise.all(
      documents.map(async (document) => {
        try {
          // Check if AI is enabled for this document type
          const documentTypeConfig = mergedConfigs[document.type];

          if (!documentTypeConfig) {
            return {
              documentId: document.id,
              success: false,
              error: `Document type configuration not found for: ${document.type}`,
              skipped: true,
              reason: 'MISSING_CONFIG'
            };
          }

          if (!documentTypeConfig.aiEnabled) {
            return {
              documentId: document.id,
              success: false,
              error: `AI extraction is disabled for document type: ${document.type}`,
              skipped: true,
              reason: 'AI_DISABLED'
            };
          }

          if (!document.s3Key) {
            // Track failed attempt (no S3 key)
            try {
              await prisma.aIUsage.create({
                data: {
                  companyId,
                  companyName: company?.name || 'Unknown',
                  userId: user.id,
                  userName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Unknown',
                  userEmail: user.email,
                  feature: 'DOCUMENT_ANALYSIS',
                  action: 'Bulk AI scan - no S3 key',
                  tokensUsed: 0,
                  inputTokens: 0,
                  outputTokens: 0,
                  cost: 0,
                  status: 'FAILED',
                  errorMessage: 'Document has no S3 key',
                  errorCode: 'NO_S3_KEY',
                  metadata: { documentId: document.id, documentType: document.type },
                  ipAddress: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
                  userAgent: req.headers['user-agent']
                }
              });
            } catch (trackingError) {
              console.error('⚠️ Failed to track failed AI usage:', trackingError);
            }

            return {
              documentId: document.id,
              success: false,
              error: 'Document has no S3 key',
            };
          }

          console.log(`Scanning document ${document.id} (${document.type}) with Textract...`);
          const textractData = await extractDocumentData(document.s3Key);

          console.log(`Parsing document ${document.id} with OpenAI (Dynamic)...`);
          const parseResult = await parseWithAIDynamic(textractData, documentTypeConfig, document.type);
          const parsedData = parseResult.parsedData;
          const usage = parseResult.usage;
          const validation = parseResult.validation;
          const metadata = parseResult.metadata;

          // Track successful AI usage
          try {
            // Calculate cost for GPT-4o-mini
            const inputCost = (usage.promptTokens / 1_000_000) * 0.150;
            const outputCost = (usage.completionTokens / 1_000_000) * 0.600;
            const totalCost = inputCost + outputCost;

            await prisma.aIUsage.create({
              data: {
                companyId,
                companyName: company?.name || 'Unknown',
                userId: user.id,
                userName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Unknown',
                userEmail: user.email,
                feature: 'DOCUMENT_ANALYSIS',
                action: `Bulk AI scan of ${document.type || 'document'}`,
                tokensUsed: usage.totalTokens,
                inputTokens: usage.promptTokens,
                outputTokens: usage.completionTokens,
                cost: totalCost,
                model: usage.model,
                provider: 'openai',
                requestDuration: usage.requestDuration,
                status: 'SUCCESS',
                metadata: {
                  documentId: document.id,
                  documentType: document.type,
                  s3Key: document.s3Key,
                  bulkScan: true
                },
                ipAddress: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
                userAgent: req.headers['user-agent']
              }
            });
            console.log(`✅ AI usage tracked for document ${document.id}`);
          } catch (trackingError) {
            console.error(`⚠️ Failed to track AI usage for document ${document.id}:`, trackingError);
          }

          return {
            documentId: document.id,
            documentType: document.type,
            success: true,
            extractedData: parsedData,
            rawTextractData: textractData,
            validation,
            metadata,
            usage: {
              tokensUsed: usage.totalTokens,
              extractionMode: usage.extractionMode,
              fieldsExtracted: usage.fieldsExtracted
            }
          };
        } catch (error) {
          console.error(`Error scanning document ${document.id}:`, error);

          // Track failed AI usage
          try {
            await prisma.aIUsage.create({
              data: {
                companyId,
                companyName: company?.name || 'Unknown',
                userId: user.id,
                userName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Unknown',
                userEmail: user.email,
                feature: 'DOCUMENT_ANALYSIS',
                action: 'Bulk AI scan - failed',
                tokensUsed: 0,
                inputTokens: 0,
                outputTokens: 0,
                cost: 0,
                status: 'FAILED',
                errorMessage: error.message,
                errorCode: error.code || 'SCAN_ERROR',
                metadata: {
                  documentId: document.id,
                  documentType: document.type,
                  bulkScan: true
                },
                ipAddress: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
                userAgent: req.headers['user-agent']
              }
            });
          } catch (trackingError) {
            console.error(`⚠️ Failed to track failed AI usage for document ${document.id}:`, trackingError);
          }

          return {
            documentId: document.id,
            success: false,
            error: error.message,
          };
        }
      })
    );

    // Count successful scans and skipped documents
    const successfulScans = scanResults.filter((r) => r.success).length;
    const skippedScans = scanResults.filter((r) => r.skipped).length;
    const failedScans = scanResults.filter((r) => !r.success && !r.skipped).length;

    // Deduct credits ONLY for successful scans (where AI was actually used)
    let creditsRemaining = creditCheck.current;

    if (successfulScans > 0) {
      const deductResult = await deductCredits(companyId, documentIds[0], successfulScans);
      if (deductResult.success) {
        creditsRemaining = deductResult.balanceAfter;
      }
    }

    console.log(`Bulk scan complete: ${successfulScans} successful, ${skippedScans} skipped, ${failedScans} failed out of ${documents.length} total`);

    return res.status(200).json({
      success: true,
      data: {
        results: scanResults,
        summary: {
          totalDocuments: documents.length,
          successfulScans,
          skippedScans,
          failedScans,
          totalCreditsUsed: successfulScans,
          creditsRemaining
        }
      },
    });
  } catch (error) {
    console.error('Error in bulk AI scan:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

/**
 * Get company AI credits balance
 * GET /api/documents/credits
 */
export const getCreditsBalance = async (req, res) => {
  try {
    const userId = req.auth?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized - No user ID found' });
    }

    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
    });

    if (!user || !user.companyId) {
      return res.status(404).json({ error: 'User or company not found' });
    }

    const company = await prisma.company.findUnique({
      where: { id: user.companyId },
      select: { aiCredits: true },
    });

    return res.status(200).json({
      success: true,
      data: {
        credits: company?.aiCredits || 0,
      },
    });
  } catch (error) {
    console.error('Error fetching credits:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

/**
 * Get reminders based on document expiry dates
 * GET /api/reminders?page=1&limit=10&filter=7d&search=query
 */
export const getReminders = async (req, res) => {
  try {
    const userId = req.auth?.userId;
    const { page = 1, limit = 10, filter = 'all', search = '' } = req.query;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized - No user ID found' });
    }

    // Get user and company
    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
    });

    if (!user || !user.companyId) {
      return res.status(404).json({ error: 'User or company not found' });
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Calculate date range based on filter
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let maxDays;
    switch (filter) {
      case '1d':
        maxDays = 1;
        break;
      case '7d':
        maxDays = 7;
        break;
      case '14d':
        maxDays = 14;
        break;
      case '30d':
        maxDays = 30;
        break;
      default:
        maxDays = null; // all
    }

    // Build where clause for documents
    const whereClause = {
      driver: {
        companyId: user.companyId,
      },
      expiryDate: {
        not: null,
      },
    };

    // Add date filter if not 'all'
    if (maxDays !== null) {
      const maxDate = new Date(today);
      maxDate.setDate(maxDate.getDate() + maxDays);
      whereClause.expiryDate = {
        ...whereClause.expiryDate,
        lte: maxDate,
      };
    }

    // Add search filter if provided
    if (search) {
      whereClause.driver = {
        ...whereClause.driver,
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { contact: { contains: search, mode: 'insensitive' } },
        ],
      };
    }

    // Fetch documents with driver info
    const [documents, totalCount] = await Promise.all([
      prisma.document.findMany({
        where: whereClause,
        include: {
          driver: {
            select: {
              id: true,
              name: true,
              contact: true,
            },
          },
        },
        orderBy: {
          expiryDate: 'asc',
        },
        skip,
        take: limitNum,
      }),
      prisma.document.count({ where: whereClause }),
    ]);

    // Calculate days until expiry for each document
    const reminders = documents.map((doc) => {
      const expiryDate = new Date(doc.expiryDate);
      const diffTime = expiryDate - today;
      const daysUntilExpiry = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      // Split name into firstName and lastName
      const nameParts = doc.driver.name ? doc.driver.name.trim().split(' ') : ['Unknown'];
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      return {
        id: doc.id,
        documentType: doc.type,
        expiryDate: doc.expiryDate,
        daysUntilExpiry,
        reminderDays: 30, // Default reminder days (could be customizable per document type)
        driver: {
          id: doc.driver.id,
          firstName: firstName,
          lastName: lastName,
          employeeId: doc.driver.contact || '',
        },
      };
    });

    const totalPages = Math.ceil(totalCount / limitNum);

    return res.status(200).json({
      success: true,
      data: {
        reminders,
        totalCount,
        totalPages,
        currentPage: pageNum,
        limit: limitNum,
      },
    });
  } catch (error) {
    console.error('Error fetching reminders:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

/**
 * Get documents filtered by status (expired, expiring soon, valid)
 * GET /api/document-status?page=1&limit=10&status=expired&search=query
 */
export const getDocumentStatus = async (req, res) => {
  try {
    const userId = req.auth?.userId;
    const { page = 1, limit = 10, status = 'all', search = '' } = req.query;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized - No user ID found' });
    }

    // Get user and company
    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
      select: {
        companyId: true,
      },
    });

    if (!user || !user.companyId) {
      return res.status(404).json({ error: 'User or company not found' });
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const expiringThreshold = new Date(today);
    expiringThreshold.setDate(expiringThreshold.getDate() + 30);

    const companyId = user.companyId;

    // Build base where clause
    const baseWhere = {
      driver: {
        companyId,
      },
    };

    // Add search filter if provided
    if (search) {
      baseWhere.OR = [
        { type: { contains: search, mode: 'insensitive' } },
        { fileName: { contains: search, mode: 'insensitive' } },
        { driver: {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { contact: { contains: search, mode: 'insensitive' } },
            ],
          }
        },
      ];
    }

    // Build status-specific where clause
    let statusWhere = { ...baseWhere };

    if (status === 'expired') {
      statusWhere.expiryDate = { lt: today };
    } else if (status === 'expiring') {
      statusWhere.expiryDate = {
        gte: today,
        lte: expiringThreshold
      };
    } else if (status === 'verified' || status === 'valid') { // Support both 'verified' and legacy 'valid'
      // Document must be ACTIVE (data filled) AND not expired/expiring
      statusWhere.AND = [
        { status: 'ACTIVE' }, // Only verified if status is ACTIVE (data is filled)
        {
          OR: [
            { expiryDate: null },
            { expiryDate: { gt: expiringThreshold } }
          ]
        }
      ];
    }

    // Fetch documents and count in parallel
    const [documents, totalCount, expiredCount, expiringCount, verifiedCount, allCount] = await Promise.all([
      prisma.document.findMany({
        where: statusWhere,
        select: {
          id: true,
          type: true,
          fileName: true,
          expiryDate: true,
          uploadedAt: true,
          status: true, // Include status to check if data is filled
          driver: {
            select: {
              id: true,
              name: true,
              contact: true,
            },
          },
        },
        orderBy: { expiryDate: 'asc' },
        skip,
        take: limitNum,
      }),
      prisma.document.count({ where: statusWhere }),
      // Count expired
      prisma.document.count({
        where: {
          ...baseWhere,
          expiryDate: { lt: today }
        }
      }),
      // Count expiring soon
      prisma.document.count({
        where: {
          ...baseWhere,
          expiryDate: { gte: today, lte: expiringThreshold }
        }
      }),
      // Count verified (status ACTIVE AND no expiry or expires after 30 days)
      prisma.document.count({
        where: {
          ...baseWhere,
          status: 'ACTIVE', // Only count as verified if data is filled (ACTIVE)
          OR: [
            { expiryDate: null },
            { expiryDate: { gt: expiringThreshold } }
          ]
        }
      }),
      // Count all
      prisma.document.count({ where: baseWhere }),
    ]);

    const totalPages = Math.ceil(totalCount / limitNum);

    // Calculate status for each document for display using shared utility
    const documentsWithStatus = documents.map((doc) => {
      // Use shared utility function for consistent status calculation
      const docStatus = calculateDocumentStatus(doc);

      // Split name into firstName and lastName
      const nameParts = doc.driver.name ? doc.driver.name.trim().split(' ') : ['Unknown'];
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      return {
        id: doc.id,
        type: doc.type,
        filename: doc.fileName,
        expiryDate: doc.expiryDate,
        uploadedAt: doc.uploadedAt,
        status: docStatus,
        driver: {
          id: doc.driver.id,
          firstName: firstName,
          lastName: lastName,
          employeeId: doc.driver.contact || '',
        },
      };
    });

    return res.status(200).json({
      success: true,
      data: {
        documents: documentsWithStatus,
        totalCount,
        totalPages,
        currentPage: pageNum,
        limit: limitNum,
        statusCounts: {
          all: allCount,
          expired: expiredCount,
          expiring: expiringCount,
          verified: verifiedCount,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching document status:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
};
