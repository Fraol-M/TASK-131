import { randomUUID } from 'crypto';
import type { Order, OrderItem, CatalogItem } from '@nexusorder/shared-types';
import { getDb } from '../../persistence/mongoClient.js';
import { orderRepository } from './orderRepository.js';
import { assertCheckoutThrottle } from './checkoutThrottle.js';
import { assertNotBlacklisted } from '../catalog/blacklistPolicy.js';
import { emitAuditEvent } from '../../audit/auditLog.js';
import { notificationService } from '../notifications/notificationService.js';
import { config } from '../../config/index.js';
import { BusinessRuleError } from '../../middleware/errorHandler.js';
import type { UserScope } from '@nexusorder/shared-types';
import { isItemInScope } from '../catalog/catalogService.js';

async function generateOrderNumber(): Promise<string> {
  const seq = await getDb()
    .collection('order_sequences')
    .findOneAndUpdate(
      { _id: 'order_seq' },
      { $inc: { seq: 1 }, $setOnInsert: { _id: 'order_seq' } },
      { upsert: true, returnDocument: 'after' },
    );
  const num = (seq?.seq as number) ?? 1;
  return `NO-${String(num).padStart(8, '0')}`;
}

export const checkoutService = {
  async checkout(userId: string, scope: UserScope): Promise<Order> {
    // 1. Policy checks (order matters — blacklist before throttle for UX clarity)
    await assertNotBlacklisted(userId);
    await assertCheckoutThrottle(userId);

    // 2. Get cart
    const cart = await orderRepository.getCartByUser(userId);
    if (!cart) throw new BusinessRuleError('CART_EMPTY', 'Cart is empty');

    const cartItems = await orderRepository.getCartItems(cart._id);
    if (cartItems.length === 0) throw new BusinessRuleError('CART_EMPTY', 'Cart has no items');

    // 3. Load catalog items and validate availability
    const catalogIds = cartItems.map((ci) => ci.catalogItemId);
    const catalogItems = await getDb()
      .collection<CatalogItem>('catalog_items')
      .find({ _id: { $in: catalogIds } } as Record<string, unknown>)
      .toArray();

    const catalogMap = new Map(catalogItems.map((ci) => [ci._id, ci]));

    // 4. Build order items and compute invoice
    const orderItems: OrderItem[] = [];
    let subtotal = 0;
    const taxByRate = new Map<number, number>();

    for (const ci of cartItems) {
      const catalogItem = catalogMap.get(ci.catalogItemId);
      if (!catalogItem || !catalogItem.isAvailable) {
        throw new BusinessRuleError('ITEM_UNAVAILABLE', `Item ${ci.catalogItemId} is no longer available`);
      }
      // Defense-in-depth: reject out-of-scope items even if they bypassed the cart check
      if (!isItemInScope(catalogItem, scope)) {
        await emitAuditEvent({
          action: 'checkout.scope_violation',
          userId,
          meta: { catalogItemId: ci.catalogItemId, scope },
        });
        throw new BusinessRuleError('ITEM_OUT_OF_SCOPE', `Item ${ci.catalogItemId} is not available for your scope`);
      }
      const lineTotal = catalogItem.unitPrice * ci.quantity;
      const taxAmount = lineTotal * catalogItem.taxRate;
      subtotal += lineTotal;
      taxByRate.set(catalogItem.taxRate, (taxByRate.get(catalogItem.taxRate) ?? 0) + taxAmount);

      orderItems.push({
        _id: randomUUID(),
        orderId: '', // filled below
        catalogItemId: ci.catalogItemId,
        vendorId: catalogItem.vendorId,
        name: catalogItem.name,
        sku: catalogItem.sku,
        quantity: ci.quantity,
        unitPrice: catalogItem.unitPrice,
        taxRate: catalogItem.taxRate,
        lineTotal,
      });
    }

    const taxLines = Array.from(taxByRate.entries()).map(([rate, amount]) => ({
      description: `Tax (${(rate * 100).toFixed(0)}%)`,
      rate,
      amount,
    }));
    const taxTotal = taxLines.reduce((sum, t) => sum + t.amount, 0);

    // 5. Create order
    const now = new Date();
    const autoCancelAt = new Date(now.getTime() + config.order.autoCancelMinutes * 60 * 1000);
    const orderId = randomUUID();
    const orderNumber = await generateOrderNumber();

    const order: Order = {
      _id: orderId,
      orderNumber,
      userId,
      userScopeSnapshot: scope,
      state: 'draft',
      afterSalesState: 'none',
      subtotal,
      taxLines,
      taxTotal,
      total: subtotal + taxTotal,
      currency: catalogItems[0]?.currency ?? 'USD',
      autoCancelAt,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };

    // Assign orderId to items
    for (const item of orderItems) {
      item.orderId = orderId;
    }

    // 6. Persist draft order
    await orderRepository.insert(order);
    await orderRepository.insertItems(orderItems);
    await orderRepository.clearCart(cart._id);

    // 7. Audit: order created in draft state
    await emitAuditEvent({
      action: 'order.drafted',
      userId,
      targetType: 'order',
      targetId: orderId,
      meta: { orderNumber, state: 'draft', itemCount: orderItems.length },
    });

    // 8. Transition draft → submitted (auditable state change)
    await orderRepository.updateState(orderId, order.version, {
      state: 'submitted',
      submittedAt: now,
    });

    // 9. Audit: order submitted
    await emitAuditEvent({
      action: 'order.submitted',
      userId,
      targetType: 'order',
      targetId: orderId,
      meta: { orderNumber, total: order.total },
    });

    // 10. Milestone notification
    await notificationService.create({
      userId,
      milestone: 'order_placed',
      title: 'Order Placed',
      body: `Your order ${orderNumber} has been submitted for approval.`,
      relatedEntityType: 'order',
      relatedEntityId: orderId,
    }).catch(() => null); // notifications are best-effort

    return await orderRepository.findById(orderId);
  },
};
