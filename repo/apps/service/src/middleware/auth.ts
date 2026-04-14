import type { Request, Response, NextFunction } from 'express';
import { UnauthorizedError } from './errorHandler.js';
import { sessionService } from '../modules/auth/sessionService.js';

declare module 'express' {
  interface Request {
    session?: {
      sessionId: string;
      userId: string;
      role: import('@nexusorder/shared-types').UserRole;
      scope: import('@nexusorder/shared-types').UserScope;
    };
  }
}

export async function authMiddleware(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const token = req.cookies?.['nexusorder_session'] as string | undefined;
  if (!token) {
    next(new UnauthorizedError());
    return;
  }

  const session = await sessionService.validateSession(token);
  if (!session) {
    next(new UnauthorizedError('Session expired or invalid'));
    return;
  }

  req.session = {
    sessionId: session._id,
    userId: session.userId,
    role: session.role,
    scope: session.scope,
  };

  next();
}

/**
 * Like authMiddleware but does not reject on missing/invalid session.
 * Attaches req.session if a valid cookie is present; otherwise proceeds
 * with req.session undefined. Used on routes that also accept internal-key
 * auth so they can still perform role checks when a browser session is present.
 */
export async function softAuthMiddleware(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const token = req.cookies?.['nexusorder_session'] as string | undefined;
  if (!token) { next(); return; }

  try {
    const session = await sessionService.validateSession(token);
    if (session) {
      req.session = {
        sessionId: session._id,
        userId: session.userId,
        role: session.role,
        scope: session.scope,
      };
    }
  } catch { /* ignore invalid/expired tokens */ }

  next();
}
