import express from 'express';
import { requireAuth } from '@clerk/express';
import { resolveUser } from '../middleware/userResolverMiddleware.js';
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotificationById,
  deleteAllRead,
  getUnreadCount,
} from '../controllers/notificationController.js';

const router = express.Router();

// All routes require authentication and user resolution
router.use(requireAuth());
router.use(resolveUser);

/**
 * Get notifications for the authenticated user
 * GET /api/notifications
 * Query params:
 *   - unreadOnly: boolean (optional)
 *   - limit: number (optional, default: 50)
 *   - offset: number (optional, default: 0)
 */
router.get('/', getNotifications);

/**
 * Get unread notification count
 * GET /api/notifications/unread-count
 */
router.get('/unread-count', getUnreadCount);

/**
 * Mark all notifications as read
 * PUT /api/notifications/read-all
 */
router.put('/read-all', markAllAsRead);

/**
 * Delete all read notifications
 * DELETE /api/notifications/read
 */
router.delete('/read', deleteAllRead);

/**
 * Mark a specific notification as read
 * PUT /api/notifications/:id/read
 */
router.put('/:id/read', markAsRead);

/**
 * Delete a specific notification
 * DELETE /api/notifications/:id
 */
router.delete('/:id', deleteNotificationById);

export default router;
