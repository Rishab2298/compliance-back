import express from 'express';
import {
  getSystemMetrics,
  getSystemErrors,
  healthCheck,
} from '../controllers/systemMetricsController.js';

const router = express.Router();

/**
 * System Metrics Routes
 *
 * GET /api/super-admin/system-metrics - Get comprehensive system health metrics
 * GET /api/super-admin/system-metrics/errors - Get recent error logs
 * GET /api/health - Public health check endpoint
 */

// System metrics (requires super admin auth - applied in server.js)
router.get('/', getSystemMetrics);
router.get('/errors', getSystemErrors);

export default router;
