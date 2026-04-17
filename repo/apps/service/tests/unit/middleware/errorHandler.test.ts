/**
 * Unit tests for error handler middleware and error class hierarchy.
 */
import { describe, it, expect, vi } from 'vitest';
import { ZodError } from 'zod';
import {
  AppError, NotFoundError, UnauthorizedError, ForbiddenError,
  ValidationError, ConflictError, BusinessRuleError, errorHandler,
} from '../../../src/middleware/errorHandler.js';

function mockRes() {
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
  return res as unknown as import('express').Response;
}

describe('Error class hierarchy', () => {
  it('NotFoundError has code NOT_FOUND and status 404', () => {
    const err = new NotFoundError('User');
    expect(err.code).toBe('NOT_FOUND');
    expect(err.statusCode).toBe(404);
    expect(err.message).toContain('User');
  });

  it('UnauthorizedError has status 401', () => {
    const err = new UnauthorizedError();
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe('UNAUTHORIZED');
  });

  it('ForbiddenError has status 403', () => {
    const err = new ForbiddenError('No access');
    expect(err.statusCode).toBe(403);
  });

  it('ValidationError has status 400 and supports details', () => {
    const err = new ValidationError('bad input', { field: 'email' });
    expect(err.statusCode).toBe(400);
    expect(err.details).toEqual({ field: 'email' });
  });

  it('ConflictError has status 409', () => {
    const err = new ConflictError('duplicate');
    expect(err.statusCode).toBe(409);
  });

  it('BusinessRuleError has status 422 with custom code', () => {
    const err = new BusinessRuleError('ITEM_OUT_OF_SCOPE', 'not in scope');
    expect(err.statusCode).toBe(422);
    expect(err.code).toBe('ITEM_OUT_OF_SCOPE');
  });

  it('all error classes extend AppError', () => {
    expect(new NotFoundError('x')).toBeInstanceOf(AppError);
    expect(new UnauthorizedError()).toBeInstanceOf(AppError);
    expect(new ForbiddenError()).toBeInstanceOf(AppError);
    expect(new ValidationError('x')).toBeInstanceOf(AppError);
    expect(new ConflictError('x')).toBeInstanceOf(AppError);
    expect(new BusinessRuleError('X', 'x')).toBeInstanceOf(AppError);
  });
});

describe('errorHandler middleware', () => {
  const req = {} as import('express').Request;
  const next = vi.fn();

  it('handles AppError with correct status and body', () => {
    const res = mockRes();
    errorHandler(new NotFoundError('Order'), req, res, next);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      error: { code: 'NOT_FOUND', message: expect.stringContaining('Order'), details: undefined },
    });
  });

  it('handles ZodError as 400 validation error', () => {
    const res = mockRes();
    const zodErr = new ZodError([{ code: 'invalid_type', expected: 'string', received: 'number', path: ['name'], message: 'bad' }]);
    errorHandler(zodErr, req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: { code: 'VALIDATION_ERROR', message: 'Request validation failed', details: { issues: zodErr.errors } },
    });
  });

  it('handles unknown error as 500 internal error', () => {
    const res = mockRes();
    errorHandler(new Error('unexpected'), req, res, next);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
    });
  });

  it('handles non-Error thrown values', () => {
    const res = mockRes();
    errorHandler('string error', req, res, next);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});
