import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { createModuleLogger } from '@nexusorder/shared-logging';
import type { ApiError } from '@nexusorder/shared-types';

const log = createModuleLogger('errorHandler');

export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 500,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super('NOT_FOUND', `${resource} not found`, 404);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super('UNAUTHORIZED', message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Insufficient permissions') {
    super('FORBIDDEN', message, 403);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('VALIDATION_ERROR', message, 400, details);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super('CONFLICT', message, 409);
  }
}

export class BusinessRuleError extends AppError {
  constructor(code: string, message: string) {
    super(code, message, 422);
  }
}

// Global Express error handler — must be registered last
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    const body: { error: ApiError } = {
      error: { code: err.code, message: err.message, details: err.details },
    };
    res.status(err.statusCode).json(body);
    return;
  }

  if (err instanceof ZodError) {
    const body: { error: ApiError } = {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: { issues: err.errors },
      },
    };
    res.status(400).json(body);
    return;
  }

  log.error({ err }, 'Unhandled error');
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } });
}
