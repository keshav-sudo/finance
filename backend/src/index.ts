/**
 * Application Entry Point — Local Dev Server
 *
 * Imports the Hono app from app.ts and starts it with @hono/node-server.
 * For Vercel deployment, see: api/index.ts
 *
 * Module Registration:
 *   /api/auth/*         → Better Auth (registration, login, session)
 *   /api/me             → Current user profile
 *   /api/transactions/* → Transaction extraction and listing
 *   /api/health/*       → Health check endpoints
 */

import { serve } from '@hono/node-server';
import { config } from './infrastructure/config/env.js';
import { logger } from './infrastructure/logger/index.js';
import { disconnectDatabase } from './infrastructure/database/prisma.js';
import app from './app.js';

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

  server.close(() => {
    logger.info('HTTP server closed');
  });

  await disconnectDatabase();

  logger.info('Shutdown complete');
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'Unhandled promise rejection');
});

process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught exception — shutting down');
  process.exit(1);
});
