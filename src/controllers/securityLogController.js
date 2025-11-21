import prisma from '../../prisma/client.js';

/**
 * Security Logs Controller
 *
 * Manages security event logs for monitoring and compliance
 * Security events include:
 * - Failed login attempts
 * - Permission denials
 * - Rate limit violations
 * - Suspicious activities
 * - Data access events
 */

/**
 * Get Security Events
 * GET /api/security-logs
 *
 * Returns paginated list of security events with filtering
 */
export const getSecurityLogs = async (req, res) => {
  try {
    const userId = req.auth?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get user and check permissions
    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
      select: { id: true, role: true, companyId: true, dspRole: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Only ADMIN, SUPER_ADMIN, and DSP users with admin permissions can view security logs
    const canViewSecurityLogs =
      user.role === 'SUPER_ADMIN' ||
      user.role === 'ADMIN' ||
      user.dspRole === 'ADMIN';

    if (!canViewSecurityLogs) {
      return res.status(403).json({
        error: 'Access denied - Admin permissions required'
      });
    }

    // Parse query parameters
    const {
      eventType,
      severity,
      startDate,
      endDate,
      search,
      page = 1,
      limit = 50,
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    // Build where clause
    const where = {};

    // Company scoping
    if (user.role !== 'SUPER_ADMIN') {
      where.companyId = user.companyId;
    }

    // Filter by event type
    if (eventType) {
      where.eventType = eventType;
    }

    // Filter by severity
    if (severity) {
      where.severity = severity;
    }

    // Date range filter
    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) {
        where.timestamp.gte = new Date(startDate);
      }
      if (endDate) {
        where.timestamp.lte = new Date(endDate);
      }
    }

    // Search filter
    if (search) {
      where.OR = [
        { description: { contains: search, mode: 'insensitive' } },
        { userEmail: { contains: search, mode: 'insensitive' } },
        { ipAddress: { contains: search } },
      ];
    }

    // Fetch security events
    const [events, total] = await Promise.all([
      prisma.securityEvent.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        skip,
        take,
        select: {
          id: true,
          userId: true,
          userEmail: true,
          companyId: true,
          eventType: true,
          severity: true,
          ipAddress: true,
          userAgent: true,
          location: true,
          description: true,
          metadata: true,
          blocked: true,
          actionTaken: true,
          timestamp: true,
        },
      }),
      prisma.securityEvent.count({ where }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        events,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    console.error('Error fetching security logs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch security logs',
    });
  }
};

/**
 * Get Security Event Statistics
 * GET /api/security-logs/stats
 *
 * Returns statistics about security events for dashboard
 */
export const getSecurityStats = async (req, res) => {
  try {
    const userId = req.auth?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
      select: { id: true, role: true, companyId: true, dspRole: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const canViewStats =
      user.role === 'SUPER_ADMIN' ||
      user.role === 'ADMIN' ||
      user.dspRole === 'ADMIN';

    if (!canViewStats) {
      return res.status(403).json({
        error: 'Access denied - Admin permissions required'
      });
    }

    // Build where clause
    const where = {};
    if (user.role !== 'SUPER_ADMIN') {
      where.companyId = user.companyId;
    }

    // Time ranges
    const now = new Date();
    const last24Hours = new Date(now - 24 * 60 * 60 * 1000);
    const last7Days = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const last30Days = new Date(now - 30 * 24 * 60 * 60 * 1000);

    // Get counts by severity
    const [critical, high, medium, low] = await Promise.all([
      prisma.securityEvent.count({
        where: { ...where, severity: 'CRITICAL', timestamp: { gte: last24Hours } }
      }),
      prisma.securityEvent.count({
        where: { ...where, severity: 'HIGH', timestamp: { gte: last24Hours } }
      }),
      prisma.securityEvent.count({
        where: { ...where, severity: 'MEDIUM', timestamp: { gte: last24Hours } }
      }),
      prisma.securityEvent.count({
        where: { ...where, severity: 'LOW', timestamp: { gte: last24Hours } }
      }),
    ]);

    // Get counts by time range
    const [events24h, events7d, events30d] = await Promise.all([
      prisma.securityEvent.count({
        where: { ...where, timestamp: { gte: last24Hours } }
      }),
      prisma.securityEvent.count({
        where: { ...where, timestamp: { gte: last7Days } }
      }),
      prisma.securityEvent.count({
        where: { ...where, timestamp: { gte: last30Days } }
      }),
    ]);

    // Get event type breakdown
    const eventTypeStats = await prisma.securityEvent.groupBy({
      by: ['eventType'],
      where: { ...where, timestamp: { gte: last7Days } },
      _count: true,
    });

    // Get blocked events count
    const blockedEvents = await prisma.securityEvent.count({
      where: { ...where, blocked: true, timestamp: { gte: last24Hours } },
    });

    // Get recent high-severity events
    const recentCritical = await prisma.securityEvent.findMany({
      where: {
        ...where,
        severity: { in: ['CRITICAL', 'HIGH'] },
        timestamp: { gte: last24Hours },
      },
      orderBy: { timestamp: 'desc' },
      take: 10,
      select: {
        id: true,
        eventType: true,
        severity: true,
        description: true,
        timestamp: true,
        blocked: true,
      },
    });

    res.status(200).json({
      success: true,
      data: {
        bySeverity: {
          critical,
          high,
          medium,
          low,
        },
        byTimeRange: {
          last24Hours: events24h,
          last7Days: events7d,
          last30Days: events30d,
        },
        byEventType: eventTypeStats.map(stat => ({
          eventType: stat.eventType,
          count: stat._count,
        })),
        blockedEvents,
        recentCritical,
        totalEvents: events30d,
      },
    });
  } catch (error) {
    console.error('Error fetching security stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch security statistics',
    });
  }
};

