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
      .map((doc) => `<div class="document-item">${doc}</div>`)
      .join('');

    const mailOptions = {
      from: `"${companyName}" <${process.env.SMTP_USER}>`,
      to: email,
      subject: `Document Upload Request from ${companyName}`,
      html: `
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
            .header-icon {
              font-size: 48px;
              margin-bottom: 12px;
            }
            .header-title {
              color: #ffffff;
              font-size: 26px;
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
              padding: 24px;
              margin: 24px 0;
              border-radius: 8px;
            }
            .documents-title {
              color: #1e40af;
              font-size: 16px;
              font-weight: 600;
              margin-bottom: 16px;
            }
            .document-item {
              color: #1e40af;
              margin: 10px 0;
              padding-left: 28px;
              position: relative;
              font-size: 15px;
            }
            .document-item:before {
              content: "📄";
              position: absolute;
              left: 0;
              font-size: 16px;
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
            .security-box {
              background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%);
              border-left: 4px solid #10b981;
              padding: 16px;
              margin: 24px 0;
              border-radius: 8px;
            }
            .security-text {
              color: #065f46;
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
                font-size: 22px;
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
                <div class="header-icon">📋</div>
                <h1 class="header-title">Document Upload Request</h1>
              </div>

              <!-- Main content -->
              <div class="content">
                <p class="greeting">Hello ${driverName},</p>

                <p class="text">
                  <strong>${companyName}</strong> has requested you to upload the following documents for compliance verification.
                </p>

                <!-- Required documents box -->
                <div class="highlight-box">
                  <div class="documents-title">📝 Required Documents</div>
                  ${documentList}
                </div>

                <!-- Security information -->
                <div class="security-box">
                  <p class="security-text">
                    <strong>🔒 Secure Upload:</strong> Your documents will be encrypted and stored securely. Only authorized personnel at ${companyName} will have access.
                  </p>
                </div>

                <div class="divider"></div>

                <p class="text" style="text-align: center; font-weight: 600;">
                  Click the button below to securely upload your documents:
                </p>

                <!-- CTA Button -->
                <div class="cta-container">
                  <a href="${uploadLink}" class="button">Upload Documents →</a>
                </div>

                <!-- Alternative link -->
                <div class="link-box">
                  <p class="link-text">Or copy and paste this link into your browser:</p>
                  <a href="${uploadLink}" class="link">${uploadLink}</a>
                </div>

                <!-- Important info box -->
                <div class="info-box">
                  <p class="info-text">
                    <strong> Important:</strong> This upload link will expire in 7 days. Please complete your document upload soon. If you have any questions, contact ${companyName} directly.
                  </p>
                </div>
              </div>

              <!-- Footer -->
              <div class="footer">
                <p class="footer-text">
                  <strong>Need help?</strong> If you encounter any issues, please reach out to your contact at <strong>${companyName}</strong>.
                </p>
                <p class="footer-text">
                  This is an automated message from the ${companyName} compliance system.
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
 * Send admin notification email when driver uploads document
 * @param {Object} params - Email parameters
 * @param {string} params.email - Admin email
 * @param {string} params.adminName - Admin's name
 * @param {string} params.driverName - Driver who uploaded the document
 * @param {string} params.documentType - Type of document uploaded
 * @param {string} params.companyName - Company name
 * @param {string} params.reviewUrl - URL to review the document
 * @param {Date} params.uploadedAt - When the document was uploaded
 */
export const sendDocumentUploadNotificationEmail = async ({
  email,
  adminName,
  driverName,
  documentType,
  companyName,
  reviewUrl,
  uploadedAt,
}) => {
  try {
    const transporter = createTransporter();

    // Format document type for display
    // Handle both snake_case (e.g., "drivers_licence") and already formatted strings (e.g., "Driver's Licence, Insurance")
    const documentTypeDisplay = typeof documentType === 'string'
      ? (documentType.includes('_')
          ? documentType.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ')
          : documentType)
      : 'Unknown Document';

    // Format upload time
    const uploadTime = new Date(uploadedAt).toLocaleString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const mailOptions = {
      from: `"${companyName}" <${process.env.SMTP_USER}>`,
      to: email,
      subject: `New Document Uploaded: ${documentTypeDisplay} - ${driverName}`,
      html: `
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
              background: linear-gradient(135deg, #2563eb 0%, #8b5cf6 50%, #9333ea 100%);
              padding: 40px 30px;
              text-align: center;
            }
            .header-icon {
              font-size: 48px;
              margin-bottom: 12px;
            }
            .header-title {
              color: #ffffff;
              font-size: 26px;
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
              background: linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%);
              border-left: 4px solid #8b5cf6;
              padding: 24px;
              margin: 24px 0;
              border-radius: 8px;
            }
            .detail-row {
              display: flex;
              justify-content: space-between;
              margin: 12px 0;
              padding: 8px 0;
              border-bottom: 1px solid rgba(139, 92, 246, 0.2);
            }
            .detail-row:last-child {
              border-bottom: none;
            }
            .detail-label {
              font-weight: 600;
              color: #6b21a8;
              font-size: 14px;
            }
            .detail-value {
              color: #7c3aed;
              font-size: 14px;
              font-weight: 500;
            }
            .cta-container {
              text-align: center;
              margin: 32px 0;
            }
            .button {
              display: inline-block;
              padding: 16px 40px;
              background: linear-gradient(135deg, #2563eb 0%, #8b5cf6 50%, #9333ea 100%);
              color: #ffffff !important;
              text-decoration: none;
              border-radius: 10px;
              font-weight: 600;
              font-size: 16px;
              box-shadow: 0 4px 12px rgba(139, 92, 246, 0.4);
              transition: all 0.3s ease;
            }
            .button:hover {
              transform: translateY(-2px);
              box-shadow: 0 6px 16px rgba(139, 92, 246, 0.5);
            }
            .info-box {
              background-color: #faf5ff;
              border-left: 4px solid #8b5cf6;
              padding: 16px;
              margin: 24px 0;
              border-radius: 8px;
            }
            .info-text {
              color: #6b21a8;
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
              color: #8b5cf6;
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
                font-size: 22px;
              }
              .content {
                padding: 30px 20px;
              }
              .button {
                padding: 14px 32px;
                font-size: 15px;
              }
              .detail-row {
                flex-direction: column;
                gap: 4px;
              }
            }
          </style>
        </head>
        <body>
          <div class="email-wrapper">
            <div class="container">
              <!-- Header with gradient background -->
              <div class="header">
               
                <h1 class="header-title">New Document Uploaded</h1>
              </div>

              <!-- Main content -->
              <div class="content">
                <p class="greeting">Hello ${adminName},</p>

                <p class="text">
                  <strong>${driverName}</strong> has uploaded a new document to your compliance system.
                </p>

                <!-- Document details box -->
                <div class="highlight-box">
                  <div class="detail-row">
                    <span class="detail-label">Driver Name:</span>
                    <span class="detail-value">${driverName}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Document Type:</span>
                    <span class="detail-value">${documentTypeDisplay}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Uploaded At:</span>
                    <span class="detail-value">${uploadTime}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Status:</span>
                    <span class="detail-value">⏳ Pending Review</span>
                  </div>
                </div>

                <p class="text">
                  The document has been securely uploaded and is ready for your review. Please verify the document details and approve or reject it as needed.
                </p>

                <div class="divider"></div>

                <p class="text" style="text-align: center; font-weight: 600;">
                  Review and take action on this document:
                </p>

                <!-- CTA Button -->
                <div class="cta-container">
                  <a href="${reviewUrl}" class="button">Review Document →</a>
                </div>

                <!-- Info box -->
                <div class="info-box">
                  <p class="info-text">
                    <strong>💡 Quick Tip:</strong> Timely document review helps maintain compliance and keeps your drivers on track.
                  </p>
                </div>
              </div>

              <!-- Footer -->
              <div class="footer">
                <p class="footer-text">
                  Access your dashboard at:
                  <a href="${process.env.FRONTEND_URL || 'https://complyo.co'}/client/dashboard" class="footer-link">${process.env.FRONTEND_URL || 'https://complyo.co'}</a>
                </p>
                <p class="footer-text">
                  This is an automated notification from your ${companyName} compliance system.
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
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Document upload notification sent to ${email}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Error sending document upload notification email:', error);
    throw new Error(`Failed to send document upload notification: ${error.message}`);
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
      from: `"Complyo" <${process.env.SMTP_USER}>`,
      to: email,
      subject: `Welcome to Complyo - ${companyName}`,
      html: `
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
                <h1 class="header-title"> Welcome to Complyo</h1>
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
                  <strong>Need help?</strong> Contact support at <a href="mailto:support@complyo.co" class="footer-link">support@complyo.co</a>
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
      subject: `${inviterName} invited you to join ${companyName} on Complyo`,

      html: `
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
                    <strong> Important:</strong> This password setup link will expire in 7 days. Make sure to complete your setup soon!
                  </p>
                </div>
              </div>

              <!-- Footer -->
              <div class="footer">
                <p class="footer-text">
                  Once you've set your password, you can log in at:
                  <a href="${process.env.FRONTEND_URL || 'https://complyo.co'}" class="footer-link">${process.env.FRONTEND_URL || 'https://complyo.co'}</a>
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
 * Send complaint notification email
 * @param {Object} params - Email parameters
 * @param {string} params.name - Complainant name
 * @param {string} params.email - Complainant email
 * @param {string} params.subject - Complaint subject
 * @param {string} params.category - Complaint category
 * @param {string} params.priority - Complaint priority
 * @param {string} params.description - Complaint description
 */
