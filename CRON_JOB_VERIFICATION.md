# Cron Job Verification Guide

This guide will help you verify that the reminder cron jobs are properly set up and working.

## 1. Check Server Startup Logs

When you start the backend server, you should see this message in the console:

```
✅ Reminder cron job scheduled: Daily at 8:00 AM
```

**How to check:**
```bash
cd backend
npm start
```

Look for the green checkmark message. This confirms the cron job has been registered.

## 2. Verify Cron Schedule

The cron job is configured to run:
- **Time:** 8:00 AM daily
- **Timezone:** America/New_York
- **Cron Expression:** `0 8 * * *`

You can modify the schedule in:
`backend/src/services/reminderCronService.js` (line 14)

### Anti-Spam Protection

The system includes built-in delays to prevent spam detection:
- **Between emails:** Random delay of 1-5 seconds
- **Between SMS:** Random delay of 1-5 seconds
- **Between documents:** Random delay of 0.5-2 seconds

This ensures:
- ✅ Email providers don't flag you as spam
- ✅ Twilio rate limits aren't exceeded
- ✅ Natural sending pattern (appears human-like)
- ✅ Better email deliverability

**Example console output:**
```
✅ Sent: CDL reminder to John Doe
⏳ Waiting 3.2s before next email...
✅ Sent: Insurance reminder to Jane Smith
⏳ Waiting 1.8s before next email...
```

## 3. Manual Testing (Recommended)

Instead of waiting until 8:00 AM, you can manually trigger the cron job:

### Option A: Using the API Endpoint

**Endpoint:** `POST /api/reminders/trigger-cron`

**Using curl:**
```bash
curl -X POST http://localhost:5000/api/reminders/trigger-cron \
  -H "Authorization: Bearer YOUR_CLERK_TOKEN" \
  -H "Content-Type: application/json"
```

**Using Postman or Thunder Client:**
1. Method: POST
2. URL: `http://localhost:5000/api/reminders/trigger-cron`
3. Headers: Add your Clerk authentication token
4. Send the request

**Expected Response:**
```json
{
  "success": true,
  "message": "Reminder cron job executed successfully",
  "stats": {
    "companiesProcessed": 1,
    "remindersChecked": 5,
    "remindersSent": 3,
    "remindersSkipped": 2,
    "remindersFailed": 0
  }
}
```

### Option B: Create a Test Button in Frontend

You can add a test button in your settings page to trigger the cron manually.

## 4. Check Console Logs During Execution

When the cron job runs (either scheduled or manual), you'll see detailed logs:

```
🔔 Running daily reminders cron job... 2025-01-26T08:00:00.000Z

📊 Found 3 companies with reminder settings

🏢 Processing company: ABC Logistics (company-id-123)
  Reminder intervals: 7d, 30d
  Checking for documents expiring in 7 days (Feb 02 2025)
    ✅ Sent: CDL reminder to John Doe
    ⏭️  Skipping: Insurance for Jane Smith (already sent)
  Checking for documents expiring in 30 days (Feb 25 2025)
    ✅ Sent: Medical Card reminder to Bob Johnson

📊 Daily Reminders Summary:
  Companies processed: 3
  Reminders checked: 15
  Reminders sent: 8
  Reminders skipped (already sent): 5
  Reminders failed: 2

✅ Daily reminders job completed successfully
```

## 5. Verify Database Records

Check the `DocumentReminder` table to see if reminders are being recorded:

```bash
# Using Prisma Studio
npx prisma studio

# Or using SQL
# Check recent reminders
SELECT * FROM "DocumentReminder"
ORDER BY "createdAt" DESC
LIMIT 10;
```

Each reminder should have:
- `documentId`: The document that triggered the reminder
- `daysBeforeExpiry`: When it was sent (e.g., 7, 30)
- `sentAt`: Timestamp when sent
- `status`: "SENT" or "FAILED"
- `channel`: "EMAIL" or "SMS"
- `message`: The reminder message content

## 6. Test Email/SMS Delivery

To verify emails and SMS are actually being sent:

### For Email:
1. Make sure these environment variables are set in `.env`:
   ```
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your-email@gmail.com
   SMTP_PASSWORD=your-app-password
   ```

2. Check your email inbox/spam folder
3. Check the console for email sending logs:
   ```
   Email sent successfully: <message-id>
   ```

### For SMS:
1. Make sure these environment variables are set in `.env`:
   ```
   TWILIO_ACCOUNT_SID=your-account-sid
   TWILIO_AUTH_TOKEN=your-auth-token
   TWILIO_PHONE_NUMBER=+1234567890
   ```

2. Check your phone for the SMS
3. Check the console for SMS sending logs:
   ```
   SMS sent successfully: SM1234567890abcdef
   ```

## 7. Common Issues and Solutions

### Cron job not running at scheduled time
- **Check server timezone:** The cron uses `America/New_York` timezone by default
- **Verify server is running:** The cron only runs when the Node.js server is active
- **Check for errors:** Look for error messages in the server console

### No reminders being sent
- **Check company settings:** Verify reminder intervals are configured
- **Check document expiry dates:** Ensure documents are expiring on the target dates
- **Check duplicate prevention:** Reminders won't be sent if already sent in the last 7 days
- **Verify email/SMS credentials:** Check your SMTP and Twilio configuration

### Reminders failing
- **Email failures:** Check SMTP credentials and server connection
- **SMS failures:** Verify Twilio account balance and phone number format
- **Check console errors:** Look for specific error messages in the logs

## 8. Testing Checklist

- [ ] Server starts without errors
- [ ] See "✅ Reminder cron job scheduled" message
- [ ] Manual trigger endpoint works (`POST /api/reminders/trigger-cron`)
- [ ] Console shows detailed execution logs
- [ ] Database records are created in `DocumentReminder` table
- [ ] Emails are received (check inbox and spam)
- [ ] SMS messages are received
- [ ] Reminder history appears in driver detail page
- [ ] Duplicate reminders are prevented (same reminder not sent twice)

## 9. Production Deployment

When deploying to production:

1. **Set the correct timezone** in `reminderCronService.js`
2. **Ensure server runs 24/7** (use PM2, Docker, or cloud service)
3. **Monitor logs** for any failures
4. **Set up alerts** for critical failures
5. **Test thoroughly** in staging environment first

## 10. Monitoring and Maintenance

### Daily Monitoring:
- Check server logs for cron execution
- Verify reminder counts match expectations
- Monitor email/SMS delivery rates

### Weekly Review:
- Check `DocumentReminder` table for patterns
- Review failed reminders and investigate causes
- Adjust reminder intervals based on company feedback

### Monthly Audit:
- Review overall reminder effectiveness
- Update notification templates if needed
- Optimize cron job performance if processing many companies

---

## Quick Start Testing

**Fastest way to verify everything works:**

1. Start the backend server:
   ```bash
   cd backend
   npm start
   ```

2. Look for the "✅ Reminder cron job scheduled" message

3. In a new terminal or API client, trigger manually:
   ```bash
   curl -X POST http://localhost:5000/api/reminders/trigger-cron \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

4. Check the console logs for execution details

5. Verify reminder history in the driver detail page

That's it! If all steps pass, your cron job is working correctly. ✅