/**
 * Get Security Event by ID
 * GET /api/security-logs/:id
 *
 * Returns detailed information about a specific security event
 */
export const getSecurityEventById = async (req, res) => {
  try {
    const userId = req.auth?.userId;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
      select: { id: true, role: true, companyId: true, dspRole: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const canView =
      user.role === 'SUPER_ADMIN' ||
      user.role === 'ADMIN' ||
      user.dspRole === 'ADMIN';

    if (!canView) {
      return res.status(403).json({
        error: 'Access denied - Admin permissions required'
      });
    }

    // Fetch security event
    const event = await prisma.securityEvent.findUnique({
      where: { id },
    });

    if (!event) {
      return res.status(404).json({ error: 'Security event not found' });
    }

    // Check company access
    if (user.role !== 'SUPER_ADMIN' && event.companyId !== user.companyId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.status(200).json({
      success: true,
      data: event,
    });
  } catch (error) {
    console.error('Error fetching security event:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch security event',
    });
  }
};

/**
 * Export Security Logs
 * GET /api/security-logs/export
 *
 * Exports security logs as CSV for compliance reporting
 */
export const exportSecurityLogs = async (req, res) => {
  try {
    const userId = req.auth?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
      select: { id: true, role: true, companyId: true, email: true, name: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN') {
      return res.status(403).json({
        error: 'Access denied - Admin only'
      });
    }

    const { startDate, endDate } = req.query;

    const where = {};
    if (user.role !== 'SUPER_ADMIN') {
      where.companyId = user.companyId;
    }

    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp.gte = new Date(startDate);
      if (endDate) where.timestamp.lte = new Date(endDate);
    }

    const events = await prisma.securityEvent.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: 10000, // Limit to prevent performance issues
    });

    // Convert to CSV
    const headers = [
      'Timestamp',
      'Event Type',
      'Severity',
      'User Email',
      'IP Address',
      'Description',
      'Blocked',
      'Action Taken',
    ];

    const rows = events.map(event => [
      event.timestamp.toISOString(),
      event.eventType,
      event.severity,
      event.userEmail || 'N/A',
      event.ipAddress || 'N/A',
      event.description,
      event.blocked ? 'Yes' : 'No',
      event.actionTaken || 'None',
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    // Log export action
    const auditService = (await import('../services/auditService.js')).default;
    await auditService.logDataExport({
      userId: user.id,
      userEmail: user.email,
      userName: user.name,
      companyId: user.companyId,
      dataType: 'SecurityLogs',
      recordCount: events.length,
      format: 'CSV',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="security-logs-${Date.now()}.csv"`);
    res.status(200).send(csv);
  } catch (error) {
    console.error('Error exporting security logs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export security logs',
    });
  }
};
