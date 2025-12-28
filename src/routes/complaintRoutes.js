import express from 'express';
import { sendComplaintEmail } from '../services/emailService.js';
import { complaintRateLimiter } from '../middleware/rateLimitMiddleware.js';

const router = express.Router();

/**
 * POST /api/complaints/submit
 * Submit a new complaint from the public form
 * No authentication required - this is a public endpoint
 * Rate limited to 1 submission per 24 hours per IP address
 */
router.post('/submit', complaintRateLimiter, async (req, res) => {
  try {
    const { name, email, subject, category, priority, description } = req.body;

    // Log IP address and request details for debugging
    console.log('📝 Complaint submission received:', {
      name,
      email,
      subject,
      category,
      priority,
      ip: req.ip,
      ips: req.ips,
      headers: {
        'x-forwarded-for': req.headers['x-forwarded-for'],
        'x-real-ip': req.headers['x-real-ip'],
      },
    });

    // Validate required fields
    if (!name || !email || !subject || !category || !priority || !description) {
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

    // Send complaint notification email
    await sendComplaintEmail({
      name,
      email,
      subject,
      category,
      priority,
      description,
    });

    console.log('✅ Complaint submitted successfully:', {
      name,
      email,
      subject,
      category,
      priority,
    });

    res.status(200).json({
      success: true,
      message: 'Complaint submitted successfully. We will respond within 24-48 hours.',
    });
  } catch (error) {
    console.error('❌ Error submitting complaint:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit complaint. Please try again later.',
      error: error.message,
    });
  }
});

export default router;
