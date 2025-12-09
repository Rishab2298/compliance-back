import prisma from '../../prisma/client.js';

/**
 * Create a notification for a user
 * @param {Object} params - Notification parameters
 * @param {string} params.userId - User ID to notify
 * @param {string} params.companyId - Company ID
 * @param {string} params.type - Notification event type
 * @param {string} params.title - Notification title
 * @param {string} params.message - Notification message
 * @param {string} [params.actionUrl] - Optional action URL
 * @param {string} [params.driverId] - Optional driver ID
 * @param {string} [params.documentId] - Optional document ID
 * @param {string} [params.reminderId] - Optional reminder ID
 * @param {string} [params.ticketId] - Optional ticket ID
 * @param {Object} [params.metadata] - Optional additional metadata
 */
export const createNotification = async ({
  userId,
  companyId,
  type,
  title,
  message,
  actionUrl = null,
  driverId = null,
  documentId = null,
  reminderId = null,
  ticketId = null,
  metadata = null,
}) => {
  try {
    const notification = await prisma.notification.create({
      data: {
        userId,
        companyId,
        type,
        title,
        message,
        actionUrl,
        driverId,
        documentId,
        reminderId,
        ticketId,
        metadata,
      },
    });

    console.log(`✅ Notification created: ${type} for user ${userId}`);
    return notification;
  } catch (error) {
    console.error('❌ Error creating notification:', error);
    throw error;
  }
};

/**
 * Create notification for all users in a company
 * @param {Object} params - Notification parameters
 * @param {string} params.companyId - Company ID
 * @param {string} params.type - Notification event type
 * @param {string} params.title - Notification title
 * @param {string} params.message - Notification message
 * @param {string} [params.actionUrl] - Optional action URL
 * @param {string[]} [params.excludeUserIds] - User IDs to exclude
 * @param {Object} [params.metadata] - Optional additional metadata
 */
export const createCompanyNotification = async ({
  companyId,
  type,
  title,
  message,
  actionUrl = null,
  excludeUserIds = [],
  metadata = null,
}) => {
  try {
    // Get all users in the company
    const users = await prisma.user.findMany({
      where: {
        companyId,
        id: {
          notIn: excludeUserIds,
        },
      },
      select: {
        id: true,
      },
    });

    // Create notifications for all users
    const notifications = await Promise.all(
      users.map((user) =>
        createNotification({
          userId: user.id,
          companyId,
          type,
          title,
          message,
          actionUrl,
          metadata,
        })
      )
    );

    console.log(`✅ Created ${notifications.length} notifications for company ${companyId}`);
    return notifications;
  } catch (error) {
    console.error('❌ Error creating company notification:', error);
    throw error;
  }
};

/**
 * Get notifications for a user
 * @param {string} userId - User ID
 * @param {Object} options - Query options
 * @param {boolean} [options.unreadOnly] - Get only unread notifications
 * @param {number} [options.limit] - Limit number of results
 * @param {number} [options.offset] - Offset for pagination
 */
export const getUserNotifications = async (userId, options = {}) => {
  const { unreadOnly = false, limit = 50, offset = 0 } = options;

  try {
    const where = {
      userId,
      ...(unreadOnly && { read: false }),
    };

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: {
          createdAt: 'desc',
        },
        take: limit,
        skip: offset,
      }),
      prisma.notification.count({ where }),
    ]);

    return {
      notifications,
      total,
      unread: unreadOnly ? total : await prisma.notification.count({
        where: { userId, read: false },
      }),
    };
  } catch (error) {
    console.error('❌ Error getting user notifications:', error);
    throw error;
  }
};

/**
 * Mark notification as read
 * @param {string} notificationId - Notification ID
 * @param {string} userId - User ID (for security check)
 */
export const markNotificationAsRead = async (notificationId, userId) => {
  try {
    const notification = await prisma.notification.updateMany({
      where: {
        id: notificationId,
        userId, // Security: Only allow users to mark their own notifications as read
      },
      data: {
        read: true,
        readAt: new Date(),
      },
    });

    return notification;
  } catch (error) {
    console.error('❌ Error marking notification as read:', error);
    throw error;
  }
};

/**
 * Mark all notifications as read for a user
 * @param {string} userId - User ID
 */
