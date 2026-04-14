import type { Request, Response, NextFunction } from 'express';
import type { AuditAction } from '@nexusorder/shared-types';
import { emitAuditEvent } from '../audit/auditLog.js';

// Attach an audit emission helper to the response locals so route handlers
// can call res.locals.audit(action, meta) without importing auditLog directly.
// NOTE: actor (userId) is resolved at emit time, not at middleware attachment time,
// so that per-router auth middleware has already populated req.session before we read it.
export function auditEmitterMiddleware(req: Request, res: Response, next: NextFunction): void {
  res.locals['emitAudit'] = async (
    action: AuditAction,
    params?: {
      targetType?: string;
      targetId?: string;
      meta?: Record<string, unknown>;
    },
  ) => {
    const sessionUserId = (req.session as { userId?: string } | undefined)?.userId;
    await emitAuditEvent({
      action,
      userId: sessionUserId,
      correlationId: req.headers['x-correlation-id'] as string | undefined,
      ...params,
    });
  };

  next();
}
