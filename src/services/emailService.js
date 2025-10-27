import nodemailer from 'nodemailer';

// Create reusable transporter
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: process.env.SMTP_PORT || 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  });
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
 * Send test email to verify configuration
 */
export const sendTestEmail = async (toEmail) => {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: process.env.SMTP_USER,
      to: toEmail,
      subject: 'Test Email from Logilink',
      text: 'This is a test email to verify your email configuration.',
    };

    const info = await transporter.sendMail(mailOptions);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending test email:', error);
    throw error;
  }
};
