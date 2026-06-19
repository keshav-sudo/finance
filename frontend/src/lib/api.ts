/**
 * API Client Module
 * 
 * Provides typed API functions for communicating with the backend.
 * All requests automatically include credentials (cookies) for auth.
 * 
 * Design:
 * - Centralized fetch wrapper with error handling
 * - Typed response parsing
 * - Automatic JSON content type headers
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

/** Standard API response envelope from the backend */
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  meta?: {
    pagination?: {
      hasMore: boolean;
      nextCursor: string | null;
    };
  };
}

/** Custom error class for API errors */
export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Generic fetch wrapper with error handling.
 * Automatically includes credentials and parses JSON responses.
 */
async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const url = `${API_URL}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    credentials: 'include', // Send cookies for auth
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  const data: ApiResponse<T> = await response.json();

  if (!response.ok || !data.success) {
    throw new ApiError(
      data.error?.code || 'UNKNOWN_ERROR',
      data.error?.message || 'An unexpected error occurred',
      response.status,
      data.error?.details
    );
  }

  return data;
}

// ──────────────────────────────────────────────
// Transaction API
// ──────────────────────────────────────────────

export interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: 'DEBIT' | 'CREDIT';
  balance: number | null;
  category: string | null;
  reference: string | null;
  confidence: number;
  createdAt: string;
}

export interface ExtractResult {
  transaction: Transaction;
  parsed: {
    date: string;
    description: string;
    amount: number;
    type: 'DEBIT' | 'CREDIT';
    balance: number | null;
    category: string | null;
    reference: string | null;
    confidence: number;
  };
}

export interface TransactionListResult {
  transactions: Transaction[];
  pagination: {
    hasMore: boolean;
    nextCursor: string | null;
  };
}

/**
 * Extract a transaction from raw text and save it.
 * POST /api/transactions/extract
 */
export async function extractTransaction(text: string): Promise<ExtractResult> {
  const response = await apiFetch<ExtractResult>('/api/transactions/extract', {
    method: 'POST',
    body: JSON.stringify({ text }),
  });
  return response.data!;
}

/**
 * List transactions with cursor-based pagination.
 * GET /api/transactions?cursor=...&limit=...
 */
export async function listTransactions(
  cursor?: string,
  limit = 20
): Promise<TransactionListResult> {
  const params = new URLSearchParams();
  if (cursor) params.set('cursor', cursor);
  params.set('limit', String(limit));

  const response = await apiFetch<TransactionListResult>(
    `/api/transactions?${params.toString()}`
  );
  return response.data!;
}

/**
 * Get the current authenticated user's profile.
 * GET /api/me
 */
export async function getCurrentUser() {
  const response = await apiFetch<{
    userId: string;
    email: string;
    organizationId: string;
    organizationName: string;
  }>('/api/me');
  return response.data!;
}
