import express from 'express';
import { sendTestEmail } from '../services/emailService.js';
import { sendTestSMS } from '../services/smsService.js';

const router = express.Router();

/**
 * Test email configuration
 * POST /api/test/email
 * Body: { "email": "test@example.com" }
 */
router.post('/email', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required',
      });
    }

    // Check environment variables
    const config = {
      SMTP_HOST: process.env.SMTP_HOST || 'NOT SET',
      SMTP_PORT: process.env.SMTP_PORT || 'NOT SET',
      SMTP_USER: process.env.SMTP_USER || 'NOT SET',
      SMTP_PASSWORD: process.env.SMTP_PASSWORD ? '***CONFIGURED***' : 'NOT SET',
    };

    console.log('Email Configuration:', config);

    // Try to send test email
    const result = await sendTestEmail(email);

    return res.status(200).json({
      success: true,
      message: `Test email sent successfully to ${email}`,
      config,
      result,
    });
  } catch (error) {
    console.error('Test email error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to send test email',
      error: error.message,
      stack: error.stack,
    });
  }
});

/**
 * Test SMS configuration
 * POST /api/test/sms
 * Body: { "phone": "+1234567890" }
 */
router.post('/sms', async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: 'Phone number is required',
      });
    }

    // Check environment variables
    const config = {
      TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID || 'NOT SET',
      TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN ? '***CONFIGURED***' : 'NOT SET',
      TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER || 'NOT SET',
    };

    console.log('SMS Configuration:', config);

    // Try to send test SMS
    const result = await sendTestSMS(phone);

    return res.status(200).json({
      success: true,
      message: `Test SMS sent successfully to ${phone}`,
      config,
      result,
    });
  } catch (error) {
    console.error('Test SMS error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to send test SMS',
      error: error.message,
      stack: error.stack,
    });
  }
});

/**
 * Check all environment variables
 * GET /api/test/config
 */
router.get('/config', (req, res) => {
  const config = {
    email: {
      SMTP_HOST: process.env.SMTP_HOST || 'NOT SET',
      SMTP_PORT: process.env.SMTP_PORT || 'NOT SET',
      SMTP_USER: process.env.SMTP_USER || 'NOT SET',
      SMTP_PASSWORD: process.env.SMTP_PASSWORD ? '***CONFIGURED***' : 'NOT SET',
    },
    sms: {
      TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID || 'NOT SET',
      TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN ? '***CONFIGURED***' : 'NOT SET',
      TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER || 'NOT SET',
    },
    other: {
      FRONTEND_URL: process.env.FRONTEND_URL || 'NOT SET',
      DATABASE_URL: process.env.DATABASE_URL ? '***CONFIGURED***' : 'NOT SET',
    },
  };

  return res.status(200).json({
    success: true,
    config,
  });
});

export default router;
