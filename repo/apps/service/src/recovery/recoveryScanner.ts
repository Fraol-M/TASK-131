import { getDb } from '../persistence/mongoClient.js';
import type { CheckpointLog, Order, OrderItem, OrderTaxLine } from '@nexusorder/shared-types';
import { emitAuditEvent } from '../audit/auditLog.js';
import { createModuleLogger } from '@nexusorder/shared-logging';

const log = createModuleLogger('recoveryScanner');

/**
 * Called at service startup before accepting traffic.
 * Finds incomplete ('pending') checkpoints from a previous run and
 * attempts compensation or flags them for manual review.
 */
export async function runStartupRecovery(): Promise<void> {
  const pendingCheckpoints = await getDb()
    .collection<CheckpointLog>('checkpoint_logs')
    .find({ status: 'pending' })
    .sort({ startedAt: 1 })
    .toArray();

  if (pendingCheckpoints.length === 0) {
    log.info('Startup recovery: no incomplete checkpoints found');
    return;
  }

  log.warn(
    { count: pendingCheckpoints.length },
    'Startup recovery: found incomplete checkpoints — attempting compensation',
  );

  for (const checkpoint of pendingCheckpoints) {
    await recoverCheckpoint(checkpoint);
  }
}

async function recoverCheckpoint(checkpoint: CheckpointLog): Promise<void> {
  const { operationType, operationId, payload } = checkpoint;
  log.info({ operationType, operationId }, 'Recovering checkpoint');

  try {
    switch (operationType) {
      case 'order_split':
        await recoverSplit(checkpoint);
        break;

      case 'order_merge':
        await recoverMerge(checkpoint);
        break;

      case 'restore':
      case 'update_apply':
        // These operations should be safe to mark as failed — the startup health check
        // will determine if the system is in a consistent state
        await getDb().collection<CheckpointLog>('checkpoint_logs').updateOne(
          { operationId },
          { $set: { status: 'failed', recoveredAt: new Date(), recoveryNote: 'Incomplete operation at startup — marked as failed' } },
        );
        await emitAuditEvent({
          action: 'recovery.performed',
          meta: { operationType, operationId, recoveryType: 'failed_marked' },
        });
        break;

      default:
        log.warn({ operationType }, 'Unknown checkpoint operation type — marking as failed');
        await getDb().collection<CheckpointLog>('checkpoint_logs').updateOne(
          { operationId },
          { $set: { status: 'failed', recoveredAt: new Date(), recoveryNote: 'Unknown operation type' } },
        );
    }
  } catch (err) {
    log.error({ err, operationId }, 'Recovery failed for checkpoint');
  }
}

/**
 * Compensating rollback for an incomplete order_split.
 *
 * Strategy: delete any child order created for the split and move its items
 * back to the parent. This is safe because if the child exists but the parent
 * was not fully updated, the system is in an inconsistent state and rolling
 * back to the pre-split state is the correct action.
 */
