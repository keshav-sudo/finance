/**
 * Application Entry Point — Hono Server
 * 
 * This file assembles the modular monolith:
 * 1. Loads and validates environment configuration
 * 2. Initializes global middleware (CORS, logging, error handling)
 * 3. Mounts module route handlers
 * 4. Starts the HTTP server with graceful shutdown
 * 
 * Module Registration:
 *   /api/auth/*         → Better Auth (registration, login, session)
 *   /api/me             → Current user profile
 *   /api/transactions/* → Transaction extraction and listing
 *   /api/health/*       → Health check endpoints
 */

import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { config } from './infrastructure/config/env.js';
import { logger } from './infrastructure/logger/index.js';
import { requestLogger, globalErrorHandler, rateLimiter } from './infrastructure/middleware/index.js';
import { disconnectDatabase } from './infrastructure/database/prisma.js';
import { authRoutes } from './modules/auth/index.js';
import { transactionRoutes } from './modules/transactions/index.js';
import { healthRoutes } from './modules/health/index.js';

// ──────────────────────────────────────────────
// App Initialization
// ──────────────────────────────────────────────

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

// Global rate limiting (per-IP for unauthenticated, per-user for authenticated)
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

// Auth module — handles /api/auth/* and /api/me
app.route('/', authRoutes);

// Transaction module — handles /api/transactions/*
app.route('/api/transactions', transactionRoutes);

// Health module — handles /api/health/*
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

// ──────────────────────────────────────────────
// Server Startup
// ──────────────────────────────────────────────

const server = serve(
  {
    fetch: app.fetch,
    port: config.PORT,
  },
  (info) => {
    logger.info(
      {
        port: info.port,
        env: config.NODE_ENV,
        frontendUrl: config.FRONTEND_URL,
      },
      `🚀 Vessify API server running on http://localhost:${info.port}`
    );
  }
);

// ──────────────────────────────────────────────
// Graceful Shutdown
// ──────────────────────────────────────────────

async function shutdown(signal: string) {
  logger.info({ signal }, 'Received shutdown signal, closing gracefully...');

  // Close HTTP server
  server.close(() => {
    logger.info('HTTP server closed');
  });

  // Close database connections
  await disconnectDatabase();

  logger.info('Shutdown complete');
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Catch unhandled rejections
process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'Unhandled promise rejection');
});

process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught exception — shutting down');
  process.exit(1);
});
