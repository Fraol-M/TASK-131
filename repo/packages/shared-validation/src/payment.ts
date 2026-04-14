import { z } from 'zod';

export const reconciliationExceptionRepairSchema = z.object({
  paymentIntentId: z.string(),
  note: z.string().min(1, 'Admin note is required for exception repair').max(1000),
});

export const refundSchema = z.object({
  orderId: z.string(),
  paymentIntentId: z.string(),
  amount: z.number().positive(),
  currency: z.string().length(3),
  reason: z.string().min(1).max(1000),
  reasonCode: z.string().min(1),
});
