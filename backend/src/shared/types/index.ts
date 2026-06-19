/**
 * Shared Type Definitions
 * 
 * Canonical TypeScript types used across all modules.
 * These types form the contract between backend modules and
 * between the backend API and frontend.
 */

/** Standardized API response envelope */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  meta?: {
    pagination?: PaginationMeta;
    requestId?: string;
    timestamp?: string;
  };
}

/** Cursor-based pagination metadata */
export interface PaginationMeta {
  hasMore: boolean;
  nextCursor: string | null;
  totalCount?: number;
}

/** Parsed transaction data from the extraction engine */
export interface ParsedTransaction {
  date: Date;
  description: string;
  amount: number;
  type: 'DEBIT' | 'CREDIT';
  balance: number | null;
  category: string | null;
  reference: string | null;
  confidence: number; // 0-1 float
}

/** Auth context attached to requests by the auth middleware */
export interface AuthContext {
  userId: string;
  email: string;
  organizationId: string;
  organizationName: string;
}

/** Cursor-based pagination query parameters */
export interface PaginationQuery {
  cursor?: string;
  limit: number;
}
