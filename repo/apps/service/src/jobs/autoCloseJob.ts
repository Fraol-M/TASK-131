import { getDb } from '../persistence/mongoClient.js';
import type { Order } from '@nexusorder/shared-types';
import { emitAuditEvent } from '../audit/auditLog.js';
import { createModuleLogger } from '@nexusorder/shared-logging';

const log = createModuleLogger('autoCloseJob');

/**
 * Close delivered orders whose autoCloseAt time has passed AND no RMA is open.
 */
export async function runAutoCloseJob(): Promise<void> {
  const now = new Date();
  const eligibleOrders = await getDb()
    .collection<Order>('orders')
    .find({
      state: 'delivered',
      autoCloseAt: { $lte: now },
      afterSalesState: 'none', // do not close if an RMA is open
    })
    .toArray();

  if (eligibleOrders.length === 0) return;

  log.info({ count: eligibleOrders.length }, 'Auto-closing delivered orders');

  for (const order of eligibleOrders) {
    await getDb().collection<Order>('orders').updateOne(
      { _id: order._id, version: order.version } as { _id: string; version: number },
      {
        $set: {
          state: 'closed',
          closedAt: now,
          version: order.version + 1,
          updatedAt: now,
        },
      },
    );

    await emitAuditEvent({
      action: 'order.closed',
      targetType: 'order',
      targetId: order._id,
      meta: { reason: 'auto_close', autoCloseAt: order.autoCloseAt },
    });
  }
}
