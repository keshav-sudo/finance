/**
 * Transaction Service
 * 
 * Business logic layer for transaction operations.
 * All methods enforce data isolation by requiring organizationId and userId.
 * 
 * This service is the boundary between HTTP handlers and the database.
 * It contains all business rules and validation logic.
 */

import { prisma } from '../../infrastructure/database/prisma.js';
import { createModuleLogger } from '../../infrastructure/logger/index.js';
import { parseTransaction } from './transaction.parser.js';
import { ValidationError, NotFoundError } from '../../shared/errors/index.js';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, MIN_CONFIDENCE_THRESHOLD } from '../../shared/constants.js';
import type { AuthContext, PaginationMeta, ParsedTransaction } from '../../shared/types/index.js';

const log = createModuleLogger('transaction-service');

// ──────────────────────────────────────────────
// Extract & Save Transaction
// ──────────────────────────────────────────────

interface ExtractResult {
  transaction: {
    id: string;
    date: Date;
    description: string;
    amount: number;
    type: string;
    balance: number | null;
    category: string | null;
    reference: string | null;
    confidence: number;
    createdAt: Date;
  };
  parsed: ParsedTransaction;
}

/**
 * Parses raw text into a transaction and saves it to the database.
 * 
 * @param rawText - Raw bank statement text
 * @param auth - Authenticated user context (userId + organizationId)
 * @returns The saved transaction and parsed data
 * @throws ValidationError if the text cannot be parsed or confidence is too low
 */
export async function extractAndSaveTransaction(
  rawText: string,
  auth: AuthContext
): Promise<ExtractResult> {
  if (!rawText || rawText.trim().length === 0) {
    throw new ValidationError('Transaction text is required');
  }

  if (rawText.length > 5000) {
    throw new ValidationError('Transaction text must be under 5000 characters');
  }

  const parsed = parseTransaction(rawText);

  if (!parsed) {
    throw new ValidationError(
      'Could not extract transaction data from the provided text. Please check the format and try again.',
      { hint: 'Supported formats include labelled (Date:, Description:, Amount:), arrow (→), and inline formats.' }
    );
  }

  if (parsed.confidence < MIN_CONFIDENCE_THRESHOLD) {
    throw new ValidationError(
      `Extraction confidence too low (${(parsed.confidence * 100).toFixed(0)}%). Please provide clearer transaction text.`,
      { confidence: parsed.confidence, threshold: MIN_CONFIDENCE_THRESHOLD }
    );
  }

  // Save to database — scoped to the user's organization
  const transaction = await prisma.transaction.create({
    data: {
      date: parsed.date,
      description: parsed.description,
      amount: parsed.amount,
      type: parsed.type,
      balance: parsed.balance,
      category: parsed.category,
      reference: parsed.reference,
      confidence: parsed.confidence,
      rawText: rawText.trim(),
      userId: auth.userId,
      organizationId: auth.organizationId,
    },
  });

  log.info(
    {
      transactionId: transaction.id,
      userId: auth.userId,
      orgId: auth.organizationId,
      confidence: parsed.confidence,
    },
    'Transaction extracted and saved'
  );

  return { transaction, parsed };
}

// ──────────────────────────────────────────────
// List Transactions (Cursor-Based Pagination)
// ──────────────────────────────────────────────

interface ListTransactionsParams {
  auth: AuthContext;
  cursor?: string;
  limit?: number;
}

interface ListTransactionsResult {
  transactions: Array<{
    id: string;
    date: Date;
    description: string;
    amount: number;
    type: string;
    balance: number | null;
    category: string | null;
    reference: string | null;
    confidence: number;
    createdAt: Date;
  }>;
  pagination: PaginationMeta;
}

/**
 * Lists transactions for the authenticated user's organization.
 * Uses cursor-based pagination for stable, efficient pagination.
 * 
 * Cursor strategy:
 * - Uses the transaction ID as the cursor
 * - Orders by createdAt DESC, id DESC for stable ordering
 * - Fetches limit + 1 to determine if there are more results
 * 
 * Data isolation:
 * - Always filters by organizationId AND userId
 * - There is no way to see another user's transactions
 */
export async function listTransactions(
  params: ListTransactionsParams
): Promise<ListTransactionsResult> {
  const { auth, cursor } = params;
  const limit = Math.min(params.limit || DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);

  // Fetch one extra to determine if there are more results
  const transactions = await prisma.transaction.findMany({
    where: {
      organizationId: auth.organizationId,
      userId: auth.userId,
    },
    orderBy: [
      { createdAt: 'desc' },
      { id: 'desc' },
    ],
    ...(cursor && {
      cursor: { id: cursor },
      skip: 1, // Skip the cursor item itself
    }),
    take: limit + 1,
    select: {
      id: true,
      date: true,
      description: true,
      amount: true,
      type: true,
      balance: true,
      category: true,
      reference: true,
      confidence: true,
      createdAt: true,
    },
  });

  const hasMore = transactions.length > limit;
  const items = hasMore ? transactions.slice(0, limit) : transactions;
  const nextCursor = hasMore ? items[items.length - 1].id : null;

  log.debug(
    {
      userId: auth.userId,
      orgId: auth.organizationId,
      count: items.length,
      hasMore,
    },
    'Transactions listed'
  );

  return {
    transactions: items,
    pagination: {
      hasMore,
      nextCursor,
    },
  };
}

// ──────────────────────────────────────────────
// Get Single Transaction
// ──────────────────────────────────────────────

/**
 * Fetches a single transaction by ID, enforcing ownership.
 * 
 * @throws NotFoundError if transaction doesn't exist or belongs to another user/org
 */
export async function getTransaction(id: string, auth: AuthContext) {
  const transaction = await prisma.transaction.findFirst({
    where: {
      id,
      userId: auth.userId,
      organizationId: auth.organizationId,
    },
  });

  if (!transaction) {
    throw new NotFoundError('Transaction');
  }

  return transaction;
}
