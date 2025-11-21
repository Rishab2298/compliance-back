import express from 'express';
import {
  getSecurityLogs,
  getSecurityStats,
  getSecurityEventById,
  exportSecurityLogs,
} from '../controllers/securityLogController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = express.Router();

/**
 * Security Logs Routes
 *
 * All routes require authentication
 * Admin/SUPER_ADMIN only
 */

// Get paginated security logs with filtering
router.get('/', requireAuth, getSecurityLogs);

// Get security statistics for dashboard
router.get('/stats', requireAuth, getSecurityStats);

// Export security logs as CSV
router.get('/export', requireAuth, exportSecurityLogs);

// Get specific security event by ID
router.get('/:id', requireAuth, getSecurityEventById);

export default router;
