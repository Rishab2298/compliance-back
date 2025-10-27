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

const router = express.Router();

// All routes require authentication (handled by Clerk middleware)

// Get reminders (documents expiring soon)
router.get('/reminders', getReminders);

// Get document status (filtered by expiry status)
router.get('/document-status', getDocumentStatus);

// Get AI credits balance
router.get('/credits', getCreditsBalance);

// Bulk AI scan multiple documents
router.post('/bulk-ai-scan', bulkScanDocumentsWithAI);

// Generate presigned URLs for upload
router.post('/presigned-urls/:driverId', generatePresignedUrls);

// Create document record after upload
router.post('/:driverId', createDocument);

// Update document details (manual entry or AI scan)
router.put('/:documentId', updateDocumentDetails);

// Get all documents for a driver
router.get('/driver/:driverId', getDriverDocuments);

// Get presigned download URL
router.get('/:documentId/download-url', getDocumentDownloadUrl);

// AI scan document
router.post('/:documentId/ai-scan', scanDocumentWithAI);

// Delete document
router.delete('/:documentId', deleteDocument);

export default router;
