import { randomUUID } from 'crypto';
import { getDb } from '../../persistence/mongoClient.js';
import type { Refund, PaymentIntent } from '@nexusorder/shared-types';
import { orderRepository } from '../orders/orderRepository.js';
import { notificationService } from '../notifications/notificationService.js';
import { emitAuditEvent } from '../../audit/auditLog.js';
import { BusinessRuleError, NotFoundError } from '../../middleware/errorHandler.js';

type RefundInput = {
  orderId: string;
  paymentIntentId: string;
  amount: number;
  currency: string;
  reason: string;
  reasonCode: string;
};

export const refundsService = {
  async createRefund(input: RefundInput, initiatedBy: string): Promise<Refund> {
    const intent = await getDb().collection<PaymentIntent>('payment_intents').findOne({ _id: input.paymentIntentId } as { _id: string });
    if (!intent) throw new NotFoundError('PaymentIntent');

    // Validate that the payment intent belongs to the specified order
    if (intent.orderId !== input.orderId) {
      throw new BusinessRuleError('REFUND_ORDER_MISMATCH', 'PaymentIntent does not belong to the specified order');
    }

    // Validate that the payment is in a refundable status
    const refundableStatuses: Array<PaymentIntent['status']> = ['paid', 'paid_unreconciled', 'reconciled', 'partially_refunded'];
    if (!refundableStatuses.includes(intent.status)) {
      throw new BusinessRuleError('PAYMENT_NOT_REFUNDABLE', `Payment status '${intent.status}' is not eligible for refund`);
    }

    // Validate refund does not exceed paid amount
    const existingRefunds = await getDb().collection<Refund>('refunds').find({ paymentIntentId: input.paymentIntentId }).toArray();
    const alreadyRefunded = existingRefunds.reduce((sum, r) => sum + r.amount, 0);
    if (alreadyRefunded + input.amount > intent.amount) {
      throw new BusinessRuleError('REFUND_EXCEEDS_PAID', 'Refund total would exceed the paid amount');
    }

    const refund: Refund & { _id: string } = {
      _id: randomUUID(),
      ...input,
      initiatedBy,
      status: 'pending',
      createdAt: new Date(),
    };

    await getDb().collection<Refund>('refunds').insertOne(refund);
    await emitAuditEvent({ action: 'refund.issued', userId: initiatedBy, targetType: 'order', targetId: input.orderId });

    const order = await orderRepository.findById(input.orderId).catch(() => null);
    if (order) {
      await notificationService.create({
        userId: order.userId,
        milestone: 'refund_issued',
        title: 'Refund Initiated',
        body: `A refund of ${input.currency} ${input.amount.toFixed(2)} has been initiated for your order.`,
        relatedEntityType: 'order',
        relatedEntityId: input.orderId,
      }).catch(() => null);
    }

    return refund;
  },

  async getByOrder(orderId: string): Promise<Refund[]> {
    return getDb().collection<Refund>('refunds').find({ orderId }).toArray();
  },
};
