import { randomUUID } from 'crypto';
import { getDb } from '../../persistence/mongoClient.js';
import type { ShippingRecord, UserScope } from '@nexusorder/shared-types';
import { orderRepository } from '../orders/orderRepository.js';
import { guardTransition } from '../orders/orderStateMachine.js';
import { emitAuditEvent } from '../../audit/auditLog.js';
import { notificationService } from '../notifications/notificationService.js';
import { ForbiddenError, NotFoundError } from '../../middleware/errorHandler.js';
import { config } from '../../config/index.js';

function isWithinScope(orderScope: Record<string, string | undefined>, actorScope: UserScope): boolean {
  if (actorScope.school && orderScope['school'] !== actorScope.school) return false;
  if (actorScope.major && orderScope['major'] !== actorScope.major) return false;
  if (actorScope.class && orderScope['class'] !== actorScope.class) return false;
  if (actorScope.cohort && orderScope['cohort'] !== actorScope.cohort) return false;
  return true;
}

export const fulfillmentService = {
  async allocate(orderId: string, userId: string): Promise<void> {
    const order = await orderRepository.findById(orderId);
    guardTransition(order.state, 'allocated');
    await orderRepository.updateState(order._id, order.version, { state: 'allocated', allocatedAt: new Date() });
    await emitAuditEvent({ action: 'order.allocated', userId, targetType: 'order', targetId: orderId });
  },

  async ship(orderId: string, userId: string, params: {
    trackingNumber?: string;
    carrier?: string;
    estimatedDelivery?: string;
  }): Promise<ShippingRecord> {
    const order = await orderRepository.findById(orderId);
    guardTransition(order.state, 'shipped');

    const now = new Date();

    await orderRepository.updateState(order._id, order.version, {
      state: 'shipped',
      shippedAt: now,
    });

    const record: ShippingRecord & { _id: string } = {
      _id: randomUUID(),
      orderId,
      trackingNumber: params.trackingNumber,
      carrier: params.carrier,
      estimatedDelivery: params.estimatedDelivery ? new Date(params.estimatedDelivery) : undefined,
      shippedAt: now,
    };

    await getDb().collection<ShippingRecord>('shipping_records').insertOne(record);
    await emitAuditEvent({ action: 'order.shipped', userId, targetType: 'order', targetId: orderId });

    await notificationService.create({
      userId: order.userId,
      milestone: 'order_shipped',
      title: 'Order Shipped',
      body: params.trackingNumber
        ? `Your order has shipped. Tracking: ${params.trackingNumber}`
        : 'Your order has been shipped.',
      relatedEntityType: 'order',
      relatedEntityId: orderId,
    }).catch(() => null);

    return record;
  },

  async confirmDelivery(orderId: string, mentorId: string, mentorScope: UserScope, conditionNote?: string): Promise<void> {
    const order = await orderRepository.findById(orderId);
    guardTransition(order.state, 'delivered');

    // Object-level authorization: mentor may only confirm delivery for orders within their assigned scope.
    if (!isWithinScope(order.userScopeSnapshot as Record<string, string | undefined>, mentorScope)) {
      throw new ForbiddenError('This order is outside your assigned scope');
    }

    const now = new Date();
    const autoCloseAt = new Date(now.getTime() + config.order.autoCloseDays * 24 * 60 * 60 * 1000);
    await orderRepository.updateState(order._id, order.version, { state: 'delivered', deliveredAt: now, autoCloseAt });

    await getDb().collection<ShippingRecord>('shipping_records').updateOne(
      { orderId },
      { $set: { deliveredAt: now, mentorConfirmedBy: mentorId, mentorConfirmedAt: now, conditionNote } },
    );

    await emitAuditEvent({ action: 'order.delivered', userId: mentorId, targetType: 'order', targetId: orderId });

    await notificationService.create({
      userId: order.userId,
      milestone: 'order_delivered',
      title: 'Order Delivered',
      body: 'Your order has been delivered and confirmed by your mentor.',
      relatedEntityType: 'order',
      relatedEntityId: orderId,
    }).catch(() => null);
  },
};
