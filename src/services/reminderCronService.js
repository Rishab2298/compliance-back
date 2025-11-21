import cron from 'node-cron';
import prisma from '../../prisma/client.js';
import { sendEmail } from './emailService.js';
import { sendSMS } from './smsService.js';

// Mutex locks to prevent overlapping executions
let isDailyReminderRunning = false;
let isCustomReminderRunning = false;

/**
 * Helper function to create random delay between sends
 * Helps avoid spam detection and rate limits
 * @param {number} min - Minimum delay in milliseconds (default: 1000ms = 1s)
 * @param {number} max - Maximum delay in milliseconds (default: 5000ms = 5s)
 */
const randomDelay = (min = 1000, max = 5000) => {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise(resolve => setTimeout(resolve, delay));
};

/**
 * Daily cron job to send document expiry reminders
 * Runs every day at 8:00 AM
 */
export const startReminderCronJob = () => {
  // Run daily at 8:00 AM for document expiry reminders
  // Format: minute hour day month weekday
  // '0 8 * * *' = At 8:00 AM every day
  cron.schedule('0 8 * * *', async () => {
    // Check if previous execution is still running
    if (isDailyReminderRunning) {
      console.log('⚠️ Skipping daily reminders job - previous execution still running');
      return;
    }

    isDailyReminderRunning = true;
    const startTime = Date.now();
    console.log('🔔 Running daily document expiry reminders cron job...', new Date().toISOString());

    try {
      await sendDailyReminders();
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`✅ Daily reminders job completed successfully in ${duration}s`);
    } catch (error) {
      console.error('❌ Error in daily reminders job:', error);
    } finally {
      isDailyReminderRunning = false;
    }
  }, {
    timezone: 'America/New_York' // Adjust to your timezone
  });

  // Run every 15 minutes to check for custom reminders (increased from 10 to reduce load)
  // '*/15 * * * *' = Every 15 minutes
  cron.schedule('*/15 * * * *', () => {
    // Check if previous execution is still running
    if (isCustomReminderRunning) {
      console.log('⚠️ Skipping custom reminders check - previous execution still running');
      return;
    }

    // Run async without blocking cron scheduler
    (async () => {
      isCustomReminderRunning = true;
      const startTime = Date.now();
      console.log('🔔 Checking custom reminders...', new Date().toISOString());

      try {
        await checkAndSendCustomReminders();
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`✅ Custom reminders check completed in ${duration}s`);
      } catch (error) {
        console.error('❌ Error checking custom reminders:', error);
      } finally {
        isCustomReminderRunning = false;
      }
    })();
  }, {
    timezone: 'America/New_York' // Adjust to your timezone
  });

  console.log('✅ Reminder cron jobs scheduled:');
  console.log('   - Document expiry reminders: Daily at 8:00 AM');
  console.log('   - Custom reminders check: Every 15 minutes');
};

/**
 * Main function to send daily reminders
 * Processes all companies and sends notifications for expiring documents
 */
