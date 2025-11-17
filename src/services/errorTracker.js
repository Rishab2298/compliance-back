/**
 * Error Tracking Service
 * Tracks application errors, crashes, and exceptions
 */

// In-memory error store (use external service like Sentry in production)
const errorStore = {
  errors: [],
  crashes: [],
  uncaughtExceptions: [],
  unhandledRejections: [],
  startTime: Date.now(),
};

// Clean old errors periodically (keep last 1000)
setInterval(() => {
  if (errorStore.errors.length > 1000) {
    errorStore.errors = errorStore.errors.slice(-1000);
  }
  if (errorStore.uncaughtExceptions.length > 100) {
    errorStore.uncaughtExceptions = errorStore.uncaughtExceptions.slice(-100);
  }
  if (errorStore.unhandledRejections.length > 100) {
    errorStore.unhandledRejections = errorStore.unhandledRejections.slice(-100);
  }
}, 10 * 60 * 1000); // Every 10 minutes

/**
 * Track an error
 */
export const trackError = (error, context = {}) => {
  const errorEntry = {
    message: error.message || 'Unknown error',
    stack: error.stack,
    type: error.name || 'Error',
    context,
    timestamp: new Date(),
  };

  errorStore.errors.push(errorEntry);

  // Log to console
  console.error('🐛 Error tracked:', {
    type: errorEntry.type,
    message: errorEntry.message,
    context,
  });

  return errorEntry;
};

/**
 * Track a crash/restart event
 */
export const trackCrash = (reason, type = 'crash') => {
  const crashEntry = {
    reason,
    type, // 'crash', 'manual_restart', 'auto_restart'
    timestamp: new Date(),
    uptime: process.uptime(),
  };

  errorStore.crashes.push(crashEntry);

  console.error('💥 Crash tracked:', crashEntry);

  return crashEntry;
};

/**
 * Track uncaught exception
 */
export const trackUncaughtException = (error, origin) => {
  const exceptionEntry = {
    message: error.message,
    stack: error.stack,
    type: error.name,
    origin,
    timestamp: new Date(),
    uptime: process.uptime(),
  };

  errorStore.uncaughtExceptions.push(exceptionEntry);

  console.error('🔥 Uncaught Exception:', exceptionEntry);

  return exceptionEntry;
};

/**
 * Track unhandled rejection
 */
export const trackUnhandledRejection = (reason, promise) => {
  const rejectionEntry = {
    reason: reason?.message || String(reason),
    stack: reason?.stack,
    promise: String(promise),
    timestamp: new Date(),
    uptime: process.uptime(),
  };

  errorStore.unhandledRejections.push(rejectionEntry);

  console.error('⚠️  Unhandled Rejection:', rejectionEntry);

  return rejectionEntry;
};

/**
 * Get error statistics
 */
export const getErrorStats = () => {
  const now = Date.now();
  const oneHourAgo = now - 60 * 60 * 1000;
  const oneDayAgo = now - 24 * 60 * 60 * 1000;

  const errorsLast1h = errorStore.errors.filter(
    (e) => new Date(e.timestamp).getTime() > oneHourAgo
  );

  const errorsLast24h = errorStore.errors.filter(
    (e) => new Date(e.timestamp).getTime() > oneDayAgo
  );

  // Group errors by type
  const errorsByType = {};
  errorStore.errors.forEach((error) => {
    const type = error.type || 'Unknown';
    errorsByType[type] = (errorsByType[type] || 0) + 1;
  });

  // Get top errors
  const errorCounts = {};
  errorStore.errors.forEach((error) => {
    const key = error.message?.substring(0, 100) || 'Unknown';
    errorCounts[key] = (errorCounts[key] || 0) + 1;
  });

  const topErrors = Object.entries(errorCounts)
    .map(([message, count]) => ({ message, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    total: errorStore.errors.length,
    last1h: errorsLast1h.length,
    last24h: errorsLast24h.length,
    uncaughtExceptions: errorStore.uncaughtExceptions.length,
    unhandledRejections: errorStore.unhandledRejections.length,
    crashes: errorStore.crashes.length,
    lastCrash: errorStore.crashes[errorStore.crashes.length - 1] || null,
    errorsByType,
    topErrors,
  };
};

/**
 * Get recent errors
 */
export const getRecentErrors = (limit = 50) => {
  return errorStore.errors
    .slice(-limit)
    .reverse()
    .map((error) => ({
      type: error.type,
      message: error.message,
      timestamp: error.timestamp,
      context: error.context,
    }));
};

/**
 * Get crash history
 */
export const getCrashHistory = () => {
  return errorStore.crashes.slice().reverse();
};

/**
 * Get uncaught exceptions
 */
export const getUncaughtExceptions = (limit = 20) => {
  return errorStore.uncaughtExceptions.slice(-limit).reverse();
};

/**
 * Get unhandled rejections
 */
export const getUnhandledRejections = (limit = 20) => {
  return errorStore.unhandledRejections.slice(-limit).reverse();
};

/**
 * Initialize error tracking for process-level events
 */
export const initializeErrorTracking = () => {
  // Track uncaught exceptions
  process.on('uncaughtException', (error, origin) => {
    trackUncaughtException(error, origin);
    // Don't exit - let PM2 handle restarts
  });

  // Track unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    trackUnhandledRejection(reason, promise);
  });

  // Track process warnings
  process.on('warning', (warning) => {
    console.warn('⚠️  Process Warning:', warning.name, warning.message);
  });

  // Log startup
  console.log('✅ Error tracking initialized');
};

/**
 * Express error handling middleware
 */
export const errorHandlerMiddleware = (err, req, res, next) => {
  // Track the error
  trackError(err, {
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });

  // Send error response
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

/**
 * Reset error tracking (for testing)
 */
export const resetErrorTracking = () => {
  errorStore.errors = [];
  errorStore.crashes = [];
  errorStore.uncaughtExceptions = [];
  errorStore.unhandledRejections = [];
  errorStore.startTime = Date.now();
};

export default {
  trackError,
  trackCrash,
  trackUncaughtException,
  trackUnhandledRejection,
  getErrorStats,
  getRecentErrors,
  getCrashHistory,
  getUncaughtExceptions,
  getUnhandledRejections,
  initializeErrorTracking,
  errorHandlerMiddleware,
  resetErrorTracking,
};
