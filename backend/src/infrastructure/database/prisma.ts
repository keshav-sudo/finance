/**
 * Prisma Client Singleton
 * 
 * Ensures a single PrismaClient instance is reused across the application.
 * In development, we store the client on globalThis to survive HMR reloads
 * without creating connection pool exhaustion.
 * 
 * This pattern is recommended by Prisma for serverless and dev environments.
 */

import { PrismaClient } from '@prisma/client';
import { createModuleLogger } from '../logger/index.js';

const log = createModuleLogger('database');

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? [
            { emit: 'event', level: 'query' },
            { emit: 'stdout', level: 'error' },
            { emit: 'stdout', level: 'warn' },
          ]
        : [{ emit: 'stdout', level: 'error' }],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

/**
 * Graceful shutdown hook — close the Prisma connection pool.
 * Prevents connection leaks when the process exits.
 */
export async function disconnectDatabase(): Promise<void> {
  log.info('Closing database connections...');
  await prisma.$disconnect();
  log.info('Database connections closed');
}
