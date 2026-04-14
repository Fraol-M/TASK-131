import { getDb } from '../persistence/mongoClient.js';
import type { Order } from '@nexusorder/shared-types';
import { emitAuditEvent } from '../audit/auditLog.js';
import { createModuleLogger } from '@nexusorder/shared-logging';

const log = createModuleLogger('autoCancelJob');

/**
 * Cancel unpaid orders whose autoCancelAt time has passed.
 * Only applies to orders in 'submitted' state (not yet paid).
 */
export async function runAutoCancelJob(): Promise<void> {
  const now = new Date();
  const expiredOrders = await getDb()
    .collection<Order>('orders')
    .find({
      state: 'submitted',
      autoCancelAt: { $lte: now },
    })
    .toArray();

  if (expiredOrders.length === 0) return;

  log.info({ count: expiredOrders.length }, 'Auto-cancelling expired unpaid orders');

  for (const order of expiredOrders) {
    await getDb().collection<Order>('orders').updateOne(
      { _id: order._id, version: order.version } as { _id: string; version: number },
      {
        $set: {
          state: 'cancelled',
          cancelledAt: now,
          version: order.version + 1,
          updatedAt: now,
        },
      },
    );

    await emitAuditEvent({
      action: 'order.cancelled',
      targetType: 'order',
      targetId: order._id,
      meta: { reason: 'auto_cancel_timeout', autoCancelAt: order.autoCancelAt },
    });
  }
}
