/**
 * Global Error Handler Middleware
 * 
 * Catches all unhandled errors and serializes them into a consistent
 * API response format. Distinguishes between known AppErrors (which
 * carry status codes) and unexpected errors (which become 500s).
 * 
 * In production, unexpected error details are hidden from the client
 * to prevent information leakage.
 */

import { ErrorHandler } from 'hono';
import { AppError } from '../../shared/errors/index.js';
import { createModuleLogger } from '../logger/index.js';
import type { ApiResponse } from '../../shared/types/index.js';

const log = createModuleLogger('error-handler');

export const globalErrorHandler: ErrorHandler = (err, c) => {
  // Known application errors — controlled responses
  if (err instanceof AppError) {
    log.warn(
      { code: err.code, statusCode: err.statusCode, details: err.details },
      err.message
    );

    const body: ApiResponse = {
      success: false,
      error: {
        code: err.code,
        message: err.message,
        ...(err.details && { details: err.details }),
      },
    };

    return c.json(body, err.statusCode as 400);
  }

  // Unexpected errors — log full stack, return generic message
  log.error({ err, stack: (err as Error).stack }, 'Unhandled error');

  const isDev = process.env.NODE_ENV === 'development';

  const body: ApiResponse = {
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: isDev
        ? (err as Error).message
        : 'An unexpected error occurred. Please try again later.',
    },
  };

  return c.json(body, 500);
};