async function sendDailyReminders() {
  const stats = {
    companiesProcessed: 0,
    remindersChecked: 0,
    remindersSent: 0,
    remindersFailed: 0,
    remindersSkipped: 0,
  };

  try {
    // Get all companies with reminder settings configured
    const companies = await prisma.company.findMany({
      where: {
        reminderDays: {
          isEmpty: false,
        },
      },
      include: {
        drivers: {
          include: {
            documents: {
              where: {
                status: { in: ['ACTIVE', 'EXPIRING_SOON'] },
                expiryDate: { not: null },
              },
            },
          },
        },
        adminUser: true,
      },
    });

    console.log(`📊 Found ${companies.length} companies with reminder settings`);

    // ✅ OPTIMIZATION: Batch load all existing reminders in ONE query
    // Collect all document IDs from all companies
    const allDocumentIds = companies.flatMap(company =>
      company.drivers.flatMap(driver =>
        driver.documents.map(doc => doc.id)
      )
    );

    console.log(`📊 Total documents to check: ${allDocumentIds.length}`);

    // Load all recent reminders in a single query
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const existingReminders = await prisma.documentReminder.findMany({
      where: {
        documentId: { in: allDocumentIds },
        sentAt: { not: null },
        createdAt: { gte: sevenDaysAgo },
      },
      select: {
        documentId: true,
        daysBeforeExpiry: true,
      },
    });

    console.log(`📊 Found ${existingReminders.length} existing reminders (last 7 days)`);

    // Create lookup map for O(1) access: "documentId-daysBeforeExpiry" -> true
    const reminderMap = new Map();
    existingReminders.forEach(reminder => {
      const key = `${reminder.documentId}-${reminder.daysBeforeExpiry}`;
      reminderMap.set(key, true);
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const company of companies) {
      stats.companiesProcessed++;
      console.log(`\n🏢 Processing company: ${company.name} (${company.id})`);

      const reminderDays = company.reminderDays || [];
      console.log(`  Reminder intervals: ${reminderDays.join(', ')}`);

      // Process each reminder interval (e.g., "7d", "30d")
      for (const reminderDay of reminderDays) {
        const daysCount = parseInt(reminderDay.replace('d', ''));

        // Calculate target expiry date
        const targetDate = new Date(today);
        targetDate.setDate(targetDate.getDate() + daysCount);

        // Create date range for matching
        const startDate = new Date(targetDate);
        startDate.setHours(0, 0, 0, 0);

        const endDate = new Date(targetDate);
        endDate.setHours(23, 59, 59, 999);

        console.log(`  Checking for documents expiring in ${daysCount} days (${targetDate.toDateString()})`);

        // Find documents expiring on this target date
        for (const driver of company.drivers) {
          for (const document of driver.documents) {
            if (!document.expiryDate) continue;

            const expiryDate = new Date(document.expiryDate);
            expiryDate.setHours(0, 0, 0, 0);

            // Check if document expires on target date
            if (expiryDate >= startDate && expiryDate <= endDate) {
              stats.remindersChecked++;

              // ✅ O(1) lookup in memory map instead of database query
              const reminderKey = `${document.id}-${daysCount}`;
              const existingReminder = reminderMap.get(reminderKey);

              if (existingReminder) {
                console.log(`    ⏭️  Skipping: ${document.type} for ${driver.name} (already sent)`);
                stats.remindersSkipped++;
                continue;
              }

              // Send reminders based on notification settings
              const success = await sendReminderNotifications(
                company,
                driver,
                document,
                daysCount
              );

              if (success) {
                stats.remindersSent++;
                console.log(`    ✅ Sent: ${document.type} reminder to ${driver.name}`);

                // ✅ Add to map to prevent sending duplicate in same run
                reminderMap.set(reminderKey, true);

                // Add small delay between processing different documents
                await randomDelay(500, 2000);
              } else {
                stats.remindersFailed++;
                console.log(`    ❌ Failed: ${document.type} reminder to ${driver.name}`);
              }
            }
          }
        }
      }
    }

    // Log final stats
    console.log('\n📊 Daily Reminders Summary:');
    console.log(`  Companies processed: ${stats.companiesProcessed}`);
    console.log(`  Reminders checked: ${stats.remindersChecked}`);
    console.log(`  Reminders sent: ${stats.remindersSent}`);
    console.log(`  Reminders skipped (already sent): ${stats.remindersSkipped}`);
    console.log(`  Reminders failed: ${stats.remindersFailed}`);

    return stats;
  } catch (error) {
    console.error('Error in sendDailyReminders:', error);
    throw error;
  }
}

/**
 * Send reminder notifications via email and/or SMS
 * @param {Object} company - Company object
 * @param {Object} driver - Driver object
 * @param {Object} document - Document object
 * @param {number} daysUntilExpiry - Days until document expires
 * @returns {boolean} - True if at least one notification was sent successfully
 */
async function sendReminderNotifications(company, driver, document, daysUntilExpiry) {
  const notificationMethod = company.notificationMethod || 'email';
  const notificationRecipients = company.notificationRecipients || ['admin'];

  const shouldNotifyAdmin = notificationRecipients.includes('admin');
  const shouldNotifyDriver = notificationRecipients.includes('drivers');

  let emailSuccess = false;
  let smsSuccess = false;

  // Prepare message content
  const expiryDate = new Date(document.expiryDate).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const message = `Reminder: ${driver.name}'s ${document.type} (${document.documentNumber || 'N/A'}) expires in ${daysUntilExpiry} days on ${expiryDate}. Please ensure it is renewed before expiry.`;

  // Send email notifications
  if (notificationMethod === 'email' || notificationMethod === 'both') {
    const emailRecipients = [];

    if (shouldNotifyAdmin && company.adminEmail) {
      emailRecipients.push(company.adminEmail);
    }

    if (shouldNotifyDriver && driver.email) {
      emailRecipients.push(driver.email);
    }

    for (let i = 0; i < emailRecipients.length; i++) {
      const email = emailRecipients[i];
      try {
        await sendEmail({
          to: email,
          subject: `Document Expiry Reminder: ${document.type}`,
          text: message,
          html: `
            <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f9fafb;">
              <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 10px; padding: 30px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                <h2 style="color: #f59e0b; margin-top: 0;">⚠️ Document Expiry Reminder</h2>
                <p style="color: #374151; font-size: 16px; line-height: 1.6;">
                  This is a reminder that the following document is expiring soon:
                </p>
                <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 5px;">
                  <p style="margin: 5px 0;"><strong>Driver:</strong> ${driver.name}</p>
                  <p style="margin: 5px 0;"><strong>Document:</strong> ${document.type}</p>
                  <p style="margin: 5px 0;"><strong>Document Number:</strong> ${document.documentNumber || 'N/A'}</p>
                  <p style="margin: 5px 0;"><strong>Expiry Date:</strong> ${expiryDate}</p>
                  <p style="margin: 5px 0;"><strong>Days Remaining:</strong> ${daysUntilExpiry} days</p>
                </div>
                <p style="color: #374151; font-size: 14px;">
                  Please ensure this document is renewed before the expiry date to maintain compliance.
                </p>
                <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
                <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                  This is an automated reminder from ${company.name}'s compliance management system.
                </p>
              </div>
            </div>
          `,
        });
        emailSuccess = true;

        // Add random delay between emails (1-5 seconds) to avoid spam detection
        if (i < emailRecipients.length - 1) {
          const delayMs = Math.floor(Math.random() * 4000) + 1000;
          console.log(`    ⏳ Waiting ${(delayMs / 1000).toFixed(1)}s before next email...`);
          await randomDelay(1000, 5000);
        }
      } catch (error) {
        console.error(`Failed to send email to ${email}:`, error.message);
      }
    }
  }

  // Send SMS notifications
  if (notificationMethod === 'sms' || notificationMethod === 'both') {
    const smsRecipients = [];

    if (shouldNotifyAdmin && company.adminPhone) {
      smsRecipients.push(company.adminPhone);
    }

    if (shouldNotifyDriver && driver.phone) {
      smsRecipients.push(driver.phone);
    }

    const smsMessage = `[${company.name}] Document Expiry Alert: ${driver.name}'s ${document.type} expires in ${daysUntilExpiry} days (${expiryDate}). Please renew before expiry.`;

    for (let i = 0; i < smsRecipients.length; i++) {
      const phone = smsRecipients[i];
      try {
        await sendSMS(phone, smsMessage);
        smsSuccess = true;

        // Add random delay between SMS (1-5 seconds) to avoid spam detection
        if (i < smsRecipients.length - 1) {
          const delayMs = Math.floor(Math.random() * 4000) + 1000;
          console.log(`    ⏳ Waiting ${(delayMs / 1000).toFixed(1)}s before next SMS...`);
          await randomDelay(1000, 5000);
        }
      } catch (error) {
        console.error(`Failed to send SMS to ${phone}:`, error.message);
      }
    }
  }

  // Record the reminder in database
  const success = emailSuccess || smsSuccess;

  try {
    await prisma.documentReminder.create({
      data: {
        documentId: document.id,
        daysBeforeExpiry: daysUntilExpiry,
        scheduledAt: new Date(),
        sentAt: success ? new Date() : null,
        status: success ? 'SENT' : 'FAILED',
        channel: notificationMethod === 'email' ? 'EMAIL' : notificationMethod === 'sms' ? 'SMS' : 'EMAIL',
        message: message,
      },
    });
  } catch (error) {
    console.error('Failed to record reminder in database:', error);
  }

  return success;
}

/**
 * Check and send custom reminders that are due
 * Runs every 15 minutes
 * Optimized to complete quickly to avoid missing executions
 */
async function checkAndSendCustomReminders() {
  const stats = {
    remindersChecked: 0,
    remindersSent: 0,
    remindersFailed: 0,
  };

  try {
    const now = new Date();

    // Optimize: Only fetch reminders from the last 31 days to avoid scanning old data
    const oneMonthAgo = new Date(now);
    oneMonthAgo.setDate(oneMonthAgo.getDate() - 31);

    // Find all active custom reminders that are due
    // Optimized with date range and limited fields to reduce query time
    const dueReminders = await prisma.customReminder.findMany({
      where: {
        isActive: true,
        triggerDate: {
          gte: oneMonthAgo, // Not older than 31 days
          lte: now, // Trigger date is in the past or now
        },
      },
      include: {
        company: {
          select: {
            id: true,
            name: true,
            adminEmail: true,
            adminPhone: true,
          },
        },
      },
      take: 50, // Limit to 50 reminders per execution to prevent long-running jobs
    });

    if (dueReminders.length === 0) {
      console.log('📊 No custom reminders due at this time');
      return stats;
    }

    console.log(`📊 Found ${dueReminders.length} potentially due custom reminders`);

    // Process reminders with Promise.all for better performance
    const reminderPromises = dueReminders.map(async (reminder) => {
      stats.remindersChecked++;

      // Check if we should send this reminder based on frequency
      if (!shouldSendReminder(reminder, now)) {
        console.log(`  ⏭️  Skipping: "${reminder.title}" (not time to send yet)`);
        return { success: false, skipped: true };
      }

      // Send the reminder
      const success = await sendCustomReminderNotification(reminder);

      if (success) {
        stats.remindersSent++;
        console.log(`  ✅ Sent custom reminder: "${reminder.title}"`);

        // Update lastSent timestamp and deactivate if one-time
        const updateData = {
          lastSent: now,
        };

        if (reminder.frequency === 'ONCE') {
          updateData.isActive = false;
        }

        await prisma.customReminder.update({
          where: { id: reminder.id },
          data: updateData,
        });

        if (reminder.frequency === 'ONCE') {
          console.log(`  🔒 Deactivated one-time reminder: "${reminder.title}"`);
        }

        return { success: true };
      } else {
        stats.remindersFailed++;
        console.log(`  ❌ Failed to send custom reminder: "${reminder.title}"`);
        return { success: false };
      }
    });

    // Wait for all reminders to be processed (with timeout protection)
    await Promise.race([
      Promise.all(reminderPromises),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Custom reminders processing timeout (5 minutes)')), 5 * 60 * 1000)
      ),
    ]);

    // Log stats
    console.log('\n📊 Custom Reminders Summary:');
    console.log(`  Reminders checked: ${stats.remindersChecked}`);
    console.log(`  Reminders sent: ${stats.remindersSent}`);
    console.log(`  Reminders failed: ${stats.remindersFailed}`);

    return stats;
  } catch (error) {
    console.error('Error in checkAndSendCustomReminders:', error);
    throw error;
  }
}