export const markAllNotificationsAsRead = async (userId) => {
  try {
    const result = await prisma.notification.updateMany({
      where: {
        userId,
        read: false,
      },
      data: {
        read: true,
        readAt: new Date(),
      },
    });

    console.log(`✅ Marked ${result.count} notifications as read for user ${userId}`);
    return result;
  } catch (error) {
    console.error('❌ Error marking all notifications as read:', error);
    throw error;
  }
};

/**
 * Delete a notification
 * @param {string} notificationId - Notification ID
 * @param {string} userId - User ID (for security check)
 */
export const deleteNotification = async (notificationId, userId) => {
  try {
    const notification = await prisma.notification.deleteMany({
      where: {
        id: notificationId,
        userId, // Security: Only allow users to delete their own notifications
      },
    });

    return notification;
  } catch (error) {
    console.error('❌ Error deleting notification:', error);
    throw error;
  }
};

/**
 * Delete all read notifications for a user
 * @param {string} userId - User ID
 */
export const deleteReadNotifications = async (userId) => {
  try {
    const result = await prisma.notification.deleteMany({
      where: {
        userId,
        read: true,
      },
    });

    console.log(`✅ Deleted ${result.count} read notifications for user ${userId}`);
    return result;
  } catch (error) {
    console.error('❌ Error deleting read notifications:', error);
    throw error;
  }
};

// Notification helper functions for specific events

/**
 * Create notification for document upload
 */
export const notifyDocumentUploaded = async ({ companyId, driverId, driverName, documentType, documentId }) => {
  return createCompanyNotification({
    companyId,
    type: 'DOCUMENT_UPLOADED',
    title: 'New Document Uploaded',
    message: `${driverName} uploaded a new ${documentType} document`,
    actionUrl: `/client/driver/${driverId}`,
    metadata: {
      driverId,
      driverName,
      documentType,
      documentId,
    },
  });
};

/**
 * Create notification for driver registration
 */
export const notifyDriverCreated = async ({ companyId, driverId, driverName }) => {
  return createCompanyNotification({
    companyId,
    type: 'DRIVER_CREATED',
    title: 'New Driver Registered',
    message: `${driverName} has been added to your driver list`,
    actionUrl: `/client/driver/${driverId}`,
    metadata: {
      driverId,
      driverName,
    },
  });
};

/**
 * Create notification for bulk driver import
 */
export const notifyBulkDriversCreated = async ({ companyId, count, driverNames }) => {
  return createCompanyNotification({
    companyId,
    type: 'DRIVER_CREATED',
    title: 'Drivers Added via Bulk Import',
    message: `${count} driver${count !== 1 ? 's have' : ' has'} been successfully imported to your driver list`,
    actionUrl: '/client/drivers',
    metadata: {
      count,
      driverNames, // Expects pre-sliced array (first 10) from controller
      isBulkImport: true,
    },
  });
};

/**
 * Create notification for reminder sent
 */
export const notifyReminderSent = async ({ companyId, reminderId, count, reminderType }) => {
  return createCompanyNotification({
    companyId,
    type: 'REMINDER_SENT',
    title: 'Reminder Sent',
    message: `Reminder email sent to ${count} driver${count !== 1 ? 's' : ''} about ${reminderType}`,
    actionUrl: '/client/reminders',
    metadata: {
      reminderId,
      count,
      reminderType,
    },
  });
};

/**
 * Create notification for document expiring
 */
export const notifyDocumentExpiring = async ({ companyId, driverId, driverName, documentType, expiryDate, daysUntilExpiry }) => {
  return createCompanyNotification({
    companyId,
    type: 'DOCUMENT_EXPIRING',
    title: 'Document Expiring Soon',
    message: `${driverName}'s ${documentType} expires in ${daysUntilExpiry} day${daysUntilExpiry !== 1 ? 's' : ''}`,
    actionUrl: `/client/driver/${driverId}`,
    metadata: {
      driverId,
      driverName,
      documentType,
      expiryDate,
      daysUntilExpiry,
    },
  });
};

/**
 * Create notification for team member invited
 */
export const notifyTeamMemberInvited = async ({ companyId, inviterUserId, invitedEmail, role }) => {
  return createNotification({
    userId: inviterUserId,
    companyId,
    type: 'TEAM_MEMBER_INVITED',
    title: 'Team Member Invited',
    message: `You invited ${invitedEmail} to join your team as ${role}`,
    actionUrl: '/client/team',
    metadata: {
      invitedEmail,
      role,
    },
  });
};
