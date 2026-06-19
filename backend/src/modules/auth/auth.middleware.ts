/**
 * Auth Guard Middleware
 * 
 * Protects routes by verifying the Better Auth session.
 * Extracts the authenticated user and their active organization,
 * then attaches the auth context to the Hono context for downstream use.
 * 
 * Usage:
 *   app.get('/protected', authGuard, (c) => {
 *     const auth = c.get('authContext');
 *     // auth.userId, auth.organizationId, etc.
 *   });
 */

import { createMiddleware } from 'hono/factory';
import { auth } from './auth.config.js';
import { UnauthorizedError, ForbiddenError } from '../../shared/errors/index.js';
import { createModuleLogger } from '../../infrastructure/logger/index.js';
import { prisma } from '../../infrastructure/database/prisma.js';
import type { AuthContext } from '../../shared/types/index.js';

const log = createModuleLogger('auth-guard');

/**
 * Middleware that validates the session and attaches auth context.
 * 
 * Flow:
 * 1. Extract session from request (cookie or Bearer token)
 * 2. Verify session is valid and not expired
 * 3. Look up user's organization membership
 * 4. Attach AuthContext to Hono context
 * 
 * Throws UnauthorizedError if session is invalid.
 * Throws ForbiddenError if user has no organization.
 */
export const authGuard = createMiddleware(async (c, next) => {
  try {
    const session = await auth.api.getSession({
      headers: c.req.raw.headers,
    });

    if (!session || !session.user) {
      throw new UnauthorizedError('Invalid or expired session');
    }

    const { user } = session;

    // Find the user's organization membership
    const membership = await prisma.member.findFirst({
      where: { userId: user.id },
      include: { organization: true },
      orderBy: { createdAt: 'asc' }, // Get the first (primary) org
    });

    if (!membership) {
      log.warn({ userId: user.id }, 'User has no organization membership');
      throw new ForbiddenError('No organization found. Please contact support.');
    }

    // Build auth context
    const authContext: AuthContext = {
      userId: user.id,
      email: user.email,
      organizationId: membership.organizationId,
      organizationName: membership.organization.name,
    };

    // Attach to Hono context for downstream handlers
    c.set('authContext' as never, authContext);

    log.debug(
      { userId: authContext.userId, orgId: authContext.organizationId },
      'Request authenticated'
    );

    await next();
  } catch (err) {
    if (err instanceof UnauthorizedError || err instanceof ForbiddenError) {
      throw err;
    }
    log.error({ err }, 'Auth guard failed');
    throw new UnauthorizedError('Authentication failed');
  }
});

/**
 * Helper to extract the auth context from a Hono context.
 * Use this in route handlers after the authGuard middleware.
 */
export function getAuthContext(c: { get: (key: string) => unknown }): AuthContext {
  const ctx = c.get('authContext' as never) as AuthContext | undefined;
  if (!ctx) {
    throw new UnauthorizedError('Auth context not found');
  }
  return ctx;
}
