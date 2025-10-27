import prisma from "../../prisma/client.js";
import { triggerReminderJobManually as runReminderJob } from "../services/reminderCronService.js";

/**
 * Get reminders for the company
 * Returns documents that are expiring based on company's reminder settings
 * GET /api/reminders
 */
export const getReminders = async (req, res) => {
  try {
    const userId = req.auth?.userId;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized - No user ID found" });
    }

    // Get user and company
    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
      include: {
        companyAdmin: {
          include: {
            drivers: {
              include: {
                documents: {
                  where: {
                    status: { in: ["ACTIVE", "EXPIRING_SOON"] },
                    expiryDate: { not: null },
                  },
                  orderBy: { expiryDate: "asc" },
                },
              },
            },
          },
        },
      },
    });

    if (!user || !user.companyAdmin) {
      return res.status(404).json({ error: "User or company not found" });
    }

    const company = user.companyAdmin;
    const reminderDays = company.reminderDays || [];

    // If no reminder settings configured, return empty
    if (reminderDays.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          reminders: [],
          groupedByUrgency: {
            critical: [],
            warning: [],
            info: [],
          },
          stats: {
            total: 0,
            critical: 0,
            warning: 0,
            info: 0,
          },
        },
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const reminders = [];

    // For each reminder day setting, find matching documents
    for (const reminderDay of reminderDays) {
      // Parse "7d" -> 7
      const daysCount = parseInt(reminderDay.replace("d", ""));

      // Calculate target expiry date
      const targetDate = new Date(today);
      targetDate.setDate(targetDate.getDate() + daysCount);

      // Create date range (±12 hours for accuracy)
      const startDate = new Date(targetDate);
      startDate.setHours(0, 0, 0, 0);

      const endDate = new Date(targetDate);
      endDate.setHours(23, 59, 59, 999);

      // Find all documents expiring in this window
      const drivers = company.drivers;

      for (const driver of drivers) {
        for (const doc of driver.documents) {
          if (!doc.expiryDate) continue;

          const expiryDate = new Date(doc.expiryDate);
          expiryDate.setHours(0, 0, 0, 0);

          // Check if this document's expiry falls in the target range
          if (expiryDate >= startDate && expiryDate <= endDate) {
            // Calculate actual days until expiry
            const daysUntilExpiry = Math.ceil(
              (expiryDate - today) / (1000 * 60 * 60 * 24)
            );

            reminders.push({
              id: doc.id,
              documentId: doc.id,
              documentType: doc.type,
              documentNumber: doc.documentNumber,
              expiryDate: doc.expiryDate,
              daysUntilExpiry,
              status: doc.status,
              driver: {
                id: driver.id,
                name: driver.name,
                email: driver.email,
                phone: driver.phone,
                employeeId: driver.contact,
              },
              urgency: getUrgency(daysUntilExpiry),
              reminderInterval: reminderDay,
            });
          }
        }
      }
    }

    // Remove duplicates (document might match multiple reminder intervals)
    const uniqueReminders = [];
    const seenDocIds = new Set();

    for (const reminder of reminders) {
      if (!seenDocIds.has(reminder.documentId)) {
        seenDocIds.add(reminder.documentId);
        uniqueReminders.push(reminder);
      }
    }

    // Sort by days until expiry (most urgent first)
    uniqueReminders.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);

    // Group by urgency
    const groupedByUrgency = {
      critical: uniqueReminders.filter((r) => r.urgency === "critical"),
      warning: uniqueReminders.filter((r) => r.urgency === "warning"),
      info: uniqueReminders.filter((r) => r.urgency === "info"),
    };

    // Calculate stats
    const stats = {
      total: uniqueReminders.length,
      critical: groupedByUrgency.critical.length,
      warning: groupedByUrgency.warning.length,
      info: groupedByUrgency.info.length,
    };

    return res.status(200).json({
      success: true,
      data: {
        reminders: uniqueReminders,
        groupedByUrgency,
        stats,
        reminderSettings: reminderDays,
      },
    });
  } catch (error) {
    console.error("Error fetching reminders:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: error.message,
    });
  }
};

