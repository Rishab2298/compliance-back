import twilio from 'twilio';

// Initialize Twilio client
const getTwilioClient = () => {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken) {
    throw new Error('Twilio credentials not configured');
  }

  const client = twilio(accountSid, authToken);
  return client;
};

/**
 * Send driver invitation SMS with upload link
 * @param {Object} params - SMS parameters
 * @param {string} params.phone - Recipient phone number
 * @param {string} params.driverName - Driver's name
 * @param {string} params.uploadLink - Secure upload link
 * @param {string} params.companyName - Company name
 */
export const sendDriverInvitationSMS = async ({
  phone,
  driverName,
  uploadLink,
  companyName,
}) => {
  try {
    const client = getTwilioClient();
    const fromNumber = process.env.TWILIO_PHONE_NUMBER;

    if (!fromNumber) {
      throw new Error('Twilio phone number not configured');
    }

    const message = `Hello ${driverName},

${companyName} has requested you to upload documents.

Please use this secure link to upload:
${uploadLink}

This link expires in 7 days.`;

    const result = await client.messages
      .create({
        body: message,
        from: fromNumber,
        to: phone,
      })
      .then(message => {
        console.log('SMS sent successfully:', message.sid);
        return message;
      });

    return { success: true, messageSid: result.sid };
  } catch (error) {
    console.error('Error sending SMS:', error);
    throw new Error(`Failed to send SMS: ${error.message}`);
  }
};

/**
 * Send generic SMS
 * @param {string} to - Recipient phone number
 * @param {string} message - SMS message content
 */
export const sendSMS = async (to, message) => {
  try {
    const client = getTwilioClient();
    const fromNumber = process.env.TWILIO_PHONE_NUMBER;

    if (!fromNumber) {
      throw new Error('Twilio phone number not configured');
    }

    const result = await client.messages
      .create({
        body: message,
        from: fromNumber,
        to: to,
      })
      .then(msg => {
        console.log('SMS sent successfully:', msg.sid);
        return msg;
      });

    return { success: true, messageSid: result.sid };
  } catch (error) {
    console.error('Error sending SMS:', error);
    throw new Error(`Failed to send SMS: ${error.message}`);
  }
};

/**
 * Send test SMS to verify configuration
 */
export const sendTestSMS = async (toPhone) => {
  try {
    const client = getTwilioClient();
    const fromNumber = process.env.TWILIO_PHONE_NUMBER;

    const result = await client.messages
      .create({
        body: 'This is a test SMS from Logilink.',
        from: fromNumber,
        to: toPhone,
      })
      .then(message => {
        console.log('Test SMS sent successfully:', message.sid);
        return message;
      });

    return { success: true, messageSid: result.sid };
  } catch (error) {
    console.error('Error sending test SMS:', error);
    throw error;
  }
};
