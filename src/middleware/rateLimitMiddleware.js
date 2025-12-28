import rateLimit from 'express-rate-limit';
import { ipKeyGenerator } from 'express-rate-limit';
import auditService from '../services/auditService.js';
import prisma from '../../prisma/client.js';

/**
 * Rate limiter for AI scan endpoints
 * Prevents abuse of expensive AI operations (AWS Textract + OpenAI)
 *
 * Limits:
 * - 10 requests per minute per IP address
 * - Applies to single scan and bulk scan endpoints
 *
 * This prevents:
 * - Credit drainage through spam
 * - AWS Textract cost overruns
 * - OpenAI API rate limit errors
 * - Server overload from concurrent AI operations
 *
 * SECURITY NOTE:
 * - Uses custom keyGenerator that validates trust proxy configuration
 * - Server is behind Apache proxy with 'trust proxy' set to 1
 * - This prevents IP spoofing while allowing proper IP detection
 */
export const aiScanRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 10, // Max 10 requests per minute per IP
  message: {
    success: false,
    error: 'Too many AI scan requests',
    message: 'You have exceeded the AI scan rate limit. Please try again in a minute.',
    retryAfter: '60 seconds',
  },
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  // Use ipKeyGenerator helper for proper IPv4/IPv6 handling
  // This works with 'trust proxy' set to 1 (Apache proxy)
  keyGenerator: ipKeyGenerator,
  // Custom handler for when limit is exceeded
  handler: async (req, res) => {
    console.warn(`[RATE LIMIT] AI scan rate limit exceeded for IP: ${req.ip}`);

    // Log rate limit violation as security event
    try {
      // Try to get user info if authenticated
      let userId = null;
      let userEmail = null;
      let companyId = null;

      if (req.auth?.userId) {
        const user = await prisma.user.findUnique({
          where: { clerkUserId: req.auth.userId },
          select: { id: true, email: true, companyId: true },
        });
        if (user) {
          userId = user.id;
          userEmail = user.email;
          companyId = user.companyId;
        }
      }

      await auditService.logSecurityEvent({
        userId,
        userEmail,
        companyId,
        eventType: 'RATE_LIMIT_EXCEEDED',
        severity: 'MEDIUM',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        location: null,
        description: 'AI scan rate limit exceeded (10 requests/minute)',
        metadata: {
          endpoint: req.originalUrl,
          method: req.method,
          limitType: 'AI_SCAN',
          maxRequests: 10,
          windowMinutes: 1,
        },
        blocked: true,
        actionTaken: 'Request rejected with 429',
      });
    } catch (error) {
      console.error('Error logging rate limit event:', error);
    }

    res.status(429).json({
      success: false,
      error: 'Too many AI scan requests',
      message: 'You have exceeded the AI scan rate limit. Please try again in a minute.',
      retryAfter: 60,
    });
  },
  // Skip rate limiting in development if needed (optional)
  skip: (req) => {
    // You can add logic here to skip rate limiting for certain conditions
    // For example, skip for super admins or in test environment
    return false; // Always apply rate limiting
  },
});

/**
 * More aggressive rate limiter for bulk AI scan endpoint
 * Bulk operations are more expensive and should be limited more strictly
 *
 * Limits:
 * - 5 requests per minute per IP address
 * - Applies only to bulk scan endpoint
 *
 * SECURITY NOTE:
 * - Uses custom keyGenerator that validates trust proxy configuration
 * - Server is behind Apache proxy with 'trust proxy' set to 1
 */
export const bulkAiScanRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 5, // Max 5 requests per minute per IP (stricter for bulk operations)
  message: {
    success: false,
    error: 'Too many bulk AI scan requests',
    message: 'You have exceeded the bulk AI scan rate limit. Please try again in a minute.',
    retryAfter: '60 seconds',
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Use ipKeyGenerator helper for proper IPv4/IPv6 handling
  keyGenerator: ipKeyGenerator,
  handler: async (req, res) => {
    console.warn(`[RATE LIMIT] Bulk AI scan rate limit exceeded for IP: ${req.ip}`);

    // Log rate limit violation as security event
    try {
      // Try to get user info if authenticated
      let userId = null;
      let userEmail = null;
      let companyId = null;

      if (req.auth?.userId) {
        const user = await prisma.user.findUnique({
          where: { clerkUserId: req.auth.userId },
          select: { id: true, email: true, companyId: true },
        });
        if (user) {
          userId = user.id;
          userEmail = user.email;
          companyId = user.companyId;
        }
      }

      await auditService.logSecurityEvent({
        userId,
        userEmail,
        companyId,
        eventType: 'RATE_LIMIT_EXCEEDED',
        severity: 'HIGH',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        location: null,
        description: 'Bulk AI scan rate limit exceeded (5 requests/minute)',
        metadata: {
          endpoint: req.originalUrl,
          method: req.method,
          limitType: 'BULK_AI_SCAN',
          maxRequests: 5,
          windowMinutes: 1,
        },
        blocked: true,
        actionTaken: 'Request rejected with 429',
      });
    } catch (error) {
      console.error('Error logging rate limit event:', error);
    }

    res.status(429).json({
      success: false,
      error: 'Too many bulk AI scan requests',
      message: 'Bulk AI scanning is rate limited more strictly. Please wait a minute before trying again.',
      retryAfter: 60,
    });
  },
});

