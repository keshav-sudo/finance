/**
 * Hono Application Factory
 *
 * This file creates and exports the Hono app instance WITHOUT starting
 * the HTTP server. This allows the same app to be used in:
 *   - Local dev:  src/index.ts  (uses @hono/node-server)
 *   - Vercel:     api/index.ts  (exported as serverless handler)
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { config } from './infrastructure/config/env.js';
import { requestLogger, globalErrorHandler, rateLimiter } from './infrastructure/middleware/index.js';
import { authRoutes } from './modules/auth/index.js';
import { transactionRoutes } from './modules/transactions/index.js';
import { healthRoutes } from './modules/health/index.js';

const app = new Hono();

// ──────────────────────────────────────────────
// Global Middleware
// ──────────────────────────────────────────────

// CORS — allow frontend origin with credentials
app.use(
  '*',
  cors({
    origin: config.FRONTEND_URL,
    credentials: true,
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    exposeHeaders: ['X-Request-Id', 'X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
    maxAge: 86400,
  })
);

// Request logging
app.use('*', requestLogger);

// Global rate limiting
app.use(
  '/api/*',
  rateLimiter({
    maxRequests: config.RATE_LIMIT_MAX,
    windowMs: config.RATE_LIMIT_WINDOW_MS,
  })
);

// Global error handler
app.onError(globalErrorHandler);

// ──────────────────────────────────────────────
// Route Registration
// ──────────────────────────────────────────────

app.route('/', authRoutes);
app.route('/api/transactions', transactionRoutes);
app.route('/api/health', healthRoutes);

// 404 catch-all
app.notFound((c) => {
  return c.json(
    {
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `Route ${c.req.method} ${c.req.path} not found`,
      },
    },
    404
  );
});

export default app;
