import express from 'express';
import {
  getReminders,
  sendManualReminder,
  getReminderHistory,
  triggerReminderCronManually,
} from '../controllers/reminderController.js';

const router = express.Router();

/**
 * @route   GET /api/reminders
 * @desc    Get all reminders for the company based on reminder settings
 * @access  Private (requires Clerk authentication)
 */
router.get('/', getReminders);

/**
 * @route   POST /api/reminders/send
 * @desc    Send a manual reminder for a specific document
 * @access  Private (requires Clerk authentication)
 * @body    { documentId, channel }
 */
router.post('/send', sendManualReminder);

/**
 * @route   GET /api/reminders/history/:documentId
 * @desc    Get reminder history for a specific document
 * @access  Private (requires Clerk authentication)
 */
router.get('/history/:documentId', getReminderHistory);

/**
 * @route   POST /api/reminders/trigger-cron
 * @desc    Manually trigger the reminder cron job (for testing)
 * @access  Private (requires Clerk authentication)
 */
router.post('/trigger-cron', triggerReminderCronManually);

export default router;
