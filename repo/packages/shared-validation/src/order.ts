import { z } from 'zod';

export const orderStateSchema = z.enum([
  'draft', 'submitted', 'approved', 'paid', 'allocated',
  'shipped', 'delivered', 'closed', 'cancelled',
]);

export const afterSalesStateSchema = z.enum([
  'none', 'rma_requested', 'rma_approved', 'return_in_transit',
  'returned', 'refund_pending', 'refunded', 'exchange_pending',
  'exchanged', 'after_sales_closed',
]);

export const orderNoteSchema = z.object({
  content: z.string().min(1).max(2000),
});

export const orderTagSchema = z.object({
  tag: z.string().min(1).max(50).trim(),
});

export const splitOrderSchema = z.object({
  itemIds: z.array(z.string()).min(1),
  note: z.string().max(500).optional(),
});

export const mergeOrdersSchema = z.object({
  orderIds: z.array(z.string()).min(2).max(10),
  note: z.string().max(500).optional(),
});

export const rmaSchema = z.object({
  reasonCode: z.string().min(1),
  reason: z.string().min(1).max(1000),
});

export const approvalSchema = z.object({
  decision: z.enum(['approved', 'denied']),
  reason: z.string().max(500).optional(),
});

export const mentorConfirmSchema = z.object({
  conditionNote: z.string().max(1000).optional(),
});

export const shippingSchema = z.object({
  trackingNumber: z.string().max(100).optional(),
  carrier: z.string().max(100).optional(),
  estimatedDelivery: z.string().datetime().optional(),
});
