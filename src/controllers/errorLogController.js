import prisma from '../../prisma/client.js';

/**
 * Log Frontend Errors
 * POST /api/log-error
 *
 * Endpoint for frontend error boundary to log client-side errors
 * Helps with debugging production issues
 */
export const logFrontendError = async (req, res) => {
  try {
    const {
      message,
      stack,
      componentStack,
      timestamp,
      url,
      userAgent,
    } = req.body;

    // Validate required fields
    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Error message is required',
      });
    }

    // Get user info if authenticated (optional)
    const userId = req.auth?.userId;
    let user = null;

    if (userId) {
      user = await prisma.user.findUnique({
        where: { clerkUserId: userId },
        select: { id: true, email: true, companyId: true },
      });
    }

    // Log to console for immediate visibility
    console.error('🚨 Frontend Error Logged:', {
      message,
      url,
      userId: user?.id,
      userEmail: user?.email,
      timestamp,
    });

    // Store in database for analytics (optional - create FrontendError model if needed)
    // For now, we'll just log to audit logs
    if (user) {
      // Import audit service if available
      try {
        const auditService = (await import('../services/auditService.js')).default;

        await auditService.logAudit({
          userId: user.id,
          userEmail: user.email,
          companyId: user.companyId,
          action: 'CLIENT_ERROR',
          resource: 'Frontend',
          ipAddress: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
          userAgent: req.headers['user-agent'],
          severity: 'ERROR',
          category: 'GENERAL',
          errorMessage: message,
          metadata: {
            stack,
            componentStack,
            url,
            clientTimestamp: timestamp,
            clientUserAgent: userAgent,
          },
        });
      } catch (auditError) {
        console.error('Failed to log to audit service:', auditError);
        // Don't fail the request if audit logging fails
      }
    }

    // Return success (don't expose internal details to client)
    res.status(200).json({
      success: true,
      message: 'Error logged successfully',
    });
  } catch (error) {
    // If error logging itself fails, log to console and return generic error
    console.error('Error in logFrontendError:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to log error',
    });
  }
};

/**
 * Log 404 Not Found Errors
 * POST /api/log-error/404
 *
 * Endpoint for logging when users navigate to non-existent routes
 * Tracks 404 errors with user information for analytics
 */
export const log404Error = async (req, res) => {
  try {
    const {
      type,
      path,
      fullUrl,
      referrer,
      timestamp,
      userAgent,
      userEmail,
      userId,
    } = req.body;

    // Validate required fields
    if (!path) {
      return res.status(400).json({
        success: false,
        error: 'Path is required',
      });
    }

    // Get user info from Clerk if userId provided
    let user = null;
    if (userId) {
      try {
        user = await prisma.user.findUnique({
          where: { clerkUserId: userId },
          select: { id: true, email: true, companyId: true },
        });
      } catch (error) {
        // User might not exist yet, that's okay
        console.warn('User not found for 404 logging:', userId);
      }
    }

    // Log to console for immediate visibility
    console.warn('🚫 404 Not Found:', {
      path,
      userEmail: userEmail || 'anonymous',
      referrer,
      timestamp,
    });

    // Log to audit system
    if (user) {
      try {
        const auditService = (await import('../services/auditService.js')).default;

        await auditService.logAudit({
          userId: user.id,
          userEmail: user.email,
          companyId: user.companyId,
          action: 'ROUTE_NOT_FOUND',
          resource: 'Frontend',
          resourceId: path,
          ipAddress: req.ip || req.headers['x-forwarded-for'] || req.connection?.remoteAddress,
          userAgent: req.headers['user-agent'],
          severity: 'INFO',
          category: 'GENERAL',
          metadata: {
            path,
            fullUrl,
            referrer,
            clientTimestamp: timestamp,
            clientUserAgent: userAgent,
            type,
          },
        });
      } catch (auditError) {
        console.error('Failed to log 404 to audit service:', auditError);
        // Don't fail the request if audit logging fails
      }
    } else {
      // Log for anonymous users (no audit entry, just console)
      console.info('404 (anonymous):', {
        path,
        referrer,
        userEmail: userEmail || 'anonymous',
      });
    }

    // Return success
    res.status(200).json({
      success: true,
      message: '404 error logged successfully',
    });
  } catch (error) {
    console.error('Error in log404Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to log 404 error',
    });
  }
};

/**
 * Get Frontend Error Statistics (Admin only)
 * GET /api/log-error/stats
 *
 * Returns statistics about frontend errors for monitoring
 */
export const getFrontendErrorStats = async (req, res) => {
  try {
    const userId = req.auth?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Only allow admins to view error stats
    if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Access denied - Admin only' });
    }

    // Query audit logs for frontend errors in last 24 hours
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const errorLogs = await prisma.auditLog.findMany({
      where: {
        action: 'CLIENT_ERROR',
        timestamp: { gte: twentyFourHoursAgo },
      },
      orderBy: { timestamp: 'desc' },
      take: 100,
      select: {
        id: true,
        timestamp: true,
        userEmail: true,
        errorMessage: true,
        metadata: true,
      },
    });

    // Calculate statistics
    const stats = {
      total: errorLogs.length,
      last24Hours: errorLogs.length,
      uniqueUsers: new Set(errorLogs.map(log => log.userEmail)).size,
      recentErrors: errorLogs.slice(0, 10).map(log => ({
        timestamp: log.timestamp,
        message: log.errorMessage,
        user: log.userEmail,
        url: log.metadata?.url,
      })),
    };

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Error in getFrontendErrorStats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch error statistics',
    });
  }
};
