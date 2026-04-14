import type { Request, Response, NextFunction } from 'express';
import { canDo } from '@nexusorder/shared-rbac';
import type { Permission } from '@nexusorder/shared-rbac';
import { ForbiddenError, UnauthorizedError } from './errorHandler.js';

/**
 * RBAC middleware factory — enforces that the authenticated user's role
 * has the specified permission before the route handler runs.
 *
 * Usage: router.get('/route', authMiddleware, requirePermission('orders:read'), handler)
 */
export function requirePermission(permission: Permission) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.session) {
      next(new UnauthorizedError());
      return;
    }

    if (!canDo(req.session.role, permission)) {
      next(new ForbiddenError(`Role '${req.session.role}' lacks permission '${permission}'`));
      return;
    }

    next();
  };
}
