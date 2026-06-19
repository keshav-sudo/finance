/**
 * Structured Logger Module (Pino)
 * 
 * Provides structured JSON logging in production and pretty-printed
 * logs in development. Each log entry includes timestamps, log levels,
 * and contextual metadata for easy debugging and observability.
 * 
 * Usage:
 *   import { logger } from '@infrastructure/logger';
 *   logger.info({ userId: '123' }, 'User logged in');
 */

import pino from 'pino';
import { config } from '../config/env.js';

const isDev = config.NODE_ENV === 'development';

export const logger = pino({
  level: isDev ? 'debug' : 'info',
  timestamp: pino.stdTimeFunctions.isoTime,

  // Pretty printing in development for readability
  ...(isDev && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss.l',
        ignore: 'pid,hostname',
      },
    },
  }),

  // Redact sensitive fields from logs
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie', 'password'],
    censor: '[REDACTED]',
  },
});

/**
 * Creates a child logger with module-specific context.
 * 
 * @example
 * const log = createModuleLogger('auth');
 * log.info('User registered'); // logs with { module: 'auth' }
 */
export function createModuleLogger(module: string) {
  return logger.child({ module });
}
