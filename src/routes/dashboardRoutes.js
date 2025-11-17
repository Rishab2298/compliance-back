import express from 'express';
import { getDashboardStats, getDocumentStatsByType } from '../controllers/dashboardController.js';
import { requireCapability } from '../middleware/dspPermissionMiddleware.js';

const router = express.Router();

// Get dashboard statistics (summary, recent drivers, upcoming expirations)
// Requires view_dashboard capability (ADMIN only)
router.get('/stats', requireCapability('view_dashboard'), getDashboardStats);

// Get document statistics breakdown by type
// Requires view_dashboard capability (ADMIN only)
router.get('/document-stats', requireCapability('view_dashboard'), getDocumentStatsByType);

export default router;
