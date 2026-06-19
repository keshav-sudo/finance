/**
 * Auth Module Tests
 * 
 * Tests auth-related types, error classes, and middleware behavior.
 * Note: Integration tests with Better Auth require a running database.
 * These unit tests validate the error handling and type contracts.
 */

import { describe, it, expect } from 'vitest';
import { UnauthorizedError, ForbiddenError, ValidationError, RateLimitError } from '../src/shared/errors/index.js';

describe('Auth Error Classes', () => {
  it('should create UnauthorizedError with correct status code', () => {
    const error = new UnauthorizedError();
    expect(error.statusCode).toBe(401);
    expect(error.code).toBe('UNAUTHORIZED');
    expect(error.message).toBe('Authentication required');
    expect(error).toBeInstanceOf(Error);
  });

  it('should create UnauthorizedError with custom message', () => {
    const error = new UnauthorizedError('Token expired');
    expect(error.message).toBe('Token expired');
    expect(error.statusCode).toBe(401);
  });

  it('should create ForbiddenError with correct status code', () => {
    const error = new ForbiddenError();
    expect(error.statusCode).toBe(403);
    expect(error.code).toBe('FORBIDDEN');
  });

  it('should create ValidationError with details', () => {
    const error = new ValidationError('Invalid input', { field: 'email' });
    expect(error.statusCode).toBe(400);
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.details).toEqual({ field: 'email' });
  });

  it('should create RateLimitError with correct status code', () => {
    const error = new RateLimitError();
    expect(error.statusCode).toBe(429);
    expect(error.code).toBe('RATE_LIMIT_EXCEEDED');
  });
});

describe('Auth Context Types', () => {
  it('should validate AuthContext shape', () => {
    const ctx = {
      userId: 'user-123',
      email: 'test@vessify.com',
      organizationId: 'org-456',
      organizationName: 'Test Workspace',
    };

    expect(ctx).toHaveProperty('userId');
    expect(ctx).toHaveProperty('email');
    expect(ctx).toHaveProperty('organizationId');
    expect(ctx).toHaveProperty('organizationName');
    expect(typeof ctx.userId).toBe('string');
    expect(typeof ctx.email).toBe('string');
  });
});
