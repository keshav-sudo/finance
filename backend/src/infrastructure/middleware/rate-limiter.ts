/**
 * Rate Limiter Middleware
 * 
 * Per-user sliding window rate limiter using an in-memory store.
 * In production, this would be backed by Redis for distributed rate limiting.
 * 
 * Design:
 * - Identified users are rate-limited by userId
 * - Anonymous requests are rate-limited by IP
 * - Returns standard rate limit headers (X-RateLimit-*)
 * - Returns 429 when limit is exceeded
 */

import { createMiddleware } from 'hono/factory';
import { RateLimitError } from '../../shared/errors/index.js';
import { createModuleLogger } from '../logger/index.js';

const log = createModuleLogger('rate-limiter');

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

/** In-memory store — replace with Redis in production for horizontal scaling */
const store = new Map<string, RateLimitEntry>();

// Periodic cleanup to prevent memory leaks from expired entries
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.resetAt <= now) {
      store.delete(key);
    }
  }
}, 60_000); // Cleanup every minute

interface RateLimitOptions {
  maxRequests: number;
  windowMs: number;
}

/**
 * Creates a rate-limiting middleware with the specified limits.
 * 
 * @param options.maxRequests - Maximum requests per window
 * @param options.windowMs - Window duration in milliseconds
 */
export function rateLimiter(options: RateLimitOptions) {
  return createMiddleware(async (c, next) => {
    // Use userId if authenticated, otherwise fall back to IP
    const userId = c.get('userId' as never) as string | undefined;
    const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown';
    const key = userId ? `user:${userId}` : `ip:${ip}`;

    const now = Date.now();
    let entry = store.get(key);

    // Create new window if expired or doesn't exist
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + options.windowMs };
      store.set(key, entry);
    }

    entry.count++;

    // Set rate limit headers for client awareness
    const remaining = Math.max(0, options.maxRequests - entry.count);
    c.header('X-RateLimit-Limit', String(options.maxRequests));
    c.header('X-RateLimit-Remaining', String(remaining));
    c.header('X-RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));

    if (entry.count > options.maxRequests) {
      log.warn({ key, count: entry.count }, 'Rate limit exceeded');
      throw new RateLimitError();
    }

    await next();
  });
}
