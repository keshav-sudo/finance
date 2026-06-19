/**
 * Application Constants
 * 
 * Centralized constants prevent magic numbers and strings
 * scattered across the codebase. Makes the system easier to
 * tune and reason about.
 */

/** Default pagination limit */
export const DEFAULT_PAGE_SIZE = 20;

/** Maximum pagination limit to prevent abuse */
export const MAX_PAGE_SIZE = 100;

/** Minimum confidence threshold for parsed transactions */
export const MIN_CONFIDENCE_THRESHOLD = 0.3;

/** Session expiry duration in seconds (7 days) */
export const SESSION_EXPIRY_SECONDS = 7 * 24 * 60 * 60;

/** Rate limit window in milliseconds (1 minute) */
export const RATE_LIMIT_WINDOW_MS = 60_000;

/** Default rate limit per window */
export const DEFAULT_RATE_LIMIT = 100;

/** Transaction types */
export const TRANSACTION_TYPES = {
  DEBIT: 'DEBIT',
  CREDIT: 'CREDIT',
} as const;

/** Supported transaction categories */
export const TRANSACTION_CATEGORIES = [
  'Food & Dining',
  'Transportation',
  'Shopping',
  'Entertainment',
  'Bills & Utilities',
  'Health & Fitness',
  'Travel',
  'Education',
  'Finance',
  'Other',
] as const;
