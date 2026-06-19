/**
 * Auth Route Handler
 * 
 * Mounts Better Auth's built-in route handler on /api/auth/*.
 * Better Auth automatically provides all auth endpoints:
 * - POST /api/auth/sign-up/email
 * - POST /api/auth/sign-in/email
 * - POST /api/auth/sign-out
 * - GET  /api/auth/session
 * - And many more...
 * 
 * We also add a custom /api/auth/me endpoint for the frontend
 * to fetch the current user + organization info.
 */

import { Hono } from 'hono';
import { auth } from './auth.config.js';
import { authGuard, getAuthContext } from './auth.middleware.js';
import { createModuleLogger } from '../../infrastructure/logger/index.js';
import type { ApiResponse, AuthContext } from '../../shared/types/index.js';

const log = createModuleLogger('auth-routes');

export const authRoutes = new Hono();

/**
 * Mount Better Auth handler — catches all /api/auth/* requests.
 * Better Auth handles routing internally (sign-up, sign-in, sign-out, session, etc.)
 */
authRoutes.all('/api/auth/*', (c) => {
  return auth.handler(c.req.raw);
});

/**
 * GET /api/auth/me — Custom endpoint
 * Returns the authenticated user's profile and organization info.
 * Useful for the frontend to display user state after page loads.
 */
authRoutes.get('/api/me', authGuard, (c) => {
  const authContext = getAuthContext(c);

  log.info({ userId: authContext.userId }, 'User profile fetched');

  const response: ApiResponse<AuthContext> = {
    success: true,
    data: authContext,
  };

  return c.json(response);
});
