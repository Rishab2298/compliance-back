import os from 'os';
import process from 'process';
import prisma from '../../prisma/client.js';
import {
  getResponseTimeMetrics,
  getRequestsPerMinute,
  getErrorMetrics,
  getSlowestEndpoints,
  getMostCalledEndpoints,
  getHighestErrorRateEndpoints,
  getTotalRequests,
} from '../middleware/metricsMiddleware.js';
import {
  getErrorStats,
  getRecentErrors,
  getCrashHistory,
} from '../services/errorTracker.js';

/**
 * Format uptime in human-readable format
 */
const formatUptime = (seconds) => {
  const days = Math.floor(seconds / (24 * 60 * 60));
  const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));
  const minutes = Math.floor((seconds % (60 * 60)) / 60);

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
};

/**
 * Get system health metrics
 * GET /api/super-admin/system-metrics
 */
export const getSystemMetrics = async (req, res) => {
  try {
    // ===== SERVER INFO =====
    const uptime = process.uptime();
    const memUsage = process.memoryUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    // ===== PERFORMANCE METRICS =====
    const responseMetrics = getResponseTimeMetrics();
    const rpm = getRequestsPerMinute();
    const errorMetrics = getErrorMetrics();
    const totalRequests = getTotalRequests();

    // ===== ERROR TRACKING =====
    const errorStats = getErrorStats();

    // ===== DATABASE METRICS =====
    let dbMetrics = {
      poolSize: 10, // Default
      activeConnections: 0,
      tableCount: 0,
      databaseSize: 0,
    };

    try {
      // Try to get database metrics
      const tables = await prisma.$queryRaw`
        SELECT COUNT(*) as count
        FROM information_schema.tables
        WHERE table_schema = 'public'
      `;
      dbMetrics.tableCount = Number(tables[0]?.count || 0);

      // Get database size
      const dbSize = await prisma.$queryRaw`
        SELECT pg_database_size(current_database()) as size
      `;
      dbMetrics.databaseSize = Number(dbSize[0]?.size || 0) / (1024 * 1024 * 1024); // Convert to GB
    } catch (error) {
      console.error('Error fetching database metrics:', error.message);
    }

    // ===== CPU LOAD =====
    const loadAverage = os.loadavg();
    const cpuCount = os.cpus().length;

    // ===== ENDPOINT METRICS =====
    const slowestEndpoints = getSlowestEndpoints(5);
    const mostCalledEndpoints = getMostCalledEndpoints(5);
    const highErrorEndpoints = getHighestErrorRateEndpoints(5);

    // ===== HEALTH STATUS =====
    const memoryUsagePercent = (usedMem / totalMem) * 100;
    const heapUsagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;

    const isHealthy =
      errorStats.last1h < 100 && // Less than 100 errors in last hour
      parseFloat(errorMetrics.rate || 0) < 10 && // Error rate below 10%
      responseMetrics.p95 < 2000 && // 95th percentile under 2s
      memoryUsagePercent < 95 && // System memory usage below 95%
      heapUsagePercent < 95; // Heap usage below 95%

    // ===== CRASH HISTORY =====
    const crashes = getCrashHistory();

    return res.json({
      timestamp: new Date(),
      status: isHealthy ? 'healthy' : 'degraded',

      // Server info
      server: {
        uptime: uptime,
        uptimeFormatted: formatUptime(uptime),
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        pid: process.pid,
        env: process.env.NODE_ENV || 'development',
      },

      // Performance metrics
      performance: {
        avgResponseTime: responseMetrics.avg,
        p50ResponseTime: responseMetrics.p50,
        p95ResponseTime: responseMetrics.p95,
        p99ResponseTime: responseMetrics.p99,
        minResponseTime: responseMetrics.min,
        maxResponseTime: responseMetrics.max,
        requestsPerMinute: rpm,
        totalRequests: totalRequests,
        errorRate: errorMetrics.rate,
      },

      // Resource usage
      resources: {
        memory: {
          heapUsed: (memUsage.heapUsed / 1024 / 1024).toFixed(2), // MB
          heapTotal: (memUsage.heapTotal / 1024 / 1024).toFixed(2),
          rss: (memUsage.rss / 1024 / 1024).toFixed(2),
          external: (memUsage.external / 1024 / 1024).toFixed(2),
          systemTotal: (totalMem / 1024 / 1024 / 1024).toFixed(2), // GB
          systemUsed: (usedMem / 1024 / 1024 / 1024).toFixed(2),
          systemFree: (freeMem / 1024 / 1024 / 1024).toFixed(2),
          usagePercent: ((usedMem / totalMem) * 100).toFixed(2),
        },
        cpu: {
          cores: cpuCount,
          model: os.cpus()[0]?.model || 'Unknown',
          loadAverage: {
            '1min': loadAverage[0].toFixed(2),
            '5min': loadAverage[1].toFixed(2),
            '15min': loadAverage[2].toFixed(2),
          },
          loadPercent: ((loadAverage[0] / cpuCount) * 100).toFixed(2),
        },
      },

      // Database metrics
      database: {
        poolSize: dbMetrics.poolSize,
        activeConnections: dbMetrics.activeConnections,
        tableCount: dbMetrics.tableCount,
        size: dbMetrics.databaseSize.toFixed(2) + ' GB',
      },

      // Error & crash tracking
      errors: {
        total: errorStats.total,
        last1h: errorStats.last1h,
        last24h: errorStats.last24h,
        uncaughtExceptions: errorStats.uncaughtExceptions,
        unhandledRejections: errorStats.unhandledRejections,
        errorsByType: errorStats.errorsByType,
        topErrors: errorStats.topErrors.slice(0, 5),
      },

      crashes: {
        total: crashes.length,
        lastCrash: crashes[0] || null,
        history: crashes.slice(0, 10),
      },

      // Endpoint performance
      endpoints: {
        slowest: slowestEndpoints,
        mostCalled: mostCalledEndpoints,
        highestErrorRate: highErrorEndpoints,
      },
    });
  } catch (error) {
    console.error('Error fetching system metrics:', error);
    res.status(500).json({
      error: 'Failed to fetch system metrics',
      message: error.message,
    });
  }
};

