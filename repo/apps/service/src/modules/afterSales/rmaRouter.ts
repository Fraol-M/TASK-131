import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { rmaSchema, splitOrderSchema, mergeOrdersSchema } from '@nexusorder/shared-validation';
import { afterSalesService } from './afterSalesService.js';
import { orderSplitService } from '../orderMutations/orderSplitService.js';
import { orderMergeService } from '../orderMutations/orderMergeService.js';

export const rmaRouter = Router();

rmaRouter.use(authMiddleware);

// POST /api/rma/:orderId  — create RMA from eligible order
rmaRouter.post(
  '/orders/:orderId',
  requirePermission('rma:create'),
  validate(rmaSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { reasonCode, reason } = req.body as { reasonCode: string; reason: string };
      const rma = await afterSalesService.requestRMA({
        orderId: req.params['orderId']!,
        userId: req.session!.userId,
        userRole: req.session!.role,
        reasonCode,
        reason,
      });
      res.status(201).json({ data: rma });
    } catch (err) { next(err); }
  },
);

// POST /api/rma/:rmaId/approve — admin only
rmaRouter.post(
  '/:rmaId/approve',
  requirePermission('rma:approve'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const rma = await afterSalesService.approveRMA(req.params['rmaId']!, req.session!.userId);
      res.json({ data: rma });
    } catch (err) { next(err); }
  },
);

// POST /api/rma/orders/:orderId/split
rmaRouter.post(
  '/orders/:orderId/split',
  requirePermission('orders:split'),
  validate(splitOrderSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { itemIds, note } = req.body as { itemIds: string[]; note?: string };
      const result = await orderSplitService.split({
        orderId: req.params['orderId']!,
        itemIds,
        userId: req.session!.userId,
        note,
      });
      res.json({ data: result });
    } catch (err) { next(err); }
  },
);

// POST /api/rma/orders/merge
rmaRouter.post(
  '/orders/merge',
  requirePermission('orders:merge'),
  validate(mergeOrdersSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { orderIds, note } = req.body as { orderIds: string[]; note?: string };
      const merged = await orderMergeService.merge({
        orderIds,
        userId: req.session!.userId,
        note,
      });
      res.json({ data: merged });
    } catch (err) { next(err); }
  },
);
