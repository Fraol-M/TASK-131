import { randomUUID } from 'crypto';
import { getDb } from '../../persistence/mongoClient.js';
import type { RMA, AfterSalesEvent } from '@nexusorder/shared-types';
import { orderRepository } from '../orders/orderRepository.js';
import { assertRmaEligible, guardAfterSalesTransition } from '../orders/orderStateMachine.js';
import { emitAuditEvent } from '../../audit/auditLog.js';
import { notificationService } from '../notifications/notificationService.js';
import { ForbiddenError, NotFoundError } from '../../middleware/errorHandler.js';
import { reasonCodeService } from './reasonCodeService.js';

export const afterSalesService = {
  async requestRMA(params: {
    orderId: string;
    userId: string;
    userRole: string;
    reasonCode: string;
    reason: string;
  }): Promise<RMA> {
    const order = await orderRepository.findById(params.orderId);

    // Students may only request RMA for their own orders
    if (params.userRole === 'student' && order.userId !== params.userId) {
      throw new ForbiddenError('You can only request RMA for your own orders');
    }

    await reasonCodeService.assertValidReasonCode(params.reasonCode);
    assertRmaEligible(order.state);
    guardAfterSalesTransition(order.afterSalesState, 'rma_requested');

    const now = new Date();
    const rma: RMA & { _id: string } = {
      _id: randomUUID(),
      orderId: params.orderId,
      requestedBy: params.userId,
      afterSalesState: 'rma_requested',
      reasonCode: params.reasonCode,
      reason: params.reason,
      requestedAt: now,
    };

    await getDb().collection<RMA>('rmas').insertOne(rma);
    await orderRepository.updateState(order._id, order.version, { afterSalesState: 'rma_requested' });

    // Block auto-close by unsetting autoCloseAt
    await getDb().collection('orders').updateOne(
      { _id: params.orderId },
      { $unset: { autoCloseAt: '' } },
    );

    const event: AfterSalesEvent & { _id: string } = {
      _id: randomUUID(),
      orderId: params.orderId,
      rmaId: rma._id,
      eventType: 'rma_requested',
      performedBy: params.userId,
      occurredAt: now,
    };
    await getDb().collection<AfterSalesEvent>('after_sales_events').insertOne(event);

    await emitAuditEvent({ action: 'rma.requested', userId: params.userId, targetType: 'order', targetId: params.orderId });

    return rma;
  },

  async approveRMA(rmaId: string, approverId: string): Promise<RMA> {
    const rma = await getDb().collection<RMA>('rmas').findOne({ _id: rmaId } as { _id: string });
    if (!rma) throw new NotFoundError('RMA');

    const order = await orderRepository.findById(rma.orderId);
    guardAfterSalesTransition(order.afterSalesState, 'rma_approved');

    const now = new Date();
    await getDb().collection<RMA>('rmas').updateOne(
      { _id: rmaId } as { _id: string },
      { $set: { afterSalesState: 'rma_approved', approvedBy: approverId, approvedAt: now } },
    );

    await orderRepository.updateState(order._id, order.version, { afterSalesState: 'rma_approved' });

    await emitAuditEvent({ action: 'rma.approved', userId: approverId, targetType: 'order', targetId: rma.orderId });

    await notificationService.create({
      userId: order.userId,
      milestone: 'rma_approved',
      title: 'RMA Approved',
      body: 'Your return/exchange request has been approved. Please follow the instructions to return your item.',
      relatedEntityType: 'rma',
      relatedEntityId: rmaId,
    }).catch(() => null);

    return { ...rma, afterSalesState: 'rma_approved', approvedBy: approverId, approvedAt: now };
  },
};
