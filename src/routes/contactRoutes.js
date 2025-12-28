import express from 'express';
import { sendContactEmail } from '../services/emailService.js';
import { complaintRateLimiter } from '../middleware/rateLimitMiddleware.js';

const router = express.Router();

/**
 * POST /api/contact/submit
 * Submit a new contact form from the public page
 * No authentication required - this is a public endpoint
 * Rate limited to 1 submission per 24 hours per IP address
 */
router.post('/submit', complaintRateLimiter, async (req, res) => {
  try {
    const { name, email, phone, company, inquiryType, subject, message } = req.body;

    // Log IP address and request details for debugging
    console.log('📝 Contact form submission received:', {
      name,
      email,
      phone,
      company,
      inquiryType,
      subject,
      ip: req.ip,
      ips: req.ips,
      headers: {
        'x-forwarded-for': req.headers['x-forwarded-for'],
        'x-real-ip': req.headers['x-real-ip'],
      },
    });

    // Validate required fields
    if (!name || !email || !inquiryType || !subject || !message) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields',
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format',
      });
    }

    // Send contact notification email
    await sendContactEmail({
      name,
      email,
      phone,
      company,
      inquiryType,
      subject,
      message,
    });

    console.log('✅ Contact form submitted successfully:', {
      name,
      email,
      inquiryType,
      subject,
    });

    res.status(200).json({
      success: true,
      message: 'Message sent successfully. Our team will get back to you within 24 hours.',
    });
  } catch (error) {
    console.error('❌ Error submitting contact form:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit contact form. Please try again later.',
      error: error.message,
    });
  }
});

export default router;
