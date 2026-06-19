/**
 * Transaction Routes
 * 
 * HTTP route handlers for the transaction module.
 * All routes are protected by the auth guard middleware.
 * 
 * Routes:
 *   POST /api/transactions/extract — Parse raw text and save transaction
 *   GET  /api/transactions         — List transactions with cursor pagination
 *   GET  /api/transactions/:id     — Get a single transaction by ID
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { authGuard, getAuthContext } from '../auth/auth.middleware.js';
import { rateLimiter } from '../../infrastructure/middleware/rate-limiter.js';
import * as transactionService from './transaction.service.js';
import { ValidationError } from '../../shared/errors/index.js';
import { MAX_PAGE_SIZE } from '../../shared/constants.js';
import type { ApiResponse } from '../../shared/types/index.js';
import { createModuleLogger } from '../../infrastructure/logger/index.js';

const log = createModuleLogger('transaction-routes');

export const transactionRoutes = new Hono();

// ──────────────────────────────────────────────
// Request Validation Schemas
// ──────────────────────────────────────────────

const extractSchema = z.object({
  text: z.string().min(1, 'Text is required').max(5000, 'Text must be under 5000 characters'),
});

const listQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().positive().max(MAX_PAGE_SIZE).optional(),
});

// ──────────────────────────────────────────────
// POST /api/transactions/extract
// ──────────────────────────────────────────────

transactionRoutes.post(
  '/extract',
  authGuard,
  rateLimiter({ maxRequests: 30, windowMs: 60_000 }), // 30 extractions per minute
  async (c) => {
    const auth = getAuthContext(c);
    const body = await c.req.json();

    // Validate request body
    const parsed = extractSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError('Invalid request body', {
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    const result = await transactionService.extractAndSaveTransaction(
      parsed.data.text,
      auth
    );

    log.info(
      { transactionId: result.transaction.id, userId: auth.userId },
      'Transaction extracted via API'
    );

    const response: ApiResponse<typeof result> = {
      success: true,
      data: result,
    };

    return c.json(response, 201);
  }
);

// ──────────────────────────────────────────────
// GET /api/transactions
// ──────────────────────────────────────────────

transactionRoutes.get(
  '/',
  authGuard,
  async (c) => {
    const auth = getAuthContext(c);

    // Parse query params
    const queryParsed = listQuerySchema.safeParse({
      cursor: c.req.query('cursor'),
      limit: c.req.query('limit'),
    });

    if (!queryParsed.success) {
      throw new ValidationError('Invalid query parameters', {
        errors: queryParsed.error.flatten().fieldErrors,
      });
    }

    const result = await transactionService.listTransactions({
      auth,
      cursor: queryParsed.data.cursor,
      limit: queryParsed.data.limit,
    });

    const response: ApiResponse<typeof result> = {
      success: true,
      data: result,
      meta: {
        pagination: result.pagination,
      },
    };

    return c.json(response);
  }
);

// ──────────────────────────────────────────────
// GET /api/transactions/:id
// ──────────────────────────────────────────────

transactionRoutes.get(
  '/:id',
  authGuard,
  async (c) => {
    const auth = getAuthContext(c);
    const id = c.req.param('id');

    const transaction = await transactionService.getTransaction(id, auth);

    const response: ApiResponse<typeof transaction> = {
      success: true,
      data: transaction,
    };

    return c.json(response);
  }
);
