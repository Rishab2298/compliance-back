import express from 'express';
import {
  getDocumentTypes,
  getDocumentType,
  createDocumentType,
  updateDocumentType,
  deleteDocumentType,
} from '../controllers/documentTypeController.js';

const router = express.Router();

// Get all document types for a company
router.get('/company/:companyId', getDocumentTypes);

// Get a single document type by name
router.get('/company/:companyId/:name', getDocumentType);

// Create a new document type
router.post('/company/:companyId', createDocumentType);

// Update a document type (rename)
router.put('/company/:companyId/:oldName', updateDocumentType);

// Delete a document type by name
router.delete('/company/:companyId/:name', deleteDocumentType);

export default router;
