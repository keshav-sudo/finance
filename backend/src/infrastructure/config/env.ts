/**
 * Environment Configuration Module
 * 
 * Validates all environment variables at startup using Zod schemas.
 * The application will fail fast if required variables are missing or invalid.
 * This prevents runtime errors from misconfigured environments.
 */

import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  // Server
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),

  // Database
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid PostgreSQL connection string'),

  // Better Auth
  BETTER_AUTH_SECRET: z.string().min(32, 'BETTER_AUTH_SECRET must be at least 32 characters'),
  BETTER_AUTH_URL: z.string().url('BETTER_AUTH_URL must be a valid URL'),

  // Frontend
  FRONTEND_URL: z.string().url('FRONTEND_URL must be a valid URL').default('http://localhost:3000'),

  // Rate Limiting
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
});

export type EnvConfig = z.infer<typeof envSchema>;

/**
 * Parse and validate environment variables.
 * Throws a descriptive error if validation fails.
 */
function loadConfig(): EnvConfig {
  // If running on Vercel, auto-populate URLs based on VERCEL_URL if they are not set
  if (process.env.VERCEL_URL) {
    const protocol = 'https';
    if (!process.env.FRONTEND_URL) {
      process.env.FRONTEND_URL = `${protocol}://${process.env.VERCEL_URL}`;
    }
    if (!process.env.BETTER_AUTH_URL) {
      process.env.BETTER_AUTH_URL = `${protocol}://${process.env.VERCEL_URL}/_/backend`;
    }
  }

  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const formatted = result.error.issues
      .map((issue) => `  ✗ ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');

    console.error(`\n❌ Invalid environment configuration:\n${formatted}\n`);
    process.exit(1);
  }

  return result.data;
}

/** Validated environment configuration — safe to use throughout the app */
export const config = loadConfig();