export const sendComplaintEmail = async ({
  name,
  email,
  subject,
  category,
  priority,
  description,
}) => {
  try {
    console.log('📧 Sending complaint notification email...');

    const transporter = createTransporter();

    // Priority badge color
    const priorityColors = {
      low: { bg: '#d1fae5', border: '#10b981', text: '#065f46' },
      medium: { bg: '#fef3c7', border: '#f59e0b', text: '#92400e' },
      high: { bg: '#fee2e2', border: '#ef4444', text: '#991b1b' },
      urgent: { bg: '#fecaca', border: '#dc2626', text: '#7f1d1d' },
    };

    const priorityColor = priorityColors[priority.toLowerCase()] || priorityColors.medium;

    const mailOptions = {
      from: `"Complyo Complaints" <${process.env.SMTP_USER}>`,
      to: ['logilink.it@gmail.com', 
        'complaints@complyo.co'
      ],
      replyTo: email,
      subject: `New Complaint: ${subject}`,
      html: `
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
              background: linear-gradient(135deg, #dc2626 0%, #ef4444 50%, #f87171 100%);
              padding: 40px 30px;
              text-align: center;
            }
            .header-icon {
              font-size: 48px;
              margin-bottom: 12px;
            }
            .header-title {
              color: #ffffff;
              font-size: 26px;
              font-weight: 700;
              margin: 0;
              text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
            }
            .content {
              padding: 40px 30px;
            }
            .alert-box {
              background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%);
              border-left: 4px solid #dc2626;
              padding: 20px;
              margin-bottom: 24px;
              border-radius: 8px;
            }
            .alert-text {
              color: #7f1d1d;
              font-size: 15px;
              font-weight: 600;
            }
            .detail-section {
              margin: 24px 0;
            }
            .detail-row {
              display: flex;
              padding: 12px 0;
              border-bottom: 1px solid #e5e7eb;
            }
            .detail-row:last-child {
              border-bottom: none;
            }
            .detail-label {
              font-weight: 600;
              color: #4b5563;
              min-width: 120px;
              font-size: 14px;
            }
            .detail-value {
              color: #1f2937;
              font-size: 14px;
              flex: 1;
            }
            .priority-badge {
              display: inline-block;
              padding: 6px 14px;
              border-radius: 6px;
              font-weight: 700;
              font-size: 13px;
              text-transform: uppercase;
              background-color: ${priorityColor.bg};
              border: 2px solid ${priorityColor.border};
              color: ${priorityColor.text};
            }
            .description-box {
              background-color: #f9fafb;
              border: 1px solid #e5e7eb;
              border-radius: 8px;
              padding: 20px;
              margin: 24px 0;
            }
            .description-label {
              font-weight: 600;
              color: #4b5563;
              margin-bottom: 12px;
              font-size: 14px;
            }
            .description-text {
              color: #1f2937;
              line-height: 1.7;
              white-space: pre-wrap;
              font-size: 14px;
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
            .divider {
              height: 1px;
              background-color: #e5e7eb;
              margin: 24px 0;
            }
          </style>
        </head>
        <body>
          <div class="email-wrapper">
            <div class="container">
              <!-- Header -->
              <div class="header">
                
                <h1 class="header-title">New Complaint Received</h1>
              </div>

              <!-- Main content -->
              <div class="content">
                <div class="alert-box">
                  <p class="alert-text">
                    🔔 A new complaint has been submitted through the Complyo complaint registration form.
                  </p>
                </div>

                <!-- Complaint Details -->
                <div class="detail-section">
                  <div class="detail-row">
                    <span class="detail-label">Name:</span>
                    <span class="detail-value"><strong>${name}</strong></span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Email:</span>
                    <span class="detail-value"><a href="mailto:${email}" style="color: #2563eb; text-decoration: none;">${email}</a></span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Subject:</span>
                    <span class="detail-value"><strong>${subject}</strong></span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Category:</span>
                    <span class="detail-value">${category}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Priority:</span>
                    <span class="detail-value">
                      <span class="priority-badge">${priority}</span>
                    </span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Submitted:</span>
                    <span class="detail-value">${new Date().toLocaleString('en-US', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}</span>
                  </div>
                </div>

                <div class="divider"></div>

                <!-- Description -->
                <div class="description-box">
                  <div class="description-label">Complaint Description:</div>
                  <div class="description-text">${description}</div>
                </div>
              </div>

              <!-- Footer -->
              <div class="footer">
                <p class="footer-text">
                  <strong>Action Required:</strong> Please review this complaint and respond to the customer within 24-48 hours.
                </p>
                <p class="footer-text">
                  Reply directly to this email to contact: <a href="mailto:${email}" style="color: #2563eb; text-decoration: none;">${email}</a>
                </p>
                <div class="divider"></div>
                <p class="footer-text" style="color: #9ca3af;">
                  © ${new Date().getFullYear()} Complyo. Automated complaint notification.
                </p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Complaint email sent successfully to logilink.it@gmail.com and complaints@complyo.co');
    console.log('   Message ID:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Error sending complaint email:', error);
    throw new Error(`Failed to send complaint email: ${error.message}`);
  }
};

/**
 * Send contact form notification email
 * @param {Object} params - Email parameters
 * @param {string} params.name - Contact name
 * @param {string} params.email - Contact email
 * @param {string} params.phone - Contact phone (optional)
 * @param {string} params.company - Company name (optional)
 * @param {string} params.inquiryType - Type of inquiry
 * @param {string} params.subject - Contact subject
 * @param {string} params.message - Contact message
 */
export const sendContactEmail = async ({
  name,
  email,
  phone,
  company,
  inquiryType,
  subject,
  message,
}) => {
  try {
    console.log('📧 Sending contact form notification email...');

    const transporter = createTransporter();

    // Inquiry type badge color
    const inquiryColors = {
      sales: { bg: '#dbeafe', border: '#2563eb', text: '#1e40af' },
      enterprise: { bg: '#e0e7ff', border: '#6366f1', text: '#4338ca' },
      support: { bg: '#fef3c7', border: '#f59e0b', text: '#92400e' },
      partnership: { bg: '#d1fae5', border: '#10b981', text: '#065f46' },
      other: { bg: '#f3f4f6', border: '#6b7280', text: '#374151' },
    };

    const inquiryColor = inquiryColors[inquiryType.toLowerCase()] || inquiryColors.other;

    // Format inquiry type for display
    const inquiryTypeDisplay = inquiryType
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');

    const mailOptions = {
      from: `"Complyo Contact Form" <${process.env.SMTP_USER}>`,
      to: 'logilinkstaffing@gmail.com',
      replyTo: email,
      subject: `New Contact Form Submission: ${inquiryTypeDisplay} - ${subject}`,
      html: `
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
            .header-icon {
              font-size: 48px;
              margin-bottom: 12px;
            }
            .header-title {
              color: #ffffff;
              font-size: 26px;
              font-weight: 700;
              margin: 0;
              text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
            }
            .content {
              padding: 40px 30px;
            }
            .alert-box {
              background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
              border-left: 4px solid #2563eb;
              padding: 20px;
              margin-bottom: 24px;
              border-radius: 8px;
            }
            .alert-text {
              color: #1e40af;
              font-size: 15px;
              font-weight: 600;
            }
            .detail-section {
              margin: 24px 0;
            }
            .detail-row {
              display: flex;
              padding: 12px 0;
              border-bottom: 1px solid #e5e7eb;
            }
            .detail-row:last-child {
              border-bottom: none;
            }
            .detail-label {
              font-weight: 600;
              color: #4b5563;
              min-width: 140px;
              font-size: 14px;
            }
            .detail-value {
              color: #1f2937;
              font-size: 14px;
              flex: 1;
            }
            .inquiry-badge {
              display: inline-block;
              padding: 6px 14px;
              border-radius: 6px;
              font-weight: 700;
              font-size: 13px;
              text-transform: uppercase;
              background-color: ${inquiryColor.bg};
              border: 2px solid ${inquiryColor.border};
              color: ${inquiryColor.text};
            }
            .message-box {
              background-color: #f9fafb;
              border: 1px solid #e5e7eb;
              border-radius: 8px;
              padding: 20px;
              margin: 24px 0;
            }
            .message-label {
              font-weight: 600;
              color: #4b5563;
              margin-bottom: 12px;
              font-size: 14px;
            }
            .message-text {
              color: #1f2937;
              line-height: 1.7;
              white-space: pre-wrap;
              font-size: 14px;
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
            .divider {
              height: 1px;
              background-color: #e5e7eb;
              margin: 24px 0;
            }
          </style>
        </head>
        <body>
          <div class="email-wrapper">
            <div class="container">
              <!-- Header -->
              <div class="header">
                <div class="header-icon">📬</div>
                <h1 class="header-title">New Contact Form Submission</h1>
              </div>

              <!-- Main content -->
              <div class="content">
                <div class="alert-box">
                  <p class="alert-text">
                    🔔 A new inquiry has been submitted through the Complyo contact form.
                  </p>
                </div>

                <!-- Contact Details -->
                <div class="detail-section">
                  <div class="detail-row">
                    <span class="detail-label">Name:</span>
                    <span class="detail-value"><strong>${name}</strong></span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Email:</span>
                    <span class="detail-value"><a href="mailto:${email}" style="color: #2563eb; text-decoration: none;">${email}</a></span>
                  </div>
                  ${phone ? `
                  <div class="detail-row">
                    <span class="detail-label">Phone:</span>
                    <span class="detail-value"><a href="tel:${phone}" style="color: #2563eb; text-decoration: none;">${phone}</a></span>
                  </div>
                  ` : ''}
                  ${company ? `
                  <div class="detail-row">
                    <span class="detail-label">Company:</span>
                    <span class="detail-value">${company}</span>
                  </div>
                  ` : ''}
                  <div class="detail-row">
                    <span class="detail-label">Inquiry Type:</span>
                    <span class="detail-value">
                      <span class="inquiry-badge">${inquiryTypeDisplay}</span>
                    </span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Subject:</span>
                    <span class="detail-value"><strong>${subject}</strong></span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Submitted:</span>
                    <span class="detail-value">${new Date().toLocaleString('en-US', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}</span>
                  </div>
                </div>

                <div class="divider"></div>

                <!-- Message -->
                <div class="message-box">
                  <div class="message-label">Message:</div>
                  <div class="message-text">${message}</div>
                </div>
              </div>

              <!-- Footer -->
              <div class="footer">
                <p class="footer-text">
                  <strong>Action Required:</strong> Please review this inquiry and respond to the customer promptly.
                </p>
                <p class="footer-text">
                  Reply directly to this email to contact: <a href="mailto:${email}" style="color: #2563eb; text-decoration: none;">${email}</a>
                </p>
                <div class="divider"></div>
                <p class="footer-text" style="color: #9ca3af;">
                  © ${new Date().getFullYear()} Complyo. Automated contact form notification.
                </p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Contact email sent successfully to logilinkstaffing@gmail.com');
    console.log('   Message ID:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Error sending contact email:', error);
    throw new Error(`Failed to send contact email: ${error.message}`);
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