/**
 * Determine urgency level based on days until expiry
 * @param {number} days - Days until expiry
 * @returns {string} - 'critical', 'warning', or 'info'
 */
function getUrgency(days) {
  if (days <= 7) return "critical";
  if (days <= 30) return "warning";
  return "info";
}

/**
 * Send a manual reminder for a specific document
 * POST /api/reminders/send
 */
export const sendManualReminder = async (req, res) => {
  try {
    const userId = req.auth?.userId;
    const { documentId, channel } = req.body;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized - No user ID found" });
    }

    if (!documentId) {
      return res.status(400).json({ error: "Document ID is required" });
    }

    // Get user and company
    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
      include: { companyAdmin: true },
    });

    if (!user || !user.companyAdmin) {
      return res.status(404).json({ error: "User or company not found" });
    }

    // Get document with driver info
    const document = await prisma.document.findFirst({
      where: {
        id: documentId,
        driver: {
          companyId: user.companyAdmin.id,
        },
      },
      include: {
        driver: true,
      },
    });

    if (!document) {
      return res.status(404).json({ error: "Document not found" });
    }

    if (!document.expiryDate) {
      return res
        .status(400)
        .json({ error: "Document does not have an expiry date" });
    }

    // Calculate days until expiry
    const today = new Date();
    const expiryDate = new Date(document.expiryDate);
    const daysUntilExpiry = Math.ceil(
      (expiryDate - today) / (1000 * 60 * 60 * 24)
    );

    // TODO: Implement actual email/SMS sending logic here
    // For now, just create a record in DocumentReminder table

    const reminder = await prisma.documentReminder.create({
      data: {
        documentId: document.id,
        daysBeforeExpiry: daysUntilExpiry,
        scheduledAt: new Date(),
        sentAt: new Date(),
        status: "SENT",
        channel: channel || "EMAIL",
        message: `Manual reminder: Your ${document.type} expires in ${daysUntilExpiry} days`,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Reminder sent successfully",
      data: {
        reminderId: reminder.id,
        documentType: document.type,
        driverName: document.driver.name,
        daysUntilExpiry,
      },
    });
  } catch (error) {
    console.error("Error sending manual reminder:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: error.message,
    });
  }
};

/**
 * Get reminder history for a specific document
 * GET /api/reminders/history/:documentId
 */
export const getReminderHistory = async (req, res) => {
  try {
    const userId = req.auth?.userId;
    const { documentId } = req.params;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized - No user ID found" });
    }

    // Get user and company
    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
      include: { companyAdmin: true },
    });

    if (!user || !user.companyAdmin) {
      return res.status(404).json({ error: "User or company not found" });
    }

    // Verify document belongs to company
    const document = await prisma.document.findFirst({
      where: {
        id: documentId,
        driver: {
          companyId: user.companyAdmin.id,
        },
      },
    });

    if (!document) {
      return res.status(404).json({ error: "Document not found" });
    }

    // Get reminder history
    const history = await prisma.documentReminder.findMany({
      where: {
        documentId,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return res.status(200).json({
      success: true,
      data: history,
    });
  } catch (error) {
    console.error("Error fetching reminder history:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: error.message,
    });
  }
};

/**
 * Manually trigger the reminder cron job (for testing)
 * POST /api/reminders/trigger-cron
 */
export const triggerReminderCronManually = async (req, res) => {
  try {
    const userId = req.auth?.userId;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized - No user ID found" });
    }

    // Verify user is an admin
    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
      include: { companyAdmin: true },
    });

    if (!user || !user.companyAdmin) {
      return res.status(403).json({ error: "Only company admins can trigger the cron job" });
    }

    console.log(`🔔 Manual cron trigger initiated by user: ${userId}`);

    // Run the reminder job
    const stats = await runReminderJob();

    return res.status(200).json({
      success: true,
      message: "Reminder cron job executed successfully",
      stats,
    });
  } catch (error) {
    console.error("Error triggering reminder cron manually:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: error.message,
    });
  }
};