async function recoverSplit(checkpoint: CheckpointLog): Promise<void> {
  const { operationId, payload } = checkpoint;
  const orderId = payload['orderId'] as string | undefined;

  if (!orderId) {
    log.warn({ operationId }, 'order_split checkpoint missing orderId — marking as failed');
    await markCheckpointFailed(operationId, 'Missing orderId in checkpoint payload');
    return;
  }

  // Find the child order that was created by this split (parentOrderId links it back)
  const childOrder = await getDb()
    .collection<Order>('orders')
    .findOne({ parentOrderId: orderId });

  if (!childOrder) {
    // Split failed before the child was inserted — nothing to undo
    log.info({ operationId, orderId }, 'order_split: no child order found, marking as failed (no-op)');
    await markCheckpointFailed(operationId, 'Child order not found — split aborted before insert');
    return;
  }

  log.warn({ operationId, orderId, childId: childOrder._id }, 'order_split: compensating — deleting partial child order');

  // 1. Move child items back to the parent
  await getDb()
    .collection<OrderItem>('order_items')
    .updateMany({ orderId: childOrder._id }, { $set: { orderId } });

  // 2. Delete child notes, tags, and the child order itself
  await getDb().collection('order_notes').deleteMany({ orderId: childOrder._id });
  await getDb().collection('order_tags').deleteMany({ orderId: childOrder._id });
  await getDb().collection<Order>('orders').deleteOne({ _id: childOrder._id } as { _id: string });

  // 3. Remove the child ID from parent's splitIntoIds if it was already written
  await getDb().collection<Order>('orders').updateOne(
    { _id: orderId } as { _id: string },
    { $pull: { splitIntoIds: childOrder._id } as Record<string, unknown> },
  );

  // 4. Recompute parent financial fields from its current items to ensure consistency
  const parentItems = await getDb()
    .collection<OrderItem>('order_items')
    .find({ orderId })
    .toArray();

  const subtotal = parentItems.reduce((s, i) => s + i.lineTotal, 0);
  const taxByRate = new Map<number, number>();
  for (const item of parentItems) {
    const taxAmount = item.lineTotal * item.taxRate;
    taxByRate.set(item.taxRate, (taxByRate.get(item.taxRate) ?? 0) + taxAmount);
  }
  const taxLines: OrderTaxLine[] = Array.from(taxByRate.entries()).map(([rate, amount]) => ({
    description: `Tax (${(rate * 100).toFixed(0)}%)`,
    rate,
    amount,
  }));
  const taxTotal = taxLines.reduce((s, t) => s + t.amount, 0);

  await getDb().collection<Order>('orders').updateOne(
    { _id: orderId } as { _id: string },
    { $set: { subtotal, taxLines, taxTotal, total: subtotal + taxTotal, updatedAt: new Date() } },
  );

  await getDb().collection<CheckpointLog>('checkpoint_logs').updateOne(
    { operationId },
    {
      $set: {
        status: 'recovered',
        recoveredAt: new Date(),
        recoveryNote: `Compensating rollback: deleted partial child order ${childOrder._id}`,
      },
    },
  );

  await emitAuditEvent({
    action: 'recovery.performed',
    meta: { operationType: 'order_split', operationId, orderId, childOrderId: childOrder._id, recoveryType: 'compensating_rollback' },
  });

  log.info({ operationId, orderId, childId: childOrder._id }, 'order_split recovery complete');
}

/**
 * Compensating rollback for an incomplete order_merge.
 *
 * Strategy: delete the merged order (if it was inserted) and its items. The
 * source orders remain or were already cancelled — this flags the checkpoint
 * for admin review so they can restore source order states if needed.
 */
