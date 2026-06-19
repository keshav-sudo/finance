/**
 * Request Logger Middleware
 * 
 * Logs every incoming request with method, path, status, and duration.
 * Generates a unique request ID for correlation across log entries.
 * 
 * In production, this is essential for debugging and monitoring.
 */

import { createMiddleware } from 'hono/factory';
import { createModuleLogger } from '../logger/index.js';

const log = createModuleLogger('http');

let requestCounter = 0;

/**
 * Generates a short, unique request ID for log correlation.
 * Format: "req_<timestamp>_<counter>"
 */
function generateRequestId(): string {
  return `req_${Date.now().toString(36)}_${(++requestCounter).toString(36)}`;
}

export const requestLogger = createMiddleware(async (c, next) => {
  const requestId = generateRequestId();
  const start = performance.now();
  const method = c.req.method;
  const path = c.req.path;

  // Attach request ID to response headers for client-side correlation
  c.header('X-Request-Id', requestId);

  log.info({ requestId, method, path }, `→ ${method} ${path}`);

  await next();

  const duration = Math.round(performance.now() - start);
  const status = c.res.status;

  const logFn = status >= 500 ? log.error.bind(log) : status >= 400 ? log.warn.bind(log) : log.info.bind(log);

  logFn(
    { requestId, method, path, status, duration: `${duration}ms` },
    `← ${method} ${path} ${status} (${duration}ms)`
  );
});
