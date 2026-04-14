import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { shippingSchema, mentorConfirmSchema } from '@nexusorder/shared-validation';
import { fulfillmentService } from './fulfillmentService.js';

export const fulfillmentRouter = Router();

fulfillmentRouter.use(authMiddleware);

// POST /api/fulfillment/:orderId/allocate
fulfillmentRouter.post(
  '/:orderId/allocate',
  requirePermission('orders:admin'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await fulfillmentService.allocate(req.params['orderId']!, req.session!.userId);
      res.json({ data: { message: 'Order allocated' } });
    } catch (err) { next(err); }
  },
);

// POST /api/fulfillment/:orderId/ship
fulfillmentRouter.post(
  '/:orderId/ship',
  requirePermission('orders:admin'),
  validate(shippingSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const record = await fulfillmentService.ship(req.params['orderId']!, req.session!.userId, req.body as Parameters<typeof fulfillmentService.ship>[2]);
      res.json({ data: record });
    } catch (err) { next(err); }
  },
);

// POST /api/fulfillment/:orderId/confirm-delivery
fulfillmentRouter.post(
  '/:orderId/confirm-delivery',
  requirePermission('fulfillment:confirm_receipt'),
  validate(mentorConfirmSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { conditionNote } = req.body as { conditionNote?: string };
      await fulfillmentService.confirmDelivery(req.params['orderId']!, req.session!.userId, req.session!.scope, conditionNote);
      res.json({ data: { message: 'Delivery confirmed' } });
    } catch (err) { next(err); }
  },
);
