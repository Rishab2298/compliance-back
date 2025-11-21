import express from 'express';
import {
  logFrontendError,
  log404Error,
  getFrontendErrorStats,
} from '../controllers/errorLogController.js';

const router = express.Router();

/**
 * Frontend Error Logging Routes
 *
 * These routes allow the frontend to log errors for debugging and monitoring:
 * - JavaScript errors (via ErrorBoundary)
 * - 404 Not Found errors (via NotFound page)
 */

// Log a frontend error (no auth required - errors can happen before login)
router.post('/', logFrontendError);

// Log a 404 error (no auth required - can happen before login)
router.post('/404', log404Error);

// Get error statistics (admin only, requires auth)
router.get('/stats', getFrontendErrorStats);

export default router;
