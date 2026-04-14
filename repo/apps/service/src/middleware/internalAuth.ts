import type { Request, Response, NextFunction } from 'express';
import { config } from '../config/index.js';

/**
 * Middleware for routes called from the Electron main process.
 * The main process cannot carry a browser session cookie, so it uses a
 * pre-shared internal API key sent in the X-Internal-Key header.
 * This key must be kept secret and must never be exposed to renderer/web contexts.
 */
export function internalAuthMiddleware(req: Request, res: Response, next: NextFunction): void {
  const key = req.headers['x-internal-key'];
  if (typeof key === 'string' && key === config.internal.apiKey) {
    next();
    return;
  }
  res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Internal API key required' } });
}
