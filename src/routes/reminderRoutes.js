import express from 'express';
import {
  getReminders,
  sendManualReminder,
  getReminderHistory,
  triggerReminderCronManually,
} from '../controllers/reminderController.js';
import {
  createCustomReminder,
  getCustomReminders,
  getCustomReminder,
  updateCustomReminder,
  deleteCustomReminder,
} from '../controllers/customReminderController.js';
import { requireCapability } from '../middleware/dspPermissionMiddleware.js';

const router = express.Router();

/**
 * Reminder Routes with DSP Permission Checks
 * All routes require authentication (handled by authMiddleware in server.js)
 * Reminder operations require 'configure_reminders' capability
 */

/**
 * @route   GET /api/reminders
 * @desc    Get all reminders for the company based on reminder settings
 * @access  Private (requires configure_reminders capability)
 */
router.get('/', requireCapability("configure_reminders"), getReminders);

/**
 * @route   POST /api/reminders/send
 * @desc    Send a manual reminder for a specific document
 * @access  Private (requires configure_reminders capability)
 * @body    { documentId, channel }
 */
router.post('/send', requireCapability("configure_reminders"), sendManualReminder);

/**
 * @route   GET /api/reminders/history/:documentId
 * @desc    Get reminder history for a specific document
 * @access  Private (requires configure_reminders capability)
 */
router.get('/history/:documentId', requireCapability("configure_reminders"), getReminderHistory);

/**
 * @route   POST /api/reminders/trigger-cron
 * @desc    Manually trigger the reminder cron job (for testing)
 * @access  Private (requires configure_reminders capability)
 */
router.post('/trigger-cron', requireCapability("configure_reminders"), triggerReminderCronManually);

// Custom Reminder Routes
/**
 * @route   POST /api/reminders/custom
 * @desc    Create a new custom reminder
 * @access  Private (requires configure_reminders capability)
 * @body    { title, description?, triggerDate, triggerTime?, frequency?, notificationType?, priority? }
 */
router.post('/custom', requireCapability("configure_reminders"), createCustomReminder);

/**
 * @route   GET /api/reminders/custom
 * @desc    Get all custom reminders for the company
 * @access  Private (requires configure_reminders capability)
 */
router.get('/custom', requireCapability("configure_reminders"), getCustomReminders);

/**
 * @route   GET /api/reminders/custom/:id
 * @desc    Get a single custom reminder
 * @access  Private (requires configure_reminders capability)
 */
router.get('/custom/:id', requireCapability("configure_reminders"), getCustomReminder);

/**
 * @route   PUT /api/reminders/custom/:id
 * @desc    Update a custom reminder
 * @access  Private (requires configure_reminders capability)
 * @body    { title?, description?, triggerDate?, triggerTime?, frequency?, notificationType?, priority? }
 */
router.put('/custom/:id', requireCapability("configure_reminders"), updateCustomReminder);

/**
 * @route   DELETE /api/reminders/custom/:id
 * @desc    Delete a custom reminder
 * @access  Private (requires configure_reminders capability)
 */
router.delete('/custom/:id', requireCapability("configure_reminders"), deleteCustomReminder);

export default router;
