import prisma from '../../prisma/client.js';
import { z } from 'zod';
import {
  generatePresignedUploadUrl,
  generatePresignedDownloadUrl,
  generateDocumentKey,
  deleteFile,
} from '../services/s3Service.js';
import { extractDocumentData, parseWithAI } from '../services/textractService.js';
import { deductCredits, checkLimit } from '../services/billingService.js';

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
      include: { companyAdmin: true },
    });

    if (!user || !user.companyAdmin) {
      return res.status(404).json({ error: 'User or company not found' });
    }

    // Verify driver belongs to this company
    const driver = await prisma.driver.findFirst({
      where: {
        id: driverId,
        companyId: user.companyAdmin.id,
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
          user.companyAdmin.id,
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
      include: { companyAdmin: true },
    });

    if (!user || !user.companyAdmin) {
      return res.status(404).json({ error: 'User or company not found' });
    }

    // Verify driver
    const driver = await prisma.driver.findFirst({
      where: {
        id: driverId,
        companyId: user.companyAdmin.id,
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
      include: { companyAdmin: true },
    });

    if (!user || !user.companyAdmin) {
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

    if (document.driver.companyId !== user.companyAdmin.id) {
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

    return res.status(200).json({
      success: true,
      message: 'Document updated successfully',
      data: updatedDocument,
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
      include: { companyAdmin: true },
    });

    if (!user || !user.companyAdmin) {
      return res.status(404).json({ error: 'User or company not found' });
    }

    // Verify driver
    const driver = await prisma.driver.findFirst({
      where: {
        id: driverId,
        companyId: user.companyAdmin.id,
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
      include: { companyAdmin: true },
    });

    if (!user || !user.companyAdmin) {
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

    if (document.driver.companyId !== user.companyAdmin.id) {
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
      include: { companyAdmin: true },
    });

    if (!user || !user.companyAdmin) {
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

    if (document.driver.companyId !== user.companyAdmin.id) {
      return res.status(403).json({ error: 'Unauthorized access to document' });
    }

    if (!document.s3Key) {
      return res.status(400).json({ error: 'Document has no S3 key' });
    }

    // Generate presigned download URL (valid for 15 minutes)
    const downloadUrl = await generatePresignedDownloadUrl(document.s3Key, 900);

    return res.status(200).json({
      success: true,
      data: {
        downloadUrl,
        expiresIn: 900, // seconds
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
      include: { companyAdmin: true },
    });

    if (!user || !user.companyAdmin) {
      return res.status(404).json({ error: 'User or company not found' });
    }

    const companyId = user.companyAdmin.id;

    // Check credits using billing service
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

    // Get document
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: { driver: true },
    });

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    if (document.driver.companyId !== user.companyAdmin.id) {
      return res.status(403).json({ error: 'Unauthorized access to document' });
    }

    if (!document.s3Key) {
      return res.status(400).json({ error: 'Document has no S3 key' });
    }

    console.log('Starting AI scan for document:', {
      documentId,
      s3Key: document.s3Key,
      documentType: document.type,
    });

    // Extract data using Textract
    console.log('Extracting data with Textract...');
    const textractData = await extractDocumentData(document.s3Key);
    console.log('Textract extraction complete');

    // Parse with OpenAI
    console.log('Parsing with OpenAI...');
    const parsedData = await parseWithAI(textractData, document.type);
    console.log('OpenAI parsing complete:', parsedData);

    // Deduct credits using billing service
    const deductResult = await deductCredits(companyId, documentId, 1);

    if (!deductResult.success) {
      return res.status(402).json({
        error: 'Failed to deduct credits',
        message: deductResult.message
      });
    }

    console.log('Returning extracted data to frontend');

    // Return extracted data (don't auto-save, let user review)
    return res.status(200).json({
      success: true,
      data: {
        extractedData: parsedData,
        rawTextractData: textractData,
        creditsUsed: 1,
        creditsRemaining: deductResult.balanceAfter,
      },
    });
  } catch (error) {
    console.error('Error scanning document:', error);
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
      include: { companyAdmin: true },
    });

    if (!user || !user.companyAdmin) {
      return res.status(404).json({ error: 'User or company not found' });
    }

    const companyId = user.companyAdmin.id;
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
      (doc) => doc.driver.companyId !== user.companyAdmin.id
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

    // Scan all documents in parallel
    const scanResults = await Promise.all(
      documents.map(async (document) => {
        try {
          if (!document.s3Key) {
            return {
              documentId: document.id,
              success: false,
              error: 'Document has no S3 key',
            };
          }

          console.log(`Scanning document ${document.id} with Textract...`);
          const textractData = await extractDocumentData(document.s3Key);

          console.log(`Parsing document ${document.id} with OpenAI...`);
          const parsedData = await parseWithAI(textractData, document.type);

          return {
            documentId: document.id,
            success: true,
            extractedData: parsedData,
            rawTextractData: textractData,
          };
        } catch (error) {
          console.error(`Error scanning document ${document.id}:`, error);
          return {
            documentId: document.id,
            success: false,
            error: error.message,
          };
        }
      })
    );

    // Count successful scans
    const successfulScans = scanResults.filter((r) => r.success).length;

    // Deduct credits based on successful scans using billing service
    let creditsRemaining = creditCheck.current;

    if (successfulScans > 0) {
      const deductResult = await deductCredits(companyId, documentIds[0], successfulScans);
      if (deductResult.success) {
        creditsRemaining = deductResult.balanceAfter;
      }
    }

    console.log(`Bulk scan complete: ${successfulScans}/${documents.length} successful`);

    return res.status(200).json({
      success: true,
      data: {
        results: scanResults,
        totalCreditsUsed: successfulScans,
        creditsRemaining,
        successfulScans,
        totalDocuments: documents.length,
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
      include: { companyAdmin: true },
    });

    if (!user || !user.companyAdmin) {
      return res.status(404).json({ error: 'User or company not found' });
    }

    const company = await prisma.company.findUnique({
      where: { id: user.companyAdmin.id },
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
      include: { companyAdmin: true },
    });

    if (!user || !user.companyAdmin) {
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
        companyId: user.companyAdmin.id,
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
      include: { companyAdmin: true },
    });

    if (!user || !user.companyAdmin) {
      return res.status(404).json({ error: 'User or company not found' });
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Build base where clause
    const baseWhere = {
      driver: {
        companyId: user.companyAdmin.id,
      },
    };

    // Add search filter if provided
    if (search) {
      baseWhere.OR = [
        { type: { contains: search, mode: 'insensitive' } },
        { driver: {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { contact: { contains: search, mode: 'insensitive' } },
            ],
          }
        },
      ];
    }

    // Fetch all documents to calculate status on the backend
    const allDocuments = await prisma.document.findMany({
      where: baseWhere,
      include: {
        driver: {
          select: {
            id: true,
            name: true,
            contact: true,
          },
        },
      },
    });

    // Calculate status for each document
    const documentsWithStatus = allDocuments.map((doc) => {
      let docStatus;

      if (!doc.expiryDate) {
        docStatus = 'valid';
      } else {
        const expiryDate = new Date(doc.expiryDate);
        const diffTime = expiryDate - today;
        const daysUntilExpiry = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (daysUntilExpiry < 0) {
          docStatus = 'expired';
        } else if (daysUntilExpiry <= 30) {
          docStatus = 'expiring';
        } else {
          docStatus = 'valid';
        }
      }

      return { ...doc, status: docStatus };
    });

    // Filter by status if not 'all'
    const filteredDocuments = status === 'all'
      ? documentsWithStatus
      : documentsWithStatus.filter(doc => doc.status === status);

    // Calculate status counts
    const statusCounts = {
      all: allDocuments.length,
      expired: documentsWithStatus.filter(d => d.status === 'expired').length,
      expiring: documentsWithStatus.filter(d => d.status === 'expiring').length,
      valid: documentsWithStatus.filter(d => d.status === 'valid').length,
    };

    // Paginate filtered documents
    const totalCount = filteredDocuments.length;
    const totalPages = Math.ceil(totalCount / limitNum);
    const paginatedDocuments = filteredDocuments.slice(skip, skip + limitNum);

    // Format response
    const documents = paginatedDocuments.map((doc) => {
      // Split name into firstName and lastName
      const nameParts = doc.driver.name ? doc.driver.name.trim().split(' ') : ['Unknown'];
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      return {
        id: doc.id,
        type: doc.type,
        filename: doc.fileName,
        expiryDate: doc.expiryDate,
        createdAt: doc.createdAt,
        status: doc.status,
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
        documents,
        totalCount,
        totalPages,
        currentPage: pageNum,
        limit: limitNum,
        statusCounts,
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
