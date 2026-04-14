import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { refundSchema } from '@nexusorder/shared-validation';
import { refundsService } from './refundsService.js';

export const refundsRouter = Router();

refundsRouter.use(authMiddleware);

refundsRouter.post(
  '/',
  requirePermission('refunds:create'),
  validate(refundSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const refund = await refundsService.createRefund(req.body as Parameters<typeof refundsService.createRefund>[0], req.session!.userId);
      res.status(201).json({ data: refund });
    } catch (err) { next(err); }
  },
);

refundsRouter.get(
  '/order/:orderId',
  requirePermission('refunds:read'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const refunds = await refundsService.getByOrder(req.params['orderId']!);
      res.json({ data: refunds });
    } catch (err) { next(err); }
  },
);
