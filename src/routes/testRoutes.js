import express from 'express';
import { sendTestEmail, sendTeamInvitationEmail } from '../services/emailService.js';
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

/**
 * Test team invitation email with sample data
 * POST /api/test/team-invitation-email
 * Body: { "email": "test@example.com" }
 */
router.post('/team-invitation-email', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required',
      });
    }

    // Sample data for testing
    const sampleData = {
      email,
      firstName: 'John',
      lastName: 'Doe',
      inviterName: 'Jane Smith',
      companyName: 'Acme Transportation',
      role: 'HR_LEAD',
      invitationUrl: 'https://example.com/setup-password?token=sample-token-123',
    };

    console.log('Sending test team invitation email with data:', sampleData);

    // Send test email
    const result = await sendTeamInvitationEmail(sampleData);

    return res.status(200).json({
      success: true,
      message: `Test team invitation email sent successfully to ${email}`,
      result,
    });
  } catch (error) {
    console.error('Test team invitation email error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to send test team invitation email',
      error: error.message,
    });
  }
});

/**
 * Preview team invitation email HTML in browser
 * GET /api/test/team-invitation-preview
 */
router.get('/team-invitation-preview', (_req, res) => {
  // Sample data for preview
  const firstName = 'John';
  const lastName = 'Doe';
  const inviterName = 'Jane Smith';
  const companyName = 'Acme Transportation';
  const email = 'john.doe@example.com';
  const invitationUrl = 'https://example.com/setup-password?token=sample-token-123';

  // Format role for display
  const role = 'HR_LEAD';
  const roleDisplay = role
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');

  // Return the HTML template directly
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          line-height: 1.6;
          color: #1f2937;
          background-color: #f3f4f6;
        }
        .email-wrapper {
          width: 100%;
          background-color: #f3f4f6;
          padding: 40px 0;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          background-color: #ffffff;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.07);
        }
        .header {
          background: linear-gradient(135deg, #2563eb 0%, #3b82f6 50%, #60a5fa 100%);
          padding: 40px 30px;
          text-align: center;
        }
        .logo {
          max-width: 180px;
          height: auto;
          margin-bottom: 20px;
        }
        .header-title {
          color: #ffffff;
          font-size: 28px;
          font-weight: 700;
          margin: 0;
          text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
        .content {
          padding: 40px 30px;
        }
        .greeting {
          font-size: 18px;
          font-weight: 600;
          color: #1f2937;
          margin-bottom: 16px;
        }
        .text {
          color: #4b5563;
          margin-bottom: 16px;
          font-size: 15px;
        }
        .highlight-box {
          background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
          border-left: 4px solid #2563eb;
          padding: 20px;
          margin: 24px 0;
          border-radius: 8px;
        }
        .role-label {
          font-size: 13px;
          font-weight: 600;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 8px;
        }
        .role-badge {
          display: inline-block;
          background: linear-gradient(135deg, #2563eb 0%, #3b82f6 100%);
          color: #ffffff;
          padding: 10px 20px;
          border-radius: 8px;
          font-weight: 700;
          font-size: 16px;
          box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2);
        }
        .cta-container {
          text-align: center;
          margin: 32px 0;
        }
        .button {
          display: inline-block;
          padding: 16px 40px;
          background: linear-gradient(135deg, #2563eb 0%, #3b82f6 100%);
          color: #ffffff !important;
          text-decoration: none;
          border-radius: 10px;
          font-weight: 600;
          font-size: 16px;
          box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
          transition: all 0.3s ease;
        }
        .button:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(37, 99, 235, 0.4);
        }
        .link-box {
          background-color: #f9fafb;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 16px;
          margin: 20px 0;
        }
        .link-text {
          font-size: 13px;
          color: #6b7280;
          margin-bottom: 8px;
        }
        .link {
          word-break: break-all;
          color: #2563eb;
          font-size: 13px;
          text-decoration: none;
        }
        .info-box {
          background-color: #fef3c7;
          border-left: 4px solid #f59e0b;
          padding: 16px;
          margin: 24px 0;
          border-radius: 8px;
        }
        .info-text {
          color: #92400e;
          font-size: 14px;
          margin: 0;
        }
        .footer {
          background-color: #f9fafb;
          padding: 30px;
          border-top: 1px solid #e5e7eb;
          text-align: center;
        }
        .footer-text {
          font-size: 13px;
          color: #6b7280;
          margin-bottom: 8px;
        }
        .footer-link {
          color: #2563eb;
          text-decoration: none;
        }
        .divider {
          height: 1px;
          background-color: #e5e7eb;
          margin: 24px 0;
        }
        @media only screen and (max-width: 600px) {
          .email-wrapper {
            padding: 20px 0;
          }
          .header {
            padding: 30px 20px;
          }
          .header-title {
            font-size: 24px;
          }
          .content {
            padding: 30px 20px;
          }
          .button {
            padding: 14px 32px;
            font-size: 15px;
          }
        }
      </style>
    </head>
    <body>
      <div class="email-wrapper">
        <div class="container">
          <!-- Header with gradient background -->
          <div class="header">
            <!-- Company logo placeholder - will use text for now -->
            <h1 class="header-title">Complyo</h1>
          </div>

          <!-- Main content -->
          <div class="content">
            <p class="greeting">Hello ${firstName} ${lastName},</p>

            <p class="text">
              <strong>${inviterName}</strong> has invited you to join <strong>${companyName}</strong>'s team on Complyo, a comprehensive compliance management platform.
            </p>

            <!-- Role assignment box -->
            <div class="highlight-box">
              <div class="role-label">Your Assigned Role</div>
              <div class="role-badge">${roleDisplay}</div>
            </div>

            <p class="text">
              An account has been created for you with the email address: <strong>${email}</strong>
            </p>

            <p class="text">
              With Complyo, you can manage drivers, track documents, monitor compliance scores in real-time, and collaborate with your team—all in one place.
            </p>

            <div class="divider"></div>

            <p class="text" style="text-align: center; font-weight: 600;">
              To get started, set up your password:
            </p>

            <!-- CTA Button -->
            <div class="cta-container">
              <a href="${invitationUrl}" class="button">Set Up Your Password →</a>
            </div>

            <!-- Alternative link -->
            <div class="link-box">
              <p class="link-text">Or copy and paste this link into your browser:</p>
              <a href="${invitationUrl}" class="link">${invitationUrl}</a>
            </div>

            <!-- Important info box -->
            <div class="info-box">
              <p class="info-text">
                <strong>⏰ Important:</strong> This password setup link will expire in 7 days. Make sure to complete your setup soon!
              </p>
            </div>
          </div>

          <!-- Footer -->
          <div class="footer">
            <p class="footer-text">
              Once you've set your password, you can log in at:
              <a href="${process.env.FRONTEND_URL || 'https://complyo.io'}" class="footer-link">${process.env.FRONTEND_URL || 'https://complyo.io'}</a>
            </p>
            <p class="footer-text">
              Questions? Contact your team administrator at <strong>${companyName}</strong>.
            </p>
            <div class="divider"></div>
            <p class="footer-text" style="color: #9ca3af;">
              © ${new Date().getFullYear()} Complyo. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

/**
 * Preview welcome email HTML in browser
 * GET /api/test/welcome-preview
 */
router.get('/welcome-preview', (_req, res) => {
  // Sample data for preview
  const firstName = 'Sarah';
  const companyName = 'Acme Transportation';
  const dashboardUrl = process.env.FRONTEND_URL || 'https://complyo.io/dashboard';

  // Return the HTML template directly
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          line-height: 1.6;
          color: #1f2937;
          background-color: #f3f4f6;
        }
        .email-wrapper {
          width: 100%;
          background-color: #f3f4f6;
          padding: 40px 0;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          background-color: #ffffff;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.07);
        }
        .header {
          background: linear-gradient(135deg, #2563eb 0%, #3b82f6 50%, #60a5fa 100%);
          padding: 40px 30px;
          text-align: center;
        }
        .header-title {
          color: #ffffff;
          font-size: 28px;
          font-weight: 700;
          margin: 0;
          text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
        .content {
          padding: 40px 30px;
        }
        .greeting {
          font-size: 18px;
          font-weight: 600;
          color: #1f2937;
          margin-bottom: 16px;
        }
        .text {
          color: #4b5563;
          margin-bottom: 16px;
          font-size: 15px;
        }
        .success-box {
          background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%);
          border-left: 4px solid #10b981;
          padding: 20px;
          margin: 24px 0;
          border-radius: 8px;
        }
        .success-text {
          color: #065f46;
          font-size: 15px;
          margin: 0;
        }
        .features {
          background-color: #f9fafb;
          padding: 24px;
          border-radius: 8px;
          margin: 24px 0;
          border: 1px solid #e5e7eb;
        }
        .features-title {
          color: #1f2937;
          font-size: 16px;
          font-weight: 600;
          margin-bottom: 16px;
        }
        .feature-item {
          color: #4b5563;
          margin: 12px 0;
          padding-left: 28px;
          position: relative;
          font-size: 15px;
        }
        .feature-item:before {
          content: "✓";
          position: absolute;
          left: 0;
          color: #2563eb;
          font-weight: bold;
          font-size: 18px;
        }
        .cta-container {
          text-align: center;
          margin: 32px 0;
        }
        .button {
          display: inline-block;
          padding: 16px 40px;
          background: linear-gradient(135deg, #2563eb 0%, #3b82f6 100%);
          color: #ffffff !important;
          text-decoration: none;
          border-radius: 10px;
          font-weight: 600;
          font-size: 16px;
          box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
          transition: all 0.3s ease;
        }
        .button:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(37, 99, 235, 0.4);
        }
        .footer {
          background-color: #f9fafb;
          padding: 30px;
          border-top: 1px solid #e5e7eb;
          text-align: center;
        }
        .footer-text {
          font-size: 13px;
          color: #6b7280;
          margin-bottom: 8px;
        }
        .footer-link {
          color: #2563eb;
          text-decoration: none;
        }
        .divider {
          height: 1px;
          background-color: #e5e7eb;
          margin: 24px 0;
        }
        @media only screen and (max-width: 600px) {
          .email-wrapper {
            padding: 20px 0;
          }
          .header {
            padding: 30px 20px;
          }
          .header-title {
            font-size: 24px;
          }
          .content {
            padding: 30px 20px;
          }
          .button {
            padding: 14px 32px;
            font-size: 15px;
          }
        }
      </style>
    </head>
    <body>
      <div class="email-wrapper">
        <div class="container">
          <!-- Header with gradient background -->
          <div class="header">
            <h1 class="header-title">🎉 Welcome to Complyo</h1>
          </div>

          <!-- Main content -->
          <div class="content">
            <p class="greeting">Hello ${firstName},</p>

            <p class="text">
              We're thrilled to have you join <strong>${companyName}</strong> on Complyo, your comprehensive compliance management platform.
            </p>

            <!-- Success message box -->
            <div class="success-box">
              <p class="success-text">
                <strong>✓ Onboarding Complete!</strong> You've successfully completed the onboarding process and accepted all necessary policies.
              </p>
            </div>

            <!-- Features section -->
            <div class="features">
              <div class="features-title">What you can do now:</div>
              <div class="feature-item">Manage and track driver documents</div>
              <div class="feature-item">Monitor compliance scores in real-time</div>
              <div class="feature-item">Set up automated reminders for expiring documents</div>
              <div class="feature-item">Generate comprehensive compliance reports</div>
              <div class="feature-item">Collaborate seamlessly with your team</div>
            </div>

            <div class="divider"></div>

            <p class="text" style="text-align: center; font-weight: 600;">
              Ready to get started? Access your dashboard:
            </p>

            <!-- CTA Button -->
            <div class="cta-container">
              <a href="${dashboardUrl}" class="button">Go to Dashboard →</a>
            </div>

            <p class="text" style="text-align: center;">
              If you have any questions or need assistance, our support team is here to help.
            </p>
          </div>

          <!-- Footer -->
          <div class="footer">
            <p class="footer-text">
              <strong>Need help?</strong> Contact support at <a href="mailto:support@complyo.io" class="footer-link">support@complyo.io</a>
            </p>
            <p class="footer-text">
              You're receiving this email because you recently completed onboarding for Complyo.
            </p>
            <div class="divider"></div>
            <p class="footer-text" style="color: #9ca3af;">
              © ${new Date().getFullYear()} Complyo. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

export default router;
