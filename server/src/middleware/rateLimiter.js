// Rate Limiting Middleware
const rateLimit = require('express-rate-limit');

/**
 * General API rate limiter
 * 100 requests per 15 minutes per IP
 */
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10000,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too Many Requests',
    message: 'You have exceeded the rate limit. Please try again later.',
    code: 'RATE_LIMIT_EXCEEDED',
    retryAfter: '15 minutes',
  },
});

/**
 * Authentication rate limiter
 * 5 attempts per 15 minutes per IP (prevents brute force)
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too Many Requests',
    message: 'Too many authentication attempts. Please try again later.',
    code: 'AUTH_RATE_LIMIT_EXCEEDED',
    retryAfter: '15 minutes',
  },
});

/**
 * Sync rate limiter
 * 10 syncs per hour per IP
 */
const syncLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too Many Requests',
    message: 'Too many sync requests. Please try again later.',
    code: 'SYNC_RATE_LIMIT_EXCEEDED',
    retryAfter: '1 hour',
  },
});

module.exports = {
  generalLimiter,
  authLimiter,
  syncLimiter,
};
