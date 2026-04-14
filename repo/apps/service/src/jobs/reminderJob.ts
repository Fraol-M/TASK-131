import { getDb } from '../persistence/mongoClient.js';
import { notificationService } from '../modules/notifications/notificationService.js';
import type { Order } from '@nexusorder/shared-types';
import { createModuleLogger } from '@nexusorder/shared-logging';
import { config } from '../config/index.js';

const log = createModuleLogger('reminderJob');

/**
 * Send reminders for orders approaching auto-cancel deadline.
 */
export async function runReminderJob(): Promise<void> {
  const warningThreshold = new Date(Date.now() + 5 * 60 * 1000); // 5 min warning

  const soonToExpire = await getDb()
    .collection<Order>('orders')
    .find({
      state: 'submitted',
      autoCancelAt: { $lte: warningThreshold, $gt: new Date() },
    })
    .toArray();

  for (const order of soonToExpire) {
    await notificationService.create({
      userId: order.userId,
      milestone: 'auto_cancel_warning',
      title: 'Order about to be cancelled',
      body: `Order ${order.orderNumber} will be auto-cancelled in less than 5 minutes if payment is not received.`,
      relatedEntityType: 'order',
      relatedEntityId: order._id,
    });
  }

  if (soonToExpire.length > 0) {
    log.info({ count: soonToExpire.length }, 'Auto-cancel warning notifications sent');
  }
}
