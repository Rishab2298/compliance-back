import {
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  deleteReadNotifications,
} from '../services/notificationService.js';

/**
 * Get notifications for the authenticated user
 * GET /api/notifications
 * Note: req.dbUser is populated by userResolverMiddleware
 */
export const getNotifications = async (req, res) => {
  try {
    const { unreadOnly, limit, offset } = req.query;

    const result = await getUserNotifications(req.dbUser.id, {
      unreadOnly: unreadOnly === 'true',
      limit: limit ? parseInt(limit) : 50,
      offset: offset ? parseInt(offset) : 0,
    });

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('Error getting notifications:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get notifications',
    });
  }
};

/**
 * Mark a notification as read
 * PUT /api/notifications/:id/read
 * Note: req.dbUser is populated by userResolverMiddleware
 */
export const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;

    await markNotificationAsRead(id, req.dbUser.id);

    res.json({
      success: true,
      message: 'Notification marked as read',
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark notification as read',
    });
  }
};

/**
 * Mark all notifications as read
 * PUT /api/notifications/read-all
 * Note: req.dbUser is populated by userResolverMiddleware
 */
export const markAllAsRead = async (req, res) => {
  try {
    const result = await markAllNotificationsAsRead(req.dbUser.id);

    res.json({
      success: true,
      message: `Marked ${result.count} notifications as read`,
      count: result.count,
    });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark all notifications as read',
    });
  }
};

/**
 * Delete a notification
 * DELETE /api/notifications/:id
 * Note: req.dbUser is populated by userResolverMiddleware
 */
export const deleteNotificationById = async (req, res) => {
  try {
    const { id } = req.params;

    await deleteNotification(id, req.dbUser.id);

    res.json({
      success: true,
      message: 'Notification deleted',
    });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete notification',
    });
  }
};

/**
 * Delete all read notifications
 * DELETE /api/notifications/read
 * Note: req.dbUser is populated by userResolverMiddleware
 */
export const deleteAllRead = async (req, res) => {
  try {
    const result = await deleteReadNotifications(req.dbUser.id);

    res.json({
      success: true,
      message: `Deleted ${result.count} read notifications`,
      count: result.count,
    });
  } catch (error) {
    console.error('Error deleting read notifications:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete read notifications',
    });
  }
};

/**
 * Get unread count
 * GET /api/notifications/unread-count
 * Note: req.dbUser is populated by userResolverMiddleware
 */
export const getUnreadCount = async (req, res) => {
  try {
    const result = await getUserNotifications(req.dbUser.id, {
      unreadOnly: true,
      limit: 1,
    });

    res.json({
      success: true,
      count: result.unread,
    });
  } catch (error) {
    console.error('Error getting unread count:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get unread count',
    });
  }
};
