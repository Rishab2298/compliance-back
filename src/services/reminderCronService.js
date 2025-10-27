import cron from 'node-cron';
import prisma from '../../prisma/client.js';
import { sendEmail } from './emailService.js';
import { sendSMS } from './smsService.js';

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
  // Run daily at 8:00 AM
  // Format: minute hour day month weekday
  // '0 8 * * *' = At 8:00 AM every day
  cron.schedule('0 8 * * *', async () => {
    console.log('🔔 Running daily reminders cron job...', new Date().toISOString());

    try {
      await sendDailyReminders();
      console.log('✅ Daily reminders job completed successfully');
    } catch (error) {
      console.error('❌ Error in daily reminders job:', error);
    }
  }, {
    timezone: 'America/New_York' // Adjust to your timezone
  });

  console.log('✅ Reminder cron job scheduled: Daily at 8:00 AM');
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

              // Check if reminder already sent for this document and interval
              const existingReminder = await prisma.documentReminder.findFirst({
                where: {
                  documentId: document.id,
                  daysBeforeExpiry: daysCount,
                  sentAt: { not: null },
                  // Only check reminders sent in the last 7 days to avoid duplicates
                  createdAt: {
                    gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
                  },
                },
              });

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
 * Manual trigger for testing (can be called via API endpoint)
 * @returns {Promise} - Stats from the job execution
 */
export const triggerReminderJobManually = async () => {
  console.log('🔔 Manually triggering reminders job...');
  return await sendDailyReminders();
};
