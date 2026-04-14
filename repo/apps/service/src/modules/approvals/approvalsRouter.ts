import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { approvalSchema } from '@nexusorder/shared-validation';
import { approvalService } from './approvalService.js';
import { orderRepository } from '../orders/orderRepository.js';

export const approvalsRouter = Router();

approvalsRouter.use(authMiddleware);

// GET /api/approvals/pending — returns submitted orders scoped to advisor
approvalsRouter.get(
  '/pending',
  requirePermission('approvals:approve'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const orders = await orderRepository.findByScope(req.session!.scope);
      const pending = orders.filter((o) => o.state === 'submitted');
      const enriched = await Promise.all(pending.map(async (order) => {
        const items = await orderRepository.getItems(order._id);
        return { ...order, itemCount: items.length };
      }));
      res.json({ data: enriched });
    } catch (err) { next(err); }
  },
);

// POST /api/approvals/:orderId/approve
approvalsRouter.post(
  '/:orderId/approve',
  requirePermission('approvals:approve'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const approval = await approvalService.decide({
        orderId: req.params['orderId']!,
        advisorId: req.session!.userId,
        advisorScope: req.session!.scope,
        decision: 'approved',
      });
      res.json({ data: approval });
    } catch (err) { next(err); }
  },
);

// POST /api/approvals/:orderId/reject
approvalsRouter.post(
  '/:orderId/reject',
  requirePermission('approvals:approve'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { reason } = req.body as { reason?: string };
      const approval = await approvalService.decide({
        orderId: req.params['orderId']!,
        advisorId: req.session!.userId,
        advisorScope: req.session!.scope,
        decision: 'denied',
        reason,
      });
      res.json({ data: approval });
    } catch (err) { next(err); }
  },
);

// POST /api/approvals/:orderId/decide (generic — kept for backward compatibility)
approvalsRouter.post(
  '/:orderId/decide',
  requirePermission('approvals:approve'),
  validate(approvalSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { decision, reason } = req.body as { decision: 'approved' | 'denied'; reason?: string };
      const approval = await approvalService.decide({
        orderId: req.params['orderId']!,
        advisorId: req.session!.userId,
        advisorScope: req.session!.scope,
        decision,
        reason,
      });
      res.json({ data: approval });
    } catch (err) { next(err); }
  },
);
