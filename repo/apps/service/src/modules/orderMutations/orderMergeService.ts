import { randomUUID } from 'crypto';
import { getDb } from '../../persistence/mongoClient.js';
import type { Order, OrderItem, OrderNote, OrderTag, User } from '@nexusorder/shared-types';
import { orderRepository } from '../orders/orderRepository.js';
import { assertMergeEligible } from '../orders/orderStateMachine.js';
import { validateMergeInvariant, computeChildTaxLines } from './splitMergeInvariants.js';
import { emitAuditEvent } from '../../audit/auditLog.js';
import { writeCheckpoint, completeCheckpoint, failCheckpoint } from '../../recovery/checkpointWriter.js';

export const orderMergeService = {
  async merge(params: {
    orderIds: string[];
    userId: string;
    note?: string;
  }): Promise<Order> {
    // Load all orders
    const orders = await Promise.all(params.orderIds.map((id) => orderRepository.findById(id)));

    // Validate eligibility
    for (const order of orders) {
      assertMergeEligible(order.state);
    }
    const actor = await getDb().collection<User>('users').findOne(
      { _id: params.userId } as { _id: string },
    );
    validateMergeInvariant(orders, { ignoreUserMismatch: actor?.role === 'department_admin' });

    const correlationId = randomUUID();
    await writeCheckpoint({
      operationType: 'order_merge',
      operationId: correlationId,
      payload: { orderIds: params.orderIds, userId: params.userId },
    });

    try {
    // Gather all items, notes, tags
    const allItems: OrderItem[] = [];
    const allNotes: OrderNote[] = [];
    const allTags: OrderTag[] = [];

    for (const order of orders) {
      allItems.push(...(await orderRepository.getItems(order._id)));
      allNotes.push(...(await orderRepository.getNotes(order._id)));
      allTags.push(...(await orderRepository.getTags(order._id)));
    }

    // Build merged order
    const now = new Date();
    const mergedId = randomUUID();
    const taxLines = computeChildTaxLines(allItems);
    const subtotal = allItems.reduce((s, i) => s + i.lineTotal, 0);
    const taxTotal = taxLines.reduce((s, t) => s + t.amount, 0);
    const primaryOrder = orders[0]!;

    const mergedOrder: Order = {
      _id: mergedId,
      orderNumber: `${primaryOrder.orderNumber}-M`,
      userId: primaryOrder.userId,
      userScopeSnapshot: primaryOrder.userScopeSnapshot,
      state: primaryOrder.state,
      afterSalesState: 'none',
      subtotal,
      taxLines,
      taxTotal,
      total: subtotal + taxTotal,
      currency: primaryOrder.currency,
      mergedFromIds: params.orderIds,
      submittedAt: primaryOrder.submittedAt,
      autoCancelAt: primaryOrder.autoCancelAt,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };

    await orderRepository.insert(mergedOrder);

    // Re-assign items to merged order
    const mergedItems = allItems.map((i) => ({ ...i, _id: randomUUID(), orderId: mergedId }));
    await orderRepository.insertItems(mergedItems);

    // Copy notes/tags preserving history
    for (const note of allNotes) {
      await orderRepository.addNote({
        orderId: mergedId,
        authorId: note.authorId,
        content: `[Merged from order] ${note.content}`,
        createdAt: note.createdAt,
      });
    }

    const tagSet = new Set<string>();
    for (const tag of allTags) {
      if (!tagSet.has(tag.tag)) {
        tagSet.add(tag.tag);
        await orderRepository.addTag({ orderId: mergedId, tag: tag.tag, addedBy: tag.addedBy, addedAt: tag.addedAt });
      }
    }

    if (params.note) {
      await orderRepository.addNote({
        orderId: mergedId,
        authorId: params.userId,
        content: `Merged ${params.orderIds.length} orders: ${params.note}`,
        createdAt: now,
      });
    }

    // Cancel source orders (mark as closed/cancelled with merge reference)
    for (const order of orders) {
      await orderRepository.updateState(order._id, order.version, {
        state: 'cancelled',
        cancelledAt: now,
      });
    }

    await emitAuditEvent({
      action: 'order.merged',
      userId: params.userId,
      targetType: 'order',
      targetId: mergedId,
      correlationId,
      meta: { sourceOrderIds: params.orderIds, itemCount: allItems.length },
    });

    await completeCheckpoint(correlationId);

    return mergedOrder;
    } catch (err) {
      await failCheckpoint(correlationId, String(err));
      throw err;
    }
  },
};