async function recoverMerge(checkpoint: CheckpointLog): Promise<void> {
  const { operationId, payload } = checkpoint;
  const orderIds = payload['orderIds'] as string[] | undefined;

  if (!orderIds || orderIds.length === 0) {
    log.warn({ operationId }, 'order_merge checkpoint missing orderIds — marking as failed');
    await markCheckpointFailed(operationId, 'Missing orderIds in checkpoint payload');
    return;
  }

  // Find the merged order that references all source orders
  const mergedOrder = await getDb()
    .collection<Order>('orders')
    .findOne({ mergedFromIds: { $all: orderIds } });

  if (!mergedOrder) {
    // Merge failed before inserting the merged order — nothing to undo
    log.info({ operationId, orderIds }, 'order_merge: no merged order found, marking as failed (no-op)');
    await markCheckpointFailed(operationId, 'Merged order not found — merge aborted before insert');
    return;
  }

  log.warn({ operationId, mergedId: mergedOrder._id, orderIds }, 'order_merge: compensating — deleting partial merged order');

  // Delete the merged order and its items/notes/tags
  await getDb().collection('order_items').deleteMany({ orderId: mergedOrder._id });
  await getDb().collection('order_notes').deleteMany({ orderId: mergedOrder._id });
  await getDb().collection('order_tags').deleteMany({ orderId: mergedOrder._id });
  await getDb().collection<Order>('orders').deleteOne({ _id: mergedOrder._id } as { _id: string });

  // Restore source orders that were cancelled by this merge.
  // The merge validated that all source orders were in the same state, so
  // mergedOrder.state is the pre-merge state of every source order.
  // We only restore orders that are currently 'cancelled' with a cancelledAt
  // within 60 seconds of the merged order's creation — tighter window
  // distinguishes merge-cancellations from independent auto-cancellations.
  const preMergeState = mergedOrder.state;
  const windowStart = new Date(mergedOrder.createdAt.getTime() - 5_000);   // 5 s before
  const windowEnd   = new Date(mergedOrder.createdAt.getTime() + 60_000);  // 60 s after

  for (const sourceId of orderIds) {
    const sourceOrder = await getDb()
      .collection<Order>('orders')
      .findOne({ _id: sourceId } as { _id: string });

    if (
      sourceOrder?.state === 'cancelled' &&
      sourceOrder.cancelledAt &&
      sourceOrder.cancelledAt >= windowStart &&
      sourceOrder.cancelledAt <= windowEnd
    ) {
      await getDb().collection<Order>('orders').updateOne(
        { _id: sourceId, version: sourceOrder.version } as { _id: string; version: number },
        {
          $set: {
            state: preMergeState,
            version: sourceOrder.version + 1,
            updatedAt: new Date(),
          } as Partial<Order>,
          $unset: { cancelledAt: '' },
        },
      );
      log.info({ operationId, sourceId, restoredTo: preMergeState }, 'order_merge recovery: source order restored');
    }
  }

  // Determinism gate: every source order must be in preMergeState after compensation.
  // If any are not, the recovery cannot safely declare success — mark as failed so an
  // admin can inspect rather than silently accepting a partially inconsistent state.
  const unrecoverable: string[] = [];
  for (const sourceId of orderIds) {
    const finalOrder = await getDb()
      .collection<Order>('orders')
      .findOne({ _id: sourceId } as { _id: string });

    if (finalOrder && finalOrder.state !== preMergeState) {
      unrecoverable.push(sourceId);
      log.warn(
        { operationId, sourceId, actualState: finalOrder?.state, expectedState: preMergeState },
        'order_merge recovery: source order not in expected pre-merge state after compensation',
      );
    }
  }

  if (unrecoverable.length > 0) {
    await markCheckpointFailed(
      operationId,
      `Partial merged order ${mergedOrder._id} deleted but ${unrecoverable.length} of ${orderIds.length} source orders could not be confirmed in state '${preMergeState}' — manual review required: ${unrecoverable.join(', ')}`,
    );
    await emitAuditEvent({
      action: 'recovery.performed',
      meta: { operationType: 'order_merge', operationId, mergedOrderId: mergedOrder._id, sourceOrderIds: orderIds, unrecoverableIds: unrecoverable, recoveryType: 'partial_failed' },
    });
    return;
  }

  await getDb().collection<CheckpointLog>('checkpoint_logs').updateOne(
    { operationId },
    {
      $set: {
        status: 'recovered',
        recoveredAt: new Date(),
        recoveryNote: `Partial merged order ${mergedOrder._id} deleted. All ${orderIds.length} source orders confirmed in state '${preMergeState}'.`,
      },
    },
  );

  await emitAuditEvent({
    action: 'recovery.performed',
    meta: { operationType: 'order_merge', operationId, mergedOrderId: mergedOrder._id, sourceOrderIds: orderIds, recoveryType: 'compensating_rollback' },
  });

  log.info({ operationId, orderIds }, 'order_merge recovery complete — all source orders confirmed restored');
}

async function markCheckpointFailed(operationId: string, note: string): Promise<void> {
  await getDb().collection<CheckpointLog>('checkpoint_logs').updateOne(
    { operationId },
    { $set: { status: 'failed', recoveredAt: new Date(), recoveryNote: note } },
  );
}
