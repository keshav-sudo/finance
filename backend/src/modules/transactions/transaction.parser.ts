/**
 * Transaction Parser — Smart Text Extraction Engine
 * 
 * Parses raw bank statement text into structured transaction data.
 * Uses a multi-strategy approach where multiple parsers attempt to
 * extract data, and the best result (by confidence) wins.
 * 
 * Architecture:
 * 1. Normalize the input text (strip whitespace, unify line endings)
 * 2. Run all parser strategies in parallel
 * 3. Select the result with the highest confidence score
 * 4. Apply category inference based on the description
 * 
 * Confidence Scoring:
 * - Each successfully extracted field adds to the confidence
 * - Date: +0.25, Description: +0.20, Amount: +0.25, Balance: +0.15, Reference: +0.10, Category: +0.05
 * - Final score is capped at 1.0
 * 
 * Supported Formats:
 * - Format 1: "Date: DD MMM YYYY\nDescription: ...\nAmount: -XXX.XX\nBalance: XXX.XX"
 * - Format 2: "Description\nDD/MM/YYYY → ₹XXX debited\nBalance → ₹XXX"
 * - Format 3: "txnRef YYYY-MM-DD Description ₹XXX Dr/Cr Bal XXX Category"
 */

import type { ParsedTransaction } from '../../shared/types/index.js';
import { createModuleLogger } from '../../infrastructure/logger/index.js';

const log = createModuleLogger('transaction-parser');

// ──────────────────────────────────────────────
// Main Parser Entry Point
// ──────────────────────────────────────────────

/**
 * Parses raw bank statement text into structured transaction data.
 * Tries multiple strategies and returns the highest-confidence result.
 * 
 * @param rawText - The raw bank statement text to parse
 * @returns ParsedTransaction or null if no strategy could extract data
 */
export function parseTransaction(rawText: string): ParsedTransaction | null {
  const normalizedText = normalizeText(rawText);

  log.debug({ textLength: rawText.length }, 'Parsing transaction text');

  // Run all strategies and collect results
  const strategies: ParserStrategy[] = [
    parseFormatLabelled,     // Format 1: "Date: ...\nDescription: ...\nAmount: ..."
    parseFormatArrow,        // Format 2: "Description\nDD/MM/YYYY → ₹XXX debited"
    parseFormatInline,       // Format 3: "txnRef YYYY-MM-DD Description ₹XXX Dr Bal XXX"
  ];

  const results: ParsedTransaction[] = [];

  for (const strategy of strategies) {
    try {
      const result = strategy(normalizedText, rawText);
      if (result) {
        results.push(result);
        log.debug(
          { strategy: strategy.name, confidence: result.confidence },
          'Strategy produced result'
        );
      }
    } catch (err) {
      log.warn({ strategy: strategy.name, err }, 'Strategy threw an error');
    }
  }

  if (results.length === 0) {
    log.warn({ rawText: rawText.slice(0, 100) }, 'No parser strategy could extract data');
    return null;
  }

  // Return the highest-confidence result
  const best = results.sort((a, b) => b.confidence - a.confidence)[0];
  log.info(
    { confidence: best.confidence, description: best.description },
    'Transaction parsed successfully'
  );

  return best;
}

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

type ParserStrategy = (normalizedText: string, rawText: string) => ParsedTransaction | null;

// ──────────────────────────────────────────────
// Text Normalization
// ──────────────────────────────────────────────

function normalizeText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')           // Unify line endings
    .replace(/\t/g, ' ')              // Replace tabs with spaces
    .replace(/(?:₹|Rs\.?|INR)\s*/gi, '') // Remove currency symbols specifically
    .replace(/,(\d{3})/g, '$1')       // Remove thousands separators: 18,420 → 18420
    .trim();
}

// ──────────────────────────────────────────────
// Date Parsing Utilities
// ──────────────────────────────────────────────

const MONTHS: Record<string, number> = {
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, september: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11,
};

/**
 * Parse various date formats into a Date object.
 * Supports: "11 Dec 2025", "12/11/2025", "2025-12-10"
 */
