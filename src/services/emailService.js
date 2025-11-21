import nodemailer from 'nodemailer';

// Create reusable transporter
const createTransporter = () => {
  const config = {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  };

  // Log SMTP configuration (without password)
  console.log('📧 SMTP Configuration:', {
    host: config.host,
    port: config.port,
    user: config.auth.user,
    hasPassword: !!config.auth.pass
  });

  if (!config.auth.user || !config.auth.pass) {
    console.error('❌ SMTP credentials not configured! Please set SMTP_USER and SMTP_PASSWORD in .env');
  }

  return nodemailer.createTransport(config);
};

/**
 * Send driver invitation email with upload link
 * @param {Object} params - Email parameters
 * @param {string} params.email - Recipient email
 * @param {string} params.driverName - Driver's name
 * @param {string} params.uploadLink - Secure upload link
 * @param {string[]} params.requestedDocuments - List of requested documents
 * @param {string} params.companyName - Company name
 */
export const sendDriverInvitationEmail = async ({
  email,
  driverName,
  uploadLink,
  requestedDocuments,
  companyName,
}) => {
  try {
    const transporter = createTransporter();

    const documentList = requestedDocuments
      .map((doc) => `<li>${doc}</li>`)
      .join('');

    const mailOptions = {
      from: `"${companyName}" <${process.env.SMTP_USER}>`,
      to: email,
      subject: `Document Upload Request from ${companyName}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              color: #333;
            }
            .container {
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
              background-color: #f9f9f9;
            }
            .content {
              background-color: white;
              padding: 30px;
              border-radius: 8px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            .header {
              color: #2563eb;
              margin-bottom: 20px;
            }
            .button {
              display: inline-block;
              padding: 12px 30px;
              background-color: #2563eb;
              color: white;
              text-decoration: none;
              border-radius: 6px;
              margin: 20px 0;
            }
            .documents {
              background-color: #eff6ff;
              padding: 15px;
              border-radius: 6px;
              margin: 20px 0;
            }
            .footer {
              margin-top: 20px;
              font-size: 12px;
              color: #666;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="content">
              <h1 class="header">Document Upload Request</h1>
              <p>Hello ${driverName},</p>
              <p>${companyName} has requested you to upload the following documents:</p>

              <div class="documents">
                <h3>Required Documents:</h3>
                <ul>
                  ${documentList}
                </ul>
              </div>

              <p>Please click the button below to securely upload your documents:</p>

              <a href="${uploadLink}" class="button">Upload Documents</a>

              <p>Or copy and paste this link into your browser:</p>
              <p style="word-break: break-all; color: #2563eb;">${uploadLink}</p>

              <div class="footer">
                <p><strong>Note:</strong> This link will expire in 7 days. If you have any questions, please contact ${companyName} directly.</p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending email:', error);
    throw new Error(`Failed to send email: ${error.message}`);
  }
};

/**
 * Send generic email
 * @param {Object} params - Email parameters
 * @param {string} params.to - Recipient email
 * @param {string} params.subject - Email subject
 * @param {string} params.text - Plain text content
 * @param {string} params.html - HTML content (optional)
 */
export const sendEmail = async ({ to, subject, text, html }) => {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: process.env.SMTP_USER,
      to,
      subject,
      text,
      html: html || text,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending email:', error);
    throw new Error(`Failed to send email: ${error.message}`);
  }
};

/**
 * Send welcome email after policy acceptance
 * @param {Object} params - Email parameters
 * @param {string} params.email - Recipient email
 * @param {string} params.firstName - User's first name
 * @param {string} params.companyName - Company name
 * @param {string} params.role - User's role
 * @param {string} params.dashboardUrl - Dashboard URL
 */
export const sendWelcomeEmail = async ({
  email,
  firstName,
  companyName,
  role,
  dashboardUrl,
}) => {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: `"DSP ComplianceManager" <${process.env.SMTP_USER}>`,
      to: email,
      subject: `Welcome to DSP ComplianceManager - ${companyName}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              color: #333;
            }
            .container {
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
              background-color: #f9f9f9;
            }
            .content {
              background-color: white;
              padding: 30px;
              border-radius: 8px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            .header {
              background: linear-gradient(135deg, #2563eb 0%, #8b5cf6 50%, #a855f7 100%);
              -webkit-background-clip: text;
              -webkit-text-fill-color: transparent;
              background-clip: text;
              margin-bottom: 20px;
            }
            .button {
              display: inline-block;
              padding: 12px 30px;
              background: linear-gradient(135deg, #2563eb 0%, #8b5cf6 100%);
              color: white;
              text-decoration: none;
              border-radius: 6px;
              margin: 20px 0;
            }
            .features {
              background-color: #eff6ff;
              padding: 20px;
              border-radius: 6px;
              margin: 20px 0;
            }
            .feature-item {
              margin: 10px 0;
              padding-left: 20px;
              position: relative;
            }
            .feature-item:before {
              content: "✓";
              position: absolute;
              left: 0;
              color: #2563eb;
              font-weight: bold;
            }
            .footer {
              margin-top: 20px;
              font-size: 12px;
              color: #666;
              border-top: 1px solid #e5e7eb;
              padding-top: 20px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="content">
              <h1 class="header">Welcome to DSP ComplianceManager!</h1>
              <p>Hello ${firstName},</p>
              <p>We're thrilled to have you join <strong>${companyName}</strong> on DSP ComplianceManager. You've successfully completed the onboarding process and accepted all necessary policies.</p>

              <div class="features">
                <h3 style="color: #1f2937; margin-top: 0;">What you can do now:</h3>
                <div class="feature-item">Manage and track driver documents</div>
                <div class="feature-item">Monitor compliance scores in real-time</div>
                <div class="feature-item">Set up automated reminders for expiring documents</div>
                <div class="feature-item">Generate compliance reports</div>
                <div class="feature-item">Collaborate with your team</div>
              </div>

              <p>Click the button below to access your dashboard and get started:</p>

              <a href="${dashboardUrl}" class="button">Go to Dashboard</a>

              <p>If you have any questions or need assistance, our support team is here to help. Feel free to reach out to us anytime.</p>

              <div class="footer">
                <p><strong>Need help?</strong> Visit our Help Center or contact support at <a href="mailto:support@dspcompliance.com">support@dspcompliance.com</a></p>
                <p style="margin-top: 10px;">You're receiving this email because you recently completed onboarding for DSP ComplianceManager.</p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Welcome email sent successfully:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending welcome email:', error);
    throw new Error(`Failed to send welcome email: ${error.message}`);
  }
};

/**
 * Send team member invitation email
 * @param {Object} params - Email parameters
 * @param {string} params.email - Recipient email
 * @param {string} params.firstName - Recipient's first name
 * @param {string} params.lastName - Recipient's last name
 * @param {string} params.inviterName - Name of person who invited
 * @param {string} params.companyName - Company name
 * @param {string} params.role - DSP role assigned (e.g., "HR_LEAD")
 * @param {string} params.invitationUrl - Clerk invitation URL or signup URL
 */
export const sendTeamInvitationEmail = async ({
  email,
  firstName,
  lastName,
  inviterName,
  companyName,
  role,
  invitationUrl,
}) => {
  try {
    console.log('📧 Attempting to send team invitation email to:', email);
    console.log('   Recipient:', firstName, lastName);
    console.log('   Company:', companyName);
    console.log('   Role:', role);

    const transporter = createTransporter();

    // Format role for display
    const roleDisplay = role
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');

    const mailOptions = {
      from: `"${companyName}" <${process.env.SMTP_USER}>`,
      to: email,
      subject: `You've been invited to join ${companyName} on LogiLink`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              color: #333;
            }
            .container {
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
              background-color: #f9f9f9;
            }
            .content {
              background-color: white;
              padding: 30px;
              border-radius: 8px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            .header {
              color: #2563eb;
              margin-bottom: 20px;
            }
            .button {
              display: inline-block;
              padding: 12px 30px;
              background-color: #2563eb;
              color: white;
              text-decoration: none;
              border-radius: 6px;
              margin: 20px 0;
            }
            .role-badge {
              display: inline-block;
              background-color: #eff6ff;
              color: #2563eb;
              padding: 8px 16px;
              border-radius: 6px;
              font-weight: bold;
              margin: 10px 0;
            }
            .footer {
              margin-top: 30px;
              padding-top: 20px;
              border-top: 1px solid #e5e7eb;
              font-size: 12px;
              color: #666;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="content">
              <h1 class="header">Welcome to LogiLink!</h1>
              <p>Hello ${firstName} ${lastName},</p>
              <p><strong>${inviterName}</strong> has invited you to join <strong>${companyName}</strong>'s team on LogiLink.</p>

              <p>You've been assigned the role of:</p>
              <div class="role-badge">${roleDisplay}</div>

              <p>An account has been created for you with the email address: <strong>${email}</strong></p>

              <p>LogiLink is a comprehensive compliance management platform that helps companies manage drivers, documents, and compliance requirements efficiently.</p>

              <p>To get started, you need to set up your password. Click the button below:</p>

              <a href="${invitationUrl}" class="button">Set Your Password</a>

              <p>Or copy and paste this link into your browser:</p>
              <p style="word-break: break-all; color: #2563eb;">${invitationUrl}</p>

              <div class="footer">
                <p><strong>Note:</strong> This password setup link will expire in 7 days.</p>
                <p>Once you've set your password, you can log in at: <strong>${process.env.FRONTEND_URL || 'https://app.logilink.com'}</strong></p>
                <p>If you have any questions, please contact your team administrator.</p>
                <p>© ${new Date().getFullYear()} LogiLink. All rights reserved.</p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `,
    };

    console.log('📧 Sending email to:', email);
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Team invitation email sent successfully!');
    console.log('   Message ID:', info.messageId);
    console.log('   Recipient:', email);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Error sending team invitation email:', error);
    console.error('   Error details:', {
      message: error.message,
      code: error.code,
      command: error.command
    });
    throw new Error(`Failed to send team invitation email: ${error.message}`);
  }
};

/**
 * Send test email to verify configuration
 */
export const sendTestEmail = async (toEmail) => {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: process.env.SMTP_USER,
      to: toEmail,
      subject: 'Test Email from Complyo',
      text: 'This is a test email to verify your email configuration.',
    };

    const info = await transporter.sendMail(mailOptions);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending test email:', error);
    throw error;
  }
};