/**
 * Get recent errors
 * GET /api/super-admin/system-metrics/errors
 */
export const getSystemErrors = async (req, res) => {
  try {
    const { limit = 100 } = req.query;
    const errors = getRecentErrors(parseInt(limit));

    res.json({
      success: true,
      errors,
      total: errors.length,
    });
  } catch (error) {
    console.error('Error fetching system errors:', error);
    res.status(500).json({
      error: 'Failed to fetch errors',
      message: error.message,
    });
  }
};

/**
 * Health check endpoint
 * GET /api/health
 */
export const healthCheck = async (req, res) => {
  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`;

    const uptime = process.uptime();
    const memUsage = process.memoryUsage();
    const errorMetrics = getErrorMetrics();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    // Calculate heap usage percentage
    const heapUsagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
    const systemMemoryPercent = (usedMem / totalMem) * 100;

    const isHealthy =
      parseFloat(errorMetrics.rate || 0) < 10 && // Error rate below 10%
      heapUsagePercent < 95 && // Heap usage below 95%
      systemMemoryPercent < 95; // System memory below 95%

    res.status(isHealthy ? 200 : 503).json({
      status: isHealthy ? 'healthy' : 'unhealthy',
      uptime: uptime,
      timestamp: new Date(),
      checks: {
        database: 'connected',
        heapMemory: {
          status: heapUsagePercent < 95 ? 'ok' : 'critical',
          usage: heapUsagePercent.toFixed(2) + '%',
        },
        systemMemory: {
          status: systemMemoryPercent < 95 ? 'ok' : 'critical',
          usage: systemMemoryPercent.toFixed(2) + '%',
        },
        errors: {
          status: parseFloat(errorMetrics.rate || 0) < 10 ? 'ok' : 'high',
          rate: errorMetrics.rate,
        },
      },
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date(),
    });
  }
};

export default {
  getSystemMetrics,
  getSystemErrors,
  healthCheck,
};