function parseDate(dateStr: string): Date | null {
  const trimmed = dateStr.trim();

  // Format: DD MMM YYYY (e.g., "11 Dec 2025")
  const namedMonthMatch = trimmed.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
  if (namedMonthMatch) {
    const day = parseInt(namedMonthMatch[1], 10);
    const monthStr = namedMonthMatch[2].toLowerCase();
    const year = parseInt(namedMonthMatch[3], 10);
    const month = MONTHS[monthStr];
    if (month !== undefined) {
      return new Date(year, month, day);
    }
  }

  // Format: DD/MM/YYYY (e.g., "12/11/2025")
  const slashMatch = trimmed.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (slashMatch) {
    const day = parseInt(slashMatch[1], 10);
    const month = parseInt(slashMatch[2], 10) - 1;
    const year = parseInt(slashMatch[3], 10);
    return new Date(year, month, day);
  }

  // Format: YYYY-MM-DD (e.g., "2025-12-10")
  const isoMatch = trimmed.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10) - 1;
    const day = parseInt(isoMatch[3], 10);
    return new Date(year, month, day);
  }

  return null;
}

// ──────────────────────────────────────────────
// Category Inference
// ──────────────────────────────────────────────

/**
 * Infers transaction category from the description using keyword matching.
 * Returns null if no category can be inferred.
 */
function inferCategory(description: string): string | null {
  const lower = description.toLowerCase();

  const categoryKeywords: Record<string, string[]> = {
    'Food & Dining': ['starbucks', 'coffee', 'restaurant', 'food', 'cafe', 'zomato', 'swiggy', 'dining', 'pizza', 'burger', 'mcdonalds', 'kfc'],
    'Transportation': ['uber', 'ola', 'lyft', 'taxi', 'cab', 'ride', 'metro', 'bus', 'airport', 'petrol', 'fuel', 'gas'],
    'Shopping': ['amazon', 'flipkart', 'myntra', 'shopping', 'order', 'purchase', 'buy', 'store', 'mall', 'market'],
    'Entertainment': ['netflix', 'spotify', 'movie', 'cinema', 'game', 'subscription', 'prime', 'hotstar', 'disney'],
    'Bills & Utilities': ['electricity', 'water', 'gas', 'internet', 'phone', 'mobile', 'recharge', 'broadband', 'wifi', 'bill'],
    'Travel': ['hotel', 'flight', 'booking', 'travel', 'trip', 'airline', 'makemytrip', 'goibibo', 'irctc'],
    'Finance': ['transfer', 'upi', 'neft', 'imps', 'emi', 'loan', 'insurance', 'mutual fund', 'investment', 'bank'],
  };

  for (const [category, keywords] of Object.entries(categoryKeywords)) {
    if (keywords.some((kw) => lower.includes(kw))) {
      return category;
    }
  }

  return null;
}

// ──────────────────────────────────────────────
// Confidence Score Calculator
// ──────────────────────────────────────────────

interface ConfidenceFactors {
  hasDate: boolean;
  hasDescription: boolean;
  hasAmount: boolean;
  hasBalance: boolean;
  hasReference: boolean;
  hasCategory: boolean;
}

/**
 * Calculates a confidence score (0-1) based on which fields
 * were successfully extracted from the raw text.
 */
function calculateConfidence(factors: ConfidenceFactors): number {
  let score = 0;

  if (factors.hasDate) score += 0.25;
  if (factors.hasDescription) score += 0.20;
  if (factors.hasAmount) score += 0.25;
  if (factors.hasBalance) score += 0.15;
  if (factors.hasReference) score += 0.10;
  if (factors.hasCategory) score += 0.05;

  return Math.min(score, 1.0);
}

// ──────────────────────────────────────────────
// Strategy 1: Labelled Format
// ──────────────────────────────────────────────
// Handles:
//   Date: 11 Dec 2025
//   Description: STARBUCKS COFFEE MUMBAI
//   Amount: -420.00
//   Balance after transaction: 18,420.50

function parseFormatLabelled(text: string, rawText: string): ParsedTransaction | null {
  // Extract date
  const dateMatch = text.match(/date\s*:\s*(.+)/i);
  const date = dateMatch ? parseDate(dateMatch[1]) : null;
  if (!date) return null;

  // Extract description
  const descMatch = text.match(/description\s*:\s*(.+)/i);
  const description = descMatch ? descMatch[1].trim() : null;
  if (!description) return null;

  // Extract amount
  const amountMatch = text.match(/amount\s*:\s*([+-]?\s*[\d.]+)/i);
  const amount = amountMatch ? parseFloat(amountMatch[1].replace(/\s/g, '')) : null;
  if (amount === null || isNaN(amount)) return null;

  // Extract balance
  const balanceMatch = text.match(/balance\s*(?:after\s*transaction)?\s*:\s*([\d.]+)/i);
  const balance = balanceMatch ? parseFloat(balanceMatch[1]) : null;

  // Determine debit/credit from amount sign
  const type = amount < 0 ? 'DEBIT' : 'CREDIT';
  const absAmount = Math.abs(amount);

  const category = inferCategory(description);

  return {
    date,
    description,
    amount: absAmount,
    type,
    balance,
    category,
    reference: null,
    confidence: calculateConfidence({
      hasDate: true,
      hasDescription: true,
      hasAmount: true,
      hasBalance: balance !== null,
      hasReference: false,
      hasCategory: category !== null,
    }),
  };
}

