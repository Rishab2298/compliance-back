/**
 * Metrics Tracking Middleware
 * Tracks response times, request counts, and endpoint performance
 */

// In-memory store for metrics (use Redis in production for multi-instance deployments)
const metricsStore = {
  responseTimes: [], // Last 10000 response times
  requests: {
    total: 0,
    perMinute: [],
    startTime: Date.now(),
  },
  errors: {
    total: 0,
    last1h: [],
    last24h: [],
  },
  endpoints: new Map(), // Per-endpoint metrics
};

// Clean old data periodically
setInterval(() => {
  const now = Date.now();
  const oneHourAgo = now - 60 * 60 * 1000;
  const oneDayAgo = now - 24 * 60 * 60 * 1000;

  // Clean 1h errors
  metricsStore.errors.last1h = metricsStore.errors.last1h.filter(
    (timestamp) => timestamp > oneHourAgo
  );

  // Clean 24h errors
  metricsStore.errors.last24h = metricsStore.errors.last24h.filter(
    (timestamp) => timestamp > oneDayAgo
  );

  // Keep only last 10000 response times
  if (metricsStore.responseTimes.length > 10000) {
    metricsStore.responseTimes = metricsStore.responseTimes.slice(-10000);
  }
}, 5 * 60 * 1000); // Every 5 minutes

/**
 * Middleware to track request metrics
 */
export const metricsMiddleware = (req, res, next) => {
  const startTime = Date.now();

  // Track when response finishes
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const endpoint = `${req.method} ${req.route?.path || req.path}`;
    const now = Date.now();

    // Store response time
    metricsStore.responseTimes.push({
      duration,
      endpoint,
      method: req.method,
      statusCode: res.statusCode,
      timestamp: now,
    });

    // Track total requests
    metricsStore.requests.total++;

    // Track errors
    if (res.statusCode >= 400) {
      metricsStore.errors.total++;
      metricsStore.errors.last1h.push(now);
      metricsStore.errors.last24h.push(now);
    }

    // Track per-endpoint metrics
    if (!metricsStore.endpoints.has(endpoint)) {
      metricsStore.endpoints.set(endpoint, {
        requests: 0,
        errors: 0,
        totalTime: 0,
        times: [],
      });
    }

    const endpointMetrics = metricsStore.endpoints.get(endpoint);
    endpointMetrics.requests++;
    endpointMetrics.totalTime += duration;
    endpointMetrics.times.push(duration);

    // Keep only last 1000 times per endpoint
    if (endpointMetrics.times.length > 1000) {
      endpointMetrics.times.shift();
    }

    if (res.statusCode >= 400) {
      endpointMetrics.errors++;
    }
  });

  next();
};

/**
 * Calculate response time statistics
 */
export const getResponseTimeMetrics = () => {
  if (metricsStore.responseTimes.length === 0) {
    return {
      avg: 0,
      min: 0,
      max: 0,
      p50: 0,
      p95: 0,
      p99: 0,
      total: 0,
    };
  }

  const times = metricsStore.responseTimes.map((t) => t.duration);
  const sorted = [...times].sort((a, b) => a - b);

  return {
    avg: Math.round(times.reduce((a, b) => a + b, 0) / times.length),
    min: sorted[0],
    max: sorted[sorted.length - 1],
    p50: sorted[Math.floor(sorted.length * 0.5)],
    p95: sorted[Math.floor(sorted.length * 0.95)],
    p99: sorted[Math.floor(sorted.length * 0.99)],
    total: times.length,
  };
};

/**
 * Get requests per minute (RPM)
 */
export const getRequestsPerMinute = () => {
  const now = Date.now();
  const oneMinuteAgo = now - 60 * 1000;

  const requestsLastMinute = metricsStore.responseTimes.filter(
    (t) => t.timestamp > oneMinuteAgo
  ).length;

  return requestsLastMinute;
};

/**
 * Get error counts and rates
 */
export const getErrorMetrics = () => {
  const total = metricsStore.requests.total || 1; // Avoid division by zero

  return {
    total: metricsStore.errors.total,
    last1h: metricsStore.errors.last1h.length,
    last24h: metricsStore.errors.last24h.length,
    rate: ((metricsStore.errors.total / total) * 100).toFixed(2) + '%',
  };
};

/**
 * Get endpoint-specific metrics
 */
export const getEndpointMetrics = () => {
  const endpoints = [];

  metricsStore.endpoints.forEach((metrics, endpoint) => {
    const times = [...metrics.times].sort((a, b) => a - b);
    const avgTime = Math.round(metrics.totalTime / metrics.requests);

    endpoints.push({
      endpoint,
      requests: metrics.requests,
      errors: metrics.errors,
      errorRate: ((metrics.errors / metrics.requests) * 100).toFixed(2) + '%',
      avgTime,
      p95Time: times[Math.floor(times.length * 0.95)] || 0,
    });
  });

  return endpoints;
};

/**
 * Get top slowest endpoints
 */
export const getSlowestEndpoints = (limit = 10) => {
  const endpoints = getEndpointMetrics();
  return endpoints
    .sort((a, b) => b.avgTime - a.avgTime)
    .slice(0, limit);
};

/**
 * Get most called endpoints
 */
export const getMostCalledEndpoints = (limit = 10) => {
  const endpoints = getEndpointMetrics();
  return endpoints
    .sort((a, b) => b.requests - a.requests)
    .slice(0, limit);
};

/**
 * Get endpoints with highest error rate
 */
export const getHighestErrorRateEndpoints = (limit = 10) => {
  const endpoints = getEndpointMetrics();
  return endpoints
    .filter((e) => e.errors > 0)
    .sort((a, b) => parseFloat(b.errorRate) - parseFloat(a.errorRate))
    .slice(0, limit);
};

/**
 * Get total requests
 */
export const getTotalRequests = () => {
  return metricsStore.requests.total;
};

/**
 * Reset metrics (for testing)
 */
export const resetMetrics = () => {
  metricsStore.responseTimes = [];
  metricsStore.requests = {
    total: 0,
    perMinute: [],
    startTime: Date.now(),
  };
  metricsStore.errors = {
    total: 0,
    last1h: [],
    last24h: [],
  };
  metricsStore.endpoints.clear();
};

export default {
  metricsMiddleware,
  getResponseTimeMetrics,
  getRequestsPerMinute,
  getErrorMetrics,
  getEndpointMetrics,
  getSlowestEndpoints,
  getMostCalledEndpoints,
  getHighestErrorRateEndpoints,
  getTotalRequests,
  resetMetrics,
};
