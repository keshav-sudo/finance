/**
 * Transaction Parser Tests
 * 
 * Tests the core parsing engine against all three sample formats
 * specified in the assignment requirements. Each test verifies:
 * - Correct field extraction (date, description, amount, etc.)
 * - Proper transaction type detection (debit vs credit)
 * - Confidence score reasonability
 * - Category inference accuracy
 */

import { describe, it, expect } from 'vitest';
import { parseTransaction } from '../src/modules/transactions/transaction.parser.js';

describe('Transaction Parser', () => {
  // ────────────────────────────────────
  // Sample 1: Labelled Format
  // ────────────────────────────────────
  describe('Sample 1 — Labelled Format', () => {
    const sample1 = `Date: 11 Dec 2025
Description: STARBUCKS COFFEE MUMBAI
Amount: -420.00
Balance after transaction: 18,420.50`;

    it('should parse labelled format correctly', () => {
      const result = parseTransaction(sample1);

      expect(result).not.toBeNull();
      expect(result!.date.getFullYear()).toBe(2025);
      expect(result!.date.getMonth()).toBe(11); // December = 11
      expect(result!.date.getDate()).toBe(11);
      expect(result!.description).toBe('STARBUCKS COFFEE MUMBAI');
      expect(result!.amount).toBe(420);
      expect(result!.type).toBe('DEBIT');
      expect(result!.balance).toBe(18420.50);
      expect(result!.confidence).toBeGreaterThan(0.7);
    });

    it('should infer Food & Dining category for Starbucks', () => {
      const result = parseTransaction(sample1);
      expect(result!.category).toBe('Food & Dining');
    });
  });

  // ────────────────────────────────────
  // Sample 2: Arrow Format
  // ────────────────────────────────────
  describe('Sample 2 — Arrow Format', () => {
    const sample2 = `Uber Ride * Airport Drop
12/11/2025 → ₹1,250.00 debited
Available Balance → ₹17,170.50`;

    it('should parse arrow format correctly', () => {
      const result = parseTransaction(sample2);

      expect(result).not.toBeNull();
      expect(result!.date.getFullYear()).toBe(2025);
      expect(result!.date.getMonth()).toBe(10); // November = 10
      expect(result!.date.getDate()).toBe(12);
      expect(result!.description).toContain('Uber');
      expect(result!.amount).toBe(1250);
      expect(result!.type).toBe('DEBIT');
      expect(result!.balance).toBe(17170.50);
      expect(result!.confidence).toBeGreaterThan(0.7);
    });

    it('should infer Transportation category for Uber', () => {
      const result = parseTransaction(sample2);
      expect(result!.category).toBe('Transportation');
    });
  });

  // ────────────────────────────────────
  // Sample 3: Messy Inline Format
  // ────────────────────────────────────
  describe('Sample 3 — Messy Inline Format', () => {
    const sample3 = `txn123 2025-12-10 Amazon.in Order #403-1234567-8901234 ₹2,999.00 Dr Bal 14171.50 Shopping`;

    it('should parse inline/messy format correctly', () => {
      const result = parseTransaction(sample3);

      expect(result).not.toBeNull();
      expect(result!.date.getFullYear()).toBe(2025);
      expect(result!.date.getMonth()).toBe(11); // December = 11
      expect(result!.date.getDate()).toBe(10);
      expect(result!.description).toContain('Amazon');
      expect(result!.amount).toBe(2999);
      expect(result!.type).toBe('DEBIT');
      expect(result!.balance).toBe(14171.50);
      expect(result!.reference).toBe('txn123');
      expect(result!.confidence).toBeGreaterThan(0.8);
    });
  });

  // ────────────────────────────────────
  // Edge Cases
  // ────────────────────────────────────
  describe('Edge Cases', () => {
    it('should return null for empty input', () => {
      expect(parseTransaction('')).toBeNull();
    });

    it('should return null for nonsensical input', () => {
      expect(parseTransaction('hello world this is not a transaction')).toBeNull();
    });

    it('should handle credit transactions', () => {
      const creditText = `Date: 15 Jan 2025
Description: SALARY CREDIT
Amount: 50000.00
Balance after transaction: 68,420.50`;

      const result = parseTransaction(creditText);
      expect(result).not.toBeNull();
      expect(result!.type).toBe('CREDIT');
      expect(result!.amount).toBe(50000);
    });
  });
});