/**
 * Determine if a reminder should be sent based on its frequency and last sent time
 * @param {Object} reminder - Custom reminder object
 * @param {Date} now - Current date/time
 * @returns {boolean} - True if reminder should be sent
 */
function shouldSendReminder(reminder, now) {
  // If never sent before, send it
  if (!reminder.lastSent) {
    return true;
  }

  // For one-time reminders that have been sent, don't send again
  if (reminder.frequency === 'ONCE') {
    return false;
  }

  const lastSent = new Date(reminder.lastSent);
  const hoursSinceLastSent = (now - lastSent) / (1000 * 60 * 60);

  switch (reminder.frequency) {
    case 'DAILY':
      // Send if it's been at least 23 hours (to account for cron timing)
      return hoursSinceLastSent >= 23;

    case 'WEEKLY':
      // Send if it's been at least 7 days (167 hours)
      return hoursSinceLastSent >= 167;

    case 'MONTHLY':
      // Send if it's been at least 30 days (720 hours)
      return hoursSinceLastSent >= 720;

    default:
      return false;
  }
}

/**
 * Send a custom reminder notification via email and/or SMS
 * @param {Object} reminder - Custom reminder object with company relation
 * @returns {boolean} - True if at least one notification was sent successfully
 */
async function sendCustomReminderNotification(reminder) {
  const { company } = reminder;
  const notificationType = reminder.notificationType || 'BOTH';

  let emailSuccess = false;
  let smsSuccess = false;

  // Prepare message content
  const priorityEmoji = {
    HIGH: '🔴',
    NORMAL: '🟡',
    LOW: '🔵',
  };

  const emoji = priorityEmoji[reminder.priority] || '🔔';

  const subject = `${emoji} Reminder: ${reminder.title}`;
  const textMessage = `${subject}\n\n${reminder.description || ''}\n\nPriority: ${reminder.priority}\nScheduled for: ${new Date(reminder.triggerDate).toLocaleString()}`;

  // Send email notification
  if ((notificationType === 'EMAIL' || notificationType === 'BOTH') && company.adminEmail) {
    try {
      await sendEmail({
        to: company.adminEmail,
        subject: subject,
        text: textMessage,
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f9fafb;">
            <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 10px; padding: 30px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <h2 style="color: ${reminder.priority === 'HIGH' ? '#ef4444' : reminder.priority === 'NORMAL' ? '#f59e0b' : '#3b82f6'}; margin-top: 0;">
                ${emoji} Custom Reminder
              </h2>
              <h3 style="color: #111827; font-size: 20px; margin: 10px 0;">
                ${reminder.title}
              </h3>
              ${reminder.description ? `
                <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 20px 0;">
                  ${reminder.description}
                </p>
              ` : ''}
              <div style="background-color: #f3f4f6; padding: 15px; margin: 20px 0; border-radius: 5px;">
                <p style="margin: 5px 0;"><strong>Priority:</strong> ${reminder.priority}</p>
                <p style="margin: 5px 0;"><strong>Scheduled for:</strong> ${new Date(reminder.triggerDate).toLocaleString()}</p>
                ${reminder.frequency !== 'ONCE' ? `<p style="margin: 5px 0;"><strong>Frequency:</strong> ${reminder.frequency}</p>` : ''}
              </div>
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
              <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                This is an automated custom reminder from ${company.name}.
              </p>
            </div>
          </div>
        `,
      });
      emailSuccess = true;
    } catch (error) {
      console.error(`Failed to send custom reminder email to ${company.adminEmail}:`, error.message);
    }
  }

  // Send SMS notification
  if ((notificationType === 'SMS' || notificationType === 'BOTH') && company.adminPhone) {
    const smsMessage = `[${company.name}] ${emoji} Reminder: ${reminder.title}${reminder.description ? ` - ${reminder.description.substring(0, 100)}` : ''}`;

    try {
      await sendSMS(company.adminPhone, smsMessage);
      smsSuccess = true;
    } catch (error) {
      console.error(`Failed to send custom reminder SMS to ${company.adminPhone}:`, error.message);
    }
  }

  return emailSuccess || smsSuccess;
}

/**
 * Manual trigger for testing (can be called via API endpoint)
 * @returns {Promise} - Stats from the job execution
 */
export const triggerReminderJobManually = async () => {
  console.log('🔔 Manually triggering reminders job...');
  return await sendDailyReminders();
};
