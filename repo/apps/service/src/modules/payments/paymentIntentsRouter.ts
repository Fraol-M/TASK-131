import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { paymentIntentService } from './paymentIntentService.js';
import { getDb } from '../../persistence/mongoClient.js';
import type { PaymentIntent } from '@nexusorder/shared-types';

export const paymentIntentsRouter = Router();

paymentIntentsRouter.use(authMiddleware);

// POST /api/payments/intents — create intent for an order
paymentIntentsRouter.post(
  '/',
  requirePermission('payment_intents:read'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { orderId } = req.body as { orderId: string };
      const intent = await paymentIntentService.createIntent(orderId);
      res.status(201).json({ data: intent });
    } catch (err) { next(err); }
  },
);

// GET /api/payments/intents/:id
paymentIntentsRouter.get(
  '/:id',
  requirePermission('payment_intents:read'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const intent = await getDb().collection<PaymentIntent>('payment_intents').findOne({ _id: req.params['id'] } as { _id: string });
      if (!intent) { res.status(404).json({ error: { code: 'NOT_FOUND', message: 'PaymentIntent not found' } }); return; }
      res.json({ data: intent });
    } catch (err) { next(err); }
  },
);

// POST /api/payments/intents/:id/confirm — marks payment as paid and advances order to 'paid' state
// Admin-only: this is the manual payment confirmation path (reconciliation auto-calls markPaid separately)
paymentIntentsRouter.post(
  '/:id/confirm',
  requirePermission('payment_intents:confirm'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { paymentReference } = req.body as { paymentReference: string };
      if (!paymentReference) {
        res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'paymentReference is required' } });
        return;
      }
      await paymentIntentService.markPaid(req.params['id']!, paymentReference);
      res.json({ data: { message: 'Payment confirmed — order advanced to paid' } });
    } catch (err) { next(err); }
  },
);
