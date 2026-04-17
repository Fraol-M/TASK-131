/**
 * Unit-level tests for paymentIntentService.
 * Exercises createIntent and markPaid directly against the real in-memory MongoDB
 * provided by the test setup.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { randomUUID } from 'crypto';
import { getDb } from '../../../src/persistence/mongoClient.js';
import { paymentIntentService } from '../../../src/modules/payments/paymentIntentService.js';
import { catalogService } from '../../../src/modules/catalog/catalogService.js';
import { vendorsService } from '../../../src/modules/catalog/vendorsService.js';

async function createApprovedOrder() {
  const vendor = await vendorsService.createVendor({ name: `PI Vendor ${randomUUID().slice(0, 6)}`, isActive: true });
  const item = await catalogService.createItem({
    vendorId: vendor._id, name: 'PI Item', sku: `PI-${randomUUID().slice(0, 6)}`,
    unitPrice: 50, currency: 'CNY', taxRate: 0.08, stock: 100,
    isAvailable: true, eligibleScopes: [],
  });

  const orderId = randomUUID();
  await getDb().collection('orders').insertOne({
    _id: orderId,
    orderNumber: `NO-${Date.now()}`,
    userId: 'test-user',
    state: 'approved',
    afterSalesState: 'none',
    items: [{ catalogItemId: item._id, quantity: 1, unitPrice: 50, currency: 'CNY', taxRate: 0.08, taxAmount: 4, lineTotal: 54 }],
    subtotal: 50,
    taxLines: [{ taxRate: 0.08, taxableAmount: 50, taxAmount: 4 }],
    taxTotal: 4,
    total: 54,
    currency: 'CNY',
    userScopeSnapshot: { school: 'SCHOOL_A' },
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  return orderId;
}

describe('paymentIntentService.createIntent', () => {
  it('creates a pending intent with the correct orderId and amount', async () => {
    const orderId = await createApprovedOrder();
    const intent = await paymentIntentService.createIntent(orderId);

    expect(intent._id).toBeDefined();
    expect(intent.orderId).toBe(orderId);
    expect(intent.status).toBe('pending');
    expect(intent.amount).toBe(54);
    expect(intent.currency).toBe('CNY');

    const doc = await getDb().collection('payment_intents').findOne({ _id: intent._id } as { _id: string });
    expect(doc).not.toBeNull();
    expect(doc!.status).toBe('pending');
  });

  it('throws ConflictError when an intent already exists for the order', async () => {
    const orderId = await createApprovedOrder();
    await paymentIntentService.createIntent(orderId);

    // Re-set order state to 'approved' so guardTransition passes, but intent already exists
    await getDb().collection('orders').updateOne(
      { _id: orderId } as { _id: string },
      { $set: { state: 'approved' } },
    );

    await expect(paymentIntentService.createIntent(orderId)).rejects.toThrow(/already exists/i);
  });

  it('throws when order is not in approved state', async () => {
    const orderId = randomUUID();
    await getDb().collection('orders').insertOne({
      _id: orderId,
      orderNumber: `NO-INVALID-${Date.now()}`,
      userId: 'test-user',
      state: 'submitted',
      afterSalesState: 'none',
      subtotal: 10, taxLines: [], taxTotal: 0, total: 10,
      currency: 'CNY', version: 1,
      createdAt: new Date(), updatedAt: new Date(),
    });

    await expect(paymentIntentService.createIntent(orderId)).rejects.toThrow();
  });
});

describe('paymentIntentService.markPaid', () => {
  it('sets intent status to paid and advances order to paid state', async () => {
    const orderId = await createApprovedOrder();
    const intent = await paymentIntentService.createIntent(orderId);

    await paymentIntentService.markPaid(intent._id, 'REF-UNIT-TEST-001');

    const updatedIntent = await getDb().collection('payment_intents').findOne({ _id: intent._id } as { _id: string });
    expect(updatedIntent!.status).toBe('paid');
    expect(updatedIntent!.paymentReferenceEncrypted).toBeDefined();
    expect(updatedIntent!.paymentReferenceMasked).toBeDefined();

    const updatedOrder = await getDb().collection('orders').findOne({ _id: orderId } as { _id: string });
    expect(updatedOrder!.state).toBe('paid');
  });

  it('throws NotFoundError when intentId does not exist', async () => {
    await expect(paymentIntentService.markPaid(randomUUID(), 'REF-X')).rejects.toThrow(/not found/i);
  });
});
