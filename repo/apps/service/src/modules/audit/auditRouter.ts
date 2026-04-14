import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { getDb } from '../../persistence/mongoClient.js';
import type { AuditEvent } from '@nexusorder/shared-types';

export const auditRouter = Router();

auditRouter.use(authMiddleware);

// GET /api/audits?targetId=...&action=...&page=1&pageSize=50
auditRouter.get(
  '/',
  requirePermission('audit:view_audit'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const filter: Record<string, unknown> = {};
      if (req.query['targetId']) filter['targetId'] = req.query['targetId'];
      if (req.query['action']) filter['action'] = req.query['action'];
      if (req.query['userId']) filter['userId'] = req.query['userId'];

      // Scope isolation: non-admin roles see only audit events that match ALL of
      // their scope fields (AND semantics), mirroring orderRepository.findByScope().
      // Using $or would be too permissive — a school-A/major-CS advisor must not
      // see events tagged school-A/major-EE just because school matches.
      const role = req.session!.role;
      const scope = req.session!.scope;
      if (role !== 'department_admin' && scope) {
        if (scope.school) filter['meta.scope.school'] = scope.school;
        if (scope.major) filter['meta.scope.major'] = scope.major;
        if (scope.class) filter['meta.scope.class'] = scope.class;
        if (scope.cohort) filter['meta.scope.cohort'] = scope.cohort;
      }

      const page = Math.max(1, parseInt(req.query['page'] as string ?? '1', 10));
      const pageSize = Math.min(100, parseInt(req.query['pageSize'] as string ?? '50', 10));

      const [events, total] = await Promise.all([
        getDb().collection<AuditEvent>('order_audit_events')
          .find(filter)
          .sort({ occurredAt: -1 })
          .skip((page - 1) * pageSize)
          .limit(pageSize)
          .toArray(),
        getDb().collection<AuditEvent>('order_audit_events').countDocuments(filter),
      ]);

      res.json({ data: events, meta: { page, pageSize, total } });
    } catch (err) { next(err); }
  },
);
