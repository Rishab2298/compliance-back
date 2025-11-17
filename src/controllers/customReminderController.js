import prisma from "../../prisma/client.js";
import auditService from "../services/auditService.js";

/**
 * Create a new custom reminder
 * POST /api/reminders/custom
 */
export const createCustomReminder = async (req, res) => {
  try {
    const userId = req.auth?.userId;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized - No user ID found" });
    }

    const { title, description, triggerDate, triggerTime, frequency, notificationType, priority } = req.body;

    // Validation
    if (!title || !triggerDate) {
      return res.status(400).json({ error: "Title and trigger date are required" });
    }

    // Get user and company
    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
      include: { companyAdmin: true },
    });

    if (!user || !user.companyAdmin) {
      return res.status(404).json({ error: "User or company not found" });
    }

    const companyId = user.companyAdmin.id;

    // Combine date and time
    const fullTriggerDate = new Date(`${triggerDate}T${triggerTime || '09:00'}:00`);

    // Check if date is in the past
    if (fullTriggerDate < new Date()) {
      return res.status(400).json({ error: "Trigger date must be in the future" });
    }

    // Create custom reminder
    const reminder = await prisma.customReminder.create({
      data: {
        companyId,
        title,
        description: description || null,
        triggerDate: fullTriggerDate,
        frequency: frequency?.toUpperCase() || 'ONCE',
        notificationType: notificationType?.toUpperCase() || 'BOTH',
        priority: priority?.toUpperCase() || 'NORMAL',
      },
    });

    // Log reminder creation
    await auditService.logReminderOperation({
      userId: user.id,
      userEmail: user.email,
      userName: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
      companyId,
      action: "REMINDER_CREATED",
      reminderId: reminder.id,
      reminderType: "CUSTOM",
      ipAddress: req.ip || req.headers["x-forwarded-for"] || req.connection?.remoteAddress,
      userAgent: req.headers["user-agent"],
      newValues: {
        title,
        triggerDate: fullTriggerDate,
        frequency: reminder.frequency,
        notificationType: reminder.notificationType,
        priority: reminder.priority,
      },
    });

    return res.status(201).json({
      success: true,
      data: { reminder },
    });
  } catch (error) {
    console.error("Error creating custom reminder:", error);
    return res.status(500).json({
      error: "Failed to create custom reminder",
      details: error.message,
    });
  }
};

/**
 * Get all custom reminders for the company
 * GET /api/reminders/custom
 */
export const getCustomReminders = async (req, res) => {
  try {
    const userId = req.auth?.userId;

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

    const companyId = user.companyAdmin.id;

    // Get all active custom reminders for the company
    const reminders = await prisma.customReminder.findMany({
      where: {
        companyId,
        isActive: true,
      },
      orderBy: {
        triggerDate: 'asc',
      },
    });

    return res.status(200).json({
      success: true,
      data: { reminders },
    });
  } catch (error) {
    console.error("Error fetching custom reminders:", error);
    return res.status(500).json({
      error: "Failed to fetch custom reminders",
      details: error.message,
    });
  }
};

/**
 * Get a single custom reminder
 * GET /api/reminders/custom/:id
 */
export const getCustomReminder = async (req, res) => {
  try {
    const userId = req.auth?.userId;
    const { id } = req.params;

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

    const companyId = user.companyAdmin.id;

    // Get the reminder
    const reminder = await prisma.customReminder.findFirst({
      where: {
        id,
        companyId,
      },
    });

    if (!reminder) {
      return res.status(404).json({ error: "Reminder not found" });
    }

    return res.status(200).json({
      success: true,
      data: { reminder },
    });
  } catch (error) {
    console.error("Error fetching custom reminder:", error);
    return res.status(500).json({
      error: "Failed to fetch custom reminder",
      details: error.message,
    });
  }
};

/**
 * Update a custom reminder
 * PUT /api/reminders/custom/:id
 */
export const updateCustomReminder = async (req, res) => {
  try {
    const userId = req.auth?.userId;
    const { id } = req.params;
    const { title, description, triggerDate, triggerTime, frequency, notificationType, priority } = req.body;

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

    const companyId = user.companyAdmin.id;

    // Check if reminder exists and belongs to company
    const existingReminder = await prisma.customReminder.findFirst({
      where: {
        id,
        companyId,
      },
    });

    if (!existingReminder) {
      return res.status(404).json({ error: "Reminder not found" });
    }

    // Build update data
    const updateData = {};

    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description || null;
    if (frequency !== undefined) updateData.frequency = frequency.toUpperCase();
    if (notificationType !== undefined) updateData.notificationType = notificationType.toUpperCase();
    if (priority !== undefined) updateData.priority = priority.toUpperCase();

    if (triggerDate) {
      const fullTriggerDate = new Date(`${triggerDate}T${triggerTime || '09:00'}:00`);

      // Check if date is in the past
      if (fullTriggerDate < new Date()) {
        return res.status(400).json({ error: "Trigger date must be in the future" });
      }

      updateData.triggerDate = fullTriggerDate;
    }

    // Update the reminder
    const updatedReminder = await prisma.customReminder.update({
      where: { id },
      data: updateData,
    });

    // Log reminder update
    await auditService.logReminderOperation({
      userId: user.id,
      userEmail: user.email,
      userName: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
      companyId,
      action: "REMINDER_UPDATED",
      reminderId: id,
      reminderType: "CUSTOM",
      ipAddress: req.ip || req.headers["x-forwarded-for"] || req.connection?.remoteAddress,
      userAgent: req.headers["user-agent"],
      oldValues: {
        title: existingReminder.title,
        triggerDate: existingReminder.triggerDate,
        frequency: existingReminder.frequency,
        notificationType: existingReminder.notificationType,
        priority: existingReminder.priority,
      },
      newValues: {
        title: updatedReminder.title,
        triggerDate: updatedReminder.triggerDate,
        frequency: updatedReminder.frequency,
        notificationType: updatedReminder.notificationType,
        priority: updatedReminder.priority,
      },
    });

    return res.status(200).json({
      success: true,
      data: { reminder: updatedReminder },
    });
  } catch (error) {
    console.error("Error updating custom reminder:", error);
    return res.status(500).json({
      error: "Failed to update custom reminder",
      details: error.message,
    });
  }
};

/**
 * Delete a custom reminder (soft delete by setting isActive to false)
 * DELETE /api/reminders/custom/:id
 */
export const deleteCustomReminder = async (req, res) => {
  try {
    const userId = req.auth?.userId;
    const { id } = req.params;

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

    const companyId = user.companyAdmin.id;

    // Check if reminder exists and belongs to company
    const existingReminder = await prisma.customReminder.findFirst({
      where: {
        id,
        companyId,
      },
    });

    if (!existingReminder) {
      return res.status(404).json({ error: "Reminder not found" });
    }

    // Soft delete by setting isActive to false
    await prisma.customReminder.update({
      where: { id },
      data: { isActive: false },
    });

    // Log reminder deletion
    await auditService.logReminderOperation({
      userId: user.id,
      userEmail: user.email,
      userName: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
      companyId,
      action: "REMINDER_DELETED",
      reminderId: id,
      reminderType: "CUSTOM",
      ipAddress: req.ip || req.headers["x-forwarded-for"] || req.connection?.remoteAddress,
      userAgent: req.headers["user-agent"],
      oldValues: {
        title: existingReminder.title,
        triggerDate: existingReminder.triggerDate,
        frequency: existingReminder.frequency,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Reminder deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting custom reminder:", error);
    return res.status(500).json({
      error: "Failed to delete custom reminder",
      details: error.message,
    });
  }
};
