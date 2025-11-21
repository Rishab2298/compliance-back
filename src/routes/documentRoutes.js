import express from 'express';
import {
  generatePresignedUrls,
  createDocument,
  updateDocumentDetails,
  getDriverDocuments,
  deleteDocument,
  getDocumentDownloadUrl,
  scanDocumentWithAI,
  bulkScanDocumentsWithAI,
  getCreditsBalance,
  getReminders,
  getDocumentStatus,
} from '../controllers/documentController.js';
import { requireCapability } from '../middleware/dspPermissionMiddleware.js';
import { aiScanRateLimiter, bulkAiScanRateLimiter } from '../middleware/rateLimitMiddleware.js';

const router = express.Router();

/**
 * Document Routes with DSP Permission Checks
 * All routes require authentication (handled by authMiddleware in server.js)
 */

// Get reminders (requires upload_documents to view documents)
router.get('/reminders', requireCapability("upload_documents"), getReminders);

// Get document status (requires upload_documents)
router.get('/document-status', requireCapability("upload_documents"), getDocumentStatus);

// Get AI credits balance (requires upload_documents)
router.get('/credits', requireCapability("upload_documents"), getCreditsBalance);

// Bulk AI scan multiple documents (requires upload_documents + rate limiting)
router.post('/bulk-ai-scan', bulkAiScanRateLimiter, requireCapability("upload_documents"), bulkScanDocumentsWithAI);

// Generate presigned URLs for upload (requires upload_documents capability)
router.post('/presigned-urls/:driverId', requireCapability("upload_documents"), generatePresignedUrls);

// Create document record after upload (requires upload_documents capability)
router.post('/:driverId', requireCapability("upload_documents"), createDocument);

// Update document details (requires upload_documents capability)
router.put('/:documentId', requireCapability("upload_documents"), updateDocumentDetails);

// Get all documents for a driver (requires upload_documents to view)
router.get('/driver/:driverId', requireCapability("upload_documents"), getDriverDocuments);

// Get presigned download URL (requires upload_documents to download)
router.get('/:documentId/download-url', requireCapability("upload_documents"), getDocumentDownloadUrl);

// AI scan document (requires upload_documents capability + rate limiting)
router.post('/:documentId/ai-scan', aiScanRateLimiter, requireCapability("upload_documents"), scanDocumentWithAI);

// Delete document (requires delete_documents capability - stricter permission)
router.delete('/:documentId', requireCapability("delete_documents"), deleteDocument);

export default router;
