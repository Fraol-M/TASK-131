import { randomUUID } from 'crypto';
import { getDb } from '../../persistence/mongoClient.js';
import type { PaymentIntent } from '@nexusorder/shared-types';
import { orderRepository } from '../orders/orderRepository.js';
import { guardTransition } from '../orders/orderStateMachine.js';
import { encryptField } from '../../crypto/aes256.js';
import { maskField } from '../../crypto/maskField.js';
import { emitAuditEvent } from '../../audit/auditLog.js';
import { notificationService } from '../notifications/notificationService.js';
import { ConflictError, NotFoundError } from '../../middleware/errorHandler.js';

export const paymentIntentService = {
  async createIntent(orderId: string): Promise<PaymentIntent> {
    const order = await orderRepository.findById(orderId);
    guardTransition(order.state, 'paid'); // must be in 'approved' state

    // Enforce one-intent-per-order
    const existing = await getDb().collection<PaymentIntent>('payment_intents').findOne({ orderId });
    if (existing) throw new ConflictError('Payment intent already exists for this order');

    const intent: PaymentIntent & { _id: string } = {
      _id: randomUUID(),
      paymentIntentId: randomUUID(),
      orderId,
      amount: order.total,
      currency: order.currency,
      status: 'pending',
      duplicateFlag: false,
      signatureVerified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await getDb().collection<PaymentIntent>('payment_intents').insertOne(intent);
    return intent;
  },

  async markPaid(intentId: string, paymentReference: string): Promise<void> {
    const intent = await getDb().collection<PaymentIntent>('payment_intents').findOne({ _id: intentId } as { _id: string });
    if (!intent) throw new NotFoundError('PaymentIntent');

    const encrypted = encryptField(paymentReference);
    const masked = maskField(paymentReference);

    await getDb().collection<PaymentIntent>('payment_intents').updateOne(
      { _id: intentId } as { _id: string },
      {
        $set: {
          status: 'paid',
          paymentReferenceEncrypted: encrypted,
          paymentReferenceMasked: masked,
          updatedAt: new Date(),
        },
      },
    );

    // Advance order to 'paid', clear auto-cancel timer
    const order = await orderRepository.findById(intent.orderId);
    guardTransition(order.state, 'paid');
    await orderRepository.updateState(order._id, order.version, {
      state: 'paid',
      paidAt: new Date(),
      autoCancelAt: undefined,
    });

    await emitAuditEvent({
      action: 'order.paid',
      targetType: 'order',
      targetId: intent.orderId,
    });

    await notificationService.create({
      userId: order.userId,
      milestone: 'order_paid',
      title: 'Payment Confirmed',
      body: 'Your payment has been confirmed. Your order is now being prepared for fulfillment.',
      relatedEntityType: 'order',
      relatedEntityId: intent.orderId,
    }).catch(() => null);
  },
};
