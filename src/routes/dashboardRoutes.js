import express from 'express';
import { getDashboardStats, getDocumentStatsByType } from '../controllers/dashboardController.js';

const router = express.Router();

// Get dashboard statistics (summary, recent drivers, upcoming expirations)
router.get('/stats', getDashboardStats);

// Get document statistics breakdown by type
router.get('/document-stats', getDocumentStatsByType);

export default router;