// ──────────────────────────────────────────────
// Strategy 2: Arrow Format
// ──────────────────────────────────────────────
// Handles:
//   Uber Ride * Airport Drop
//   12/11/2025 → ₹1,250.00 debited
//   Available Balance → ₹17,170.50

function parseFormatArrow(text: string, rawText: string): ParsedTransaction | null {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

  if (lines.length < 2) return null;

  // First line(s) = description (before any line with a date)
  let description: string | null = null;
  let date: Date | null = null;
  let amount: number | null = null;
  let balance: number | null = null;
  let type: 'DEBIT' | 'CREDIT' = 'DEBIT';

  for (const line of lines) {
    // Try to find date + amount line
    const dateAmountMatch = line.match(
      /(\d{1,2}\/\d{1,2}\/\d{4})\s*[→\->]+\s*([\d.]+)\s*(debited|credited)/i
    );

    if (dateAmountMatch) {
      date = parseDate(dateAmountMatch[1]);
      amount = parseFloat(dateAmountMatch[2]);
      type = dateAmountMatch[3].toLowerCase() === 'debited' ? 'DEBIT' : 'CREDIT';
      continue;
    }

    // Try to find balance line
    const balanceMatch = line.match(/balance\s*[→\->]+\s*([\d.]+)/i);
    if (balanceMatch) {
      balance = parseFloat(balanceMatch[1]);
      continue;
    }

    // Otherwise it's part of the description
    if (!description) {
      description = line;
    }
  }

  if (!date || !description || amount === null) return null;

  const category = inferCategory(description);

  return {
    date,
    description,
    amount,
    type,
    balance,
    category,
    reference: null,
    confidence: calculateConfidence({
      hasDate: true,
      hasDescription: true,
      hasAmount: true,
      hasBalance: balance !== null,
      hasReference: false,
      hasCategory: category !== null,
    }),
  };
}

// ──────────────────────────────────────────────
// Strategy 3: Inline/Messy Format
// ──────────────────────────────────────────────
// Handles:
//   txn123 2025-12-10 Amazon.in Order #403-1234567-8901234 ₹2,999.00 Dr Bal 14171.50 Shopping

function parseFormatInline(text: string, rawText: string): ParsedTransaction | null {
  // Try to find a reference ID at the start
  const refMatch = text.match(/^([a-zA-Z]*\d+)\s+/);
  const reference = refMatch ? refMatch[1] : null;

  // Find ISO date
  const dateMatch = text.match(/(\d{4}-\d{1,2}-\d{1,2})/);
  const date = dateMatch ? parseDate(dateMatch[1]) : null;
  if (!date) return null;

  // Find amount — look for a number followed by Dr/Cr
  const amountMatch = text.match(/([\d.]+)\s*(Dr|Cr|debit|credit)/i);
  const amount = amountMatch ? parseFloat(amountMatch[1]) : null;
  if (amount === null || isNaN(amount)) return null;

  const typeIndicator = amountMatch![2].toLowerCase();
  const type = typeIndicator === 'dr' || typeIndicator === 'debit' ? 'DEBIT' : 'CREDIT';

  // Find balance
  const balanceMatch = text.match(/bal\s*([\d.]+)/i);
  const balance = balanceMatch ? parseFloat(balanceMatch[1]) : null;

  // Description: everything between the date and the amount
  let description = '';
  if (dateMatch && amountMatch) {
    const dateEnd = dateMatch.index! + dateMatch[0].length;
    const amountStart = amountMatch.index!;
    description = text.slice(dateEnd, amountStart).trim();
  }

  if (!description) return null;

  // Check for trailing category hint
  const trailingCategory = text.match(/(?:Bal\s*[\d.]+)\s+([A-Za-z]+)\s*$/i);
  const explicitCategory = trailingCategory ? trailingCategory[1] : null;
  const category = explicitCategory || inferCategory(description);

  return {
    date,
    description,
    amount,
    type,
    balance,
    category,
    reference,
    confidence: calculateConfidence({
      hasDate: true,
      hasDescription: true,
      hasAmount: true,
      hasBalance: balance !== null,
      hasReference: reference !== null,
      hasCategory: category !== null,
    }),
  };
}