/**
 * General API rate limiter (optional - for all API endpoints)
 * Prevents general API abuse
 *
 * Limits:
 * - 100 requests per minute per IP address
 * - Can be applied globally or to specific route groups
 *
 * SECURITY NOTE:
 * - Uses custom keyGenerator that validates trust proxy configuration
 * - Server is behind Apache proxy with 'trust proxy' set to 1
 */
export const generalApiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 100, // Max 100 requests per minute per IP
  message: {
    success: false,
    error: 'Too many requests',
    message: 'You have exceeded the API rate limit. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Use ipKeyGenerator helper for proper IPv4/IPv6 handling
  keyGenerator: ipKeyGenerator,
  skip: (req) => {
    // Skip rate limiting for health check endpoints
    return req.path === '/health' || req.path === '/api/health';
  },
});

/**
 * Complaint submission rate limiter
 * Prevents spam and abuse of the public complaint form
 *
 * Limits:
 * - 1 complaint submission per 24 hours per IP address
 * - Prevents spam while allowing legitimate complaints
 *
 * SECURITY NOTE:
 * - Uses IP-based rate limiting to prevent abuse
 * - 24-hour window ensures one complaint per day per IP
 * - Logs all rate limit violations for monitoring
 */
export const complaintRateLimiter = rateLimit({
  // TEMPORARY: Set to 1 minute for testing - change back to 24 hours in production
  windowMs: process.env.NODE_ENV === 'production' ? 24 * 60 * 60 * 1000 : 60 * 1000, // 1 minute in dev, 24 hours in prod
  max: 1, // Max 1 complaint per window
  message: {
    success: false,
    error: 'Complaint submission limit exceeded',
    message: 'You have already submitted a complaint in the last 24 hours. Please wait before submitting another.',
    retryAfter: '24 hours',
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Use ipKeyGenerator helper for proper IPv4/IPv6 handling
  keyGenerator: (req) => {
    const key = ipKeyGenerator(req);
    console.log(`[RATE LIMIT] 🔑 Complaint rate limiter - Key generated: "${key}"`, {
      reqIp: req.ip,
      reqIps: req.ips,
      xForwardedFor: req.headers['x-forwarded-for'],
      xRealIp: req.headers['x-real-ip'],
    });
    return key;
  },
  skip: (req) => {
    console.log(`[RATE LIMIT] ⏩ Checking if should skip rate limit for IP: ${req.ip}`);
    return false; // Never skip
  },
  handler: async (req, res) => {
    console.warn(`[RATE LIMIT] Complaint rate limit exceeded for IP: ${req.ip}`);

    // Log rate limit violation as security event
    try {
      await auditService.logSecurityEvent({
        userId: null, // Public endpoint, no user
        userEmail: req.body?.email || 'unknown',
        companyId: null,
        eventType: 'RATE_LIMIT_EXCEEDED',
        severity: 'LOW',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        location: null,
        description: 'Complaint submission rate limit exceeded (1 per 24 hours)',
        metadata: {
          endpoint: req.originalUrl,
          method: req.method,
          limitType: 'COMPLAINT_SUBMISSION',
          maxRequests: 1,
          windowHours: 24,
          submitterEmail: req.body?.email || 'unknown',
        },
        blocked: true,
        actionTaken: 'Request rejected with 429',
      });
    } catch (error) {
      console.error('Error logging complaint rate limit event:', error);
    }

    res.status(429).json({
      success: false,
      error: 'Complaint submission limit exceeded',
      message: 'You have already submitted a complaint in the last 24 hours. Please wait before submitting another complaint.',
      retryAfter: '24 hours',
    });
  },
});
