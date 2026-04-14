import { randomUUID } from 'crypto';
import { getDb } from '../../persistence/mongoClient.js';
import type { Order, OrderItem, OrderNote, OrderTag } from '@nexusorder/shared-types';
import { orderRepository } from '../orders/orderRepository.js';
import { assertSplitEligible } from '../orders/orderStateMachine.js';
import { validateSplitInvariant, computeChildTaxLines } from './splitMergeInvariants.js';
import { emitAuditEvent } from '../../audit/auditLog.js';
import { writeCheckpoint, completeCheckpoint, failCheckpoint } from '../../recovery/checkpointWriter.js';
import { BusinessRuleError } from '../../middleware/errorHandler.js';

export const orderSplitService = {
  async split(params: {
    orderId: string;
    itemIds: string[]; // items to move into the new child order
    userId: string;
    note?: string;
  }): Promise<{ original: Order; split: Order }> {
    const parent = await orderRepository.findById(params.orderId);
    assertSplitEligible(parent.state);

    const allItems = await orderRepository.getItems(params.orderId);
    if (allItems.length < 2) {
      throw new BusinessRuleError('SPLIT_TOO_FEW_ITEMS', 'Order must have at least 2 items to split');
    }

    const splitItems = allItems.filter((i) => params.itemIds.includes(i._id));
    const remainingItems = allItems.filter((i) => !params.itemIds.includes(i._id));

    if (splitItems.length === 0) {
      throw new BusinessRuleError('SPLIT_NO_ITEMS', 'No matching items found for split');
    }
    if (remainingItems.length === 0) {
      throw new BusinessRuleError('SPLIT_ALL_ITEMS', 'Cannot move all items — original order would be empty');
    }

    validateSplitInvariant(parent, [{ items: splitItems }, { items: remainingItems }]);

    const correlationId = randomUUID();

    // Write-ahead checkpoint before committing
    await writeCheckpoint({
      operationType: 'order_split',
      operationId: correlationId,
      payload: { orderId: params.orderId, splitItemIds: params.itemIds, userId: params.userId },
    });

    try {
    // Build the new child order
    const now = new Date();
    const childTaxLines = computeChildTaxLines(splitItems);
    const childSubtotal = splitItems.reduce((s, i) => s + i.lineTotal, 0);
    const childTaxTotal = childTaxLines.reduce((s, t) => s + t.amount, 0);
    const childId = randomUUID();

    const childOrder: Order = {
      _id: childId,
      orderNumber: `${parent.orderNumber}-S1`,
      userId: parent.userId,
      userScopeSnapshot: parent.userScopeSnapshot,
      state: parent.state,
      afterSalesState: 'none',
      subtotal: childSubtotal,
      taxLines: childTaxLines,
      taxTotal: childTaxTotal,
      total: childSubtotal + childTaxTotal,
      currency: parent.currency,
      parentOrderId: parent._id,
      submittedAt: parent.submittedAt,
      autoCancelAt: parent.autoCancelAt,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };

    // Recalculate parent after removal
    const remainingTaxLines = computeChildTaxLines(remainingItems);
    const remainingSubtotal = remainingItems.reduce((s, i) => s + i.lineTotal, 0);
    const remainingTaxTotal = remainingTaxLines.reduce((s, t) => s + t.amount, 0);

    // Persist child order
    await orderRepository.insert(childOrder);

    // Re-parent split items
    const updatedSplitItems: OrderItem[] = splitItems.map((i) => ({ ...i, orderId: childId }));
    await getDb().collection<OrderItem>('order_items').deleteMany({ _id: { $in: splitItems.map((i) => i._id) } });
    await orderRepository.insertItems(updatedSplitItems);

    // Update parent invoice
    await orderRepository.updateState(parent._id, parent.version, {
      subtotal: remainingSubtotal,
      taxLines: remainingTaxLines,
      taxTotal: remainingTaxTotal,
      total: remainingSubtotal + remainingTaxTotal,
      splitIntoIds: [...(parent.splitIntoIds ?? []), childId],
    });

    // Copy notes and tags to child (preserving source linkage)
    const parentNotes = await orderRepository.getNotes(parent._id);
    const parentTags = await orderRepository.getTags(parent._id);

    if (parentNotes.length > 0) {
      const childNotes: OrderNote[] = parentNotes.map((n) => ({
        ...n,
        _id: randomUUID(),
        orderId: childId,
        content: `[Split from ${parent.orderNumber}] ${n.content}`,
      }));
      await getDb().collection<OrderNote>('order_notes').insertMany(childNotes as (OrderNote & { _id: string })[]);
    }

    if (parentTags.length > 0) {
      const childTags: OrderTag[] = parentTags.map((t) => ({
        ...t,
        _id: randomUUID(),
        orderId: childId,
      }));
      await getDb().collection<OrderTag>('order_tags').insertMany(childTags as (OrderTag & { _id: string })[]);
    }

    // Audit
    await emitAuditEvent({
      action: 'order.split',
      userId: params.userId,
      targetType: 'order',
      targetId: params.orderId,
      correlationId,
      meta: { childOrderId: childId, splitItemCount: splitItems.length },
    });

    if (params.note) {
      await orderRepository.addNote({
        orderId: params.orderId,
        authorId: params.userId,
        content: `Split ${splitItems.length} item(s) into order ${childOrder.orderNumber}: ${params.note}`,
        createdAt: now,
      });
    }

    await completeCheckpoint(correlationId);

    return {
      original: await orderRepository.findById(parent._id),
      split: childOrder,
    };
    } catch (err) {
      await failCheckpoint(correlationId, String(err));
      throw err;
    }
  },
};
