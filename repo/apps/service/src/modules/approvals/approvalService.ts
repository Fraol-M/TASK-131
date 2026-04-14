import { randomUUID } from 'crypto';
import { getDb } from '../../persistence/mongoClient.js';
import type { OrderApproval, Order } from '@nexusorder/shared-types';
import { orderRepository } from '../orders/orderRepository.js';
import { guardTransition } from '../orders/orderStateMachine.js';
import { emitAuditEvent } from '../../audit/auditLog.js';
import { notificationService } from '../notifications/notificationService.js';
import { ForbiddenError, BusinessRuleError } from '../../middleware/errorHandler.js';
import type { UserScope } from '@nexusorder/shared-types';

function isWithinScope(orderScope: Record<string, string | undefined>, advisorScope: UserScope): boolean {
  // Advisor can only act on orders within their assigned scope
  if (advisorScope.school && orderScope['school'] !== advisorScope.school) return false;
  if (advisorScope.major && orderScope['major'] !== advisorScope.major) return false;
  if (advisorScope.class && orderScope['class'] !== advisorScope.class) return false;
  if (advisorScope.cohort && orderScope['cohort'] !== advisorScope.cohort) return false;
  return true;
}

export const approvalService = {
  async decide(params: {
    orderId: string;
    advisorId: string;
    advisorScope: UserScope;
    decision: 'approved' | 'denied';
    reason?: string;
  }): Promise<OrderApproval> {
    const order = await orderRepository.findById(params.orderId);

    // Scope check — advisor cannot act outside their scope
    if (!isWithinScope(order.userScopeSnapshot as Record<string, string | undefined>, params.advisorScope)) {
      throw new ForbiddenError('This order is outside your assigned scope');
    }

    // State machine check
    if (params.decision === 'approved') {
      guardTransition(order.state, 'approved');
    } else {
      guardTransition(order.state, 'cancelled');
    }

    const now = new Date();
    const newState: Order['state'] = params.decision === 'approved' ? 'approved' : 'cancelled';
    const stateTimestamp = params.decision === 'approved' ? { approvedAt: now } : { cancelledAt: now, deniedAt: now };

    await orderRepository.updateState(order._id, order.version, {
      state: newState,
      ...stateTimestamp,
    });

    const approval: OrderApproval & { _id: string } = {
      _id: randomUUID(),
      orderId: params.orderId,
      advisorId: params.advisorId,
      decision: params.decision,
      reason: params.reason,
      decidedAt: now,
    };

    await getDb().collection<OrderApproval>('order_approvals').insertOne(approval);

    await emitAuditEvent({
      action: params.decision === 'approved' ? 'order.approved' : 'order.denied',
      userId: params.advisorId,
      targetType: 'order',
      targetId: params.orderId,
      meta: { decision: params.decision, reason: params.reason },
    });

    // Notify the order owner
    const milestone = params.decision === 'approved' ? 'order_approved' : 'order_denied';
    const title = params.decision === 'approved' ? 'Order Approved' : 'Order Denied';
    const body = params.decision === 'approved'
      ? `Your order has been approved and is ready for payment.`
      : `Your order was denied. Reason: ${params.reason ?? 'No reason provided'}`;
    await notificationService.create({
      userId: order.userId,
      milestone,
      title,
      body,
      relatedEntityType: 'order',
      relatedEntityId: params.orderId,
    }).catch(() => null);

    return approval;
  },
};
