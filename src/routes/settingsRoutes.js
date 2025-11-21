import express from 'express';
import {
  getAllDocumentTypeConfigs,
  getDocumentTypeConfig,
  createCustomDocumentType,
  updateDocumentTypeConfig,
  deleteCustomDocumentType,
  getAvailableFieldTypes,
  toggleDocumentTypeActive,
} from '../controllers/documentTypeController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = express.Router();

/**
 * Settings Routes - Document Type Configuration Management
 *
 * All routes require authentication middleware to be applied at the app level
 * requireAuth middleware is added to attach the full user object to req.user
 */

// Get available field types (for UI dropdowns)
router.get('/field-types', getAvailableFieldTypes);

// Test endpoint to verify routes are working
router.get('/test', (req, res) => {
  res.json({ success: true, message: 'Settings routes are working!' });
});

// Get all document type configurations
router.get('/document-types', requireAuth, getAllDocumentTypeConfigs);

// Get specific document type configuration
router.get('/document-types/:name', requireAuth, getDocumentTypeConfig);

// Create new custom document type
router.post('/document-types', requireAuth, createCustomDocumentType);

// Update document type configuration (can update defaults or custom)
router.put('/document-types/:name', requireAuth, updateDocumentTypeConfig);

// Toggle active/inactive status of a document type
router.patch('/document-types/:name/toggle-active', requireAuth, toggleDocumentTypeActive);

// Delete custom document type (cannot delete defaults)
router.delete('/document-types/:name', requireAuth, deleteCustomDocumentType);

export default router;
