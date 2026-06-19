/**
 * Better Auth Server Configuration
 * 
 * This is the core auth setup for the application. Better Auth handles:
 * - User registration with email/password (passwords are automatically hashed)
 * - Session management with configurable expiry
 * - Organization-based multi-tenancy for data isolation
 * 
 * Architecture Decision:
 * We use Better Auth's organization plugin to achieve multi-tenancy.
 * When a user registers, we auto-create a personal organization for them.
 * All transactions are scoped to this organizationId, ensuring complete
 * data isolation between users — even if someone modifies API requests.
 * 
 * The session token is stored as an HTTP-only cookie and also returned
 * in responses so the frontend can use it as a Bearer token.
 */

import { betterAuth } from 'better-auth';
import { organization } from 'better-auth/plugins';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { prisma } from '../../infrastructure/database/prisma.js';
import { config } from '../../infrastructure/config/env.js';
import { createModuleLogger } from '../../infrastructure/logger/index.js';

const log = createModuleLogger('auth');

export const auth = betterAuth({
  // Database adapter — Prisma connects Better Auth to our PostgreSQL
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),

  // Base URL for auth endpoints
  basePath: '/api/auth',

  // Secret for signing tokens/sessions
  secret: config.BETTER_AUTH_SECRET,

  // Trusted origins for CORS
  trustedOrigins: [config.FRONTEND_URL],

  // Email + Password authentication
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    autoSignIn: true, // Auto sign-in after registration
  },

  // Session configuration
  session: {
    expiresIn: 7 * 24 * 60 * 60, // 7 days in seconds
    updateAge: 24 * 60 * 60,     // Refresh session every 24 hours
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // Cache cookie validation for 5 minutes
    },
  },

  // Organization plugin for multi-tenancy
  plugins: [
    organization({
      allowUserToCreateOrganization: true,
    }),
  ],

  // Lifecycle hooks for logging and auto-org creation
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          log.info({ userId: user.id, email: user.email }, 'New user registered');

          // Auto-create a personal organization for the new user
          try {
            const slug = `personal-${user.id.slice(0, 8)}-${Date.now().toString(36)}`;
            const org = await prisma.organization.create({
              data: {
                name: `${user.name}'s Workspace`,
                slug,
                members: {
                  create: {
                    userId: user.id,
                    role: 'owner',
                  },
                },
              },
            });

            // Set the org as the active organization in the user's session
            log.info(
              { userId: user.id, orgId: org.id },
              'Personal organization created'
            );
          } catch (err) {
            log.error({ userId: user.id, err }, 'Failed to create personal organization');
          }
        },
      },
    },
  },
});

export type Auth = typeof auth;
