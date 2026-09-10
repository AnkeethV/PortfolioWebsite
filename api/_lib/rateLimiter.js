/**
 * In-memory sliding window rate limiter for /api/chat
 * Default: 15 requests per 10 minutes per IP
 */

const WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_REQUESTS = 15;

// Map of ip -> array of timestamps
const ipRequests = new Map();

/**
 * Get client IP from request headers or socket
 */
export function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.headers['x-real-ip'] || req.socket?.remoteAddress || '127.0.0.1';
}

/**
 * Check if the request is within rate limits
 * @param {string} ip
 * @returns {{ allowed: boolean, remaining: number, retryAfter: number }}
 */
export function checkRateLimit(ip) {
  const now = Date.now();
  let timestamps = ipRequests.get(ip) || [];

  // Filter out timestamps older than WINDOW_MS
  timestamps = timestamps.filter(time => now - time < WINDOW_MS);

  if (timestamps.length >= MAX_REQUESTS) {
    const oldestTimestamp = timestamps[0];
    const retryAfter = Math.ceil((WINDOW_MS - (now - oldestTimestamp)) / 1000);
    return {
      allowed: false,
      remaining: 0,
      retryAfter
    };
  }

  // Record new request
  timestamps.push(now);
  ipRequests.set(ip, timestamps);

  return {
    allowed: true,
    remaining: MAX_REQUESTS - timestamps.length,
    retryAfter: 0
  };
}

/**
 * Reset rate limits (useful for test runs)
 */
export function resetLimitsForTesting() {
  ipRequests.clear();
}

export default {
  getClientIp,
  checkRateLimit,
  resetLimitsForTesting
};
