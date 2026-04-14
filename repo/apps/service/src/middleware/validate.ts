import type { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';
import { ValidationError } from './errorHandler.js';

type RequestSection = 'body' | 'query' | 'params';

export function validate(schema: ZodSchema, section: RequestSection = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[section]);
    if (!result.success) {
      next(new ValidationError('Request validation failed', { issues: result.error.errors }));
      return;
    }
    // Replace the request section with the parsed/coerced value
    (req as Record<string, unknown>)[section] = result.data;
    next();
  };
}
