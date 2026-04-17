/**
 * Unit tests for RBAC and validate middleware.
 */
import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { requirePermission } from '../../../src/middleware/rbac.js';
import { validate } from '../../../src/middleware/validate.js';
import type { Request, Response, NextFunction } from 'express';

function mockReq(overrides: Partial<Request> = {}): Request {
  return { session: undefined, body: {}, query: {}, params: {}, ...overrides } as unknown as Request;
}
function mockRes(): Response {
  return { status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as Response;
}

describe('requirePermission middleware', () => {
  it('calls next() when role has the permission', () => {
    const mw = requirePermission('orders:read');
    const next = vi.fn();
    const req = mockReq({ session: { userId: 'u1', role: 'student', scope: {}, sessionId: 's1' } } as Partial<Request>);
    mw(req, mockRes(), next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith(); // no error argument
  });

  it('passes ForbiddenError when role lacks the permission', () => {
    const mw = requirePermission('rules:create');
    const next = vi.fn();
    const req = mockReq({ session: { userId: 'u1', role: 'student', scope: {}, sessionId: 's1' } } as Partial<Request>);
    mw(req, mockRes(), next);
    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err).toBeDefined();
    expect(err.statusCode).toBe(403);
  });

  it('passes UnauthorizedError when session is missing', () => {
    const mw = requirePermission('orders:read');
    const next = vi.fn();
    const req = mockReq({ session: undefined });
    mw(req, mockRes(), next);
    const err = next.mock.calls[0][0];
    expect(err.statusCode).toBe(401);
  });
});

describe('validate middleware', () => {
  const schema = z.object({ name: z.string().min(1), age: z.number().int().positive() });

  it('calls next() with no error on valid body', () => {
    const mw = validate(schema);
    const next = vi.fn();
    const req = mockReq({ body: { name: 'Alice', age: 30 } });
    mw(req, mockRes(), next);
    expect(next).toHaveBeenCalledWith();
    // Body should be replaced with parsed value
    expect(req.body).toEqual({ name: 'Alice', age: 30 });
  });

  it('passes ValidationError on invalid body', () => {
    const mw = validate(schema);
    const next = vi.fn();
    const req = mockReq({ body: { name: '', age: -1 } });
    mw(req, mockRes(), next);
    const err = next.mock.calls[0][0];
    expect(err).toBeDefined();
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe('VALIDATION_ERROR');
  });

  it('validates query section when specified', () => {
    const querySchema = z.object({ q: z.string().min(1) });
    const mw = validate(querySchema, 'query');
    const next = vi.fn();
    const req = mockReq({ query: { q: 'search term' } });
    mw(req, mockRes(), next);
    expect(next).toHaveBeenCalledWith();
  });

  it('coerces types through Zod (string to default)', () => {
    const withDefault = z.object({ count: z.number().default(10) });
    const mw = validate(withDefault);
    const next = vi.fn();
    const req = mockReq({ body: {} });
    mw(req, mockRes(), next);
    expect(next).toHaveBeenCalledWith();
    expect(req.body.count).toBe(10);
  });
});
