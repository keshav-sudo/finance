/**
 * Health Check Routes
 * 
 * Provides liveness and readiness probes for container orchestration.
 * - /api/health — Basic liveness check
 * - /api/health/ready — Readiness check (includes DB connectivity)
 */

import { Hono } from 'hono';
import { prisma } from '../../infrastructure/database/prisma.js';
import type { ApiResponse } from '../../shared/types/index.js';

export const healthRoutes = new Hono();

/** Liveness probe — is the process running? */
healthRoutes.get('/', (c) => {
  const response: ApiResponse<{ status: string; uptime: number }> = {
    success: true,
    data: {
      status: 'healthy',
      uptime: process.uptime(),
    },
  };
  return c.json(response);
});

/** Readiness probe — can the app serve traffic? (checks DB) */
healthRoutes.get('/ready', async (c) => {
  try {
    await prisma.$queryRaw`SELECT 1`;

    const response: ApiResponse<{ status: string; database: string }> = {
      success: true,
      data: {
        status: 'ready',
        database: 'connected',
      },
    };
    return c.json(response);
  } catch {
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'NOT_READY',
        message: 'Database is not connected',
      },
    };
    return c.json(response, 503);
  }
});
