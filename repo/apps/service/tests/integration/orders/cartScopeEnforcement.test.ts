/**
 * Integration tests for scope enforcement on the cart/checkout mutation path.
 * Covers the blocker finding: users could previously bypass scope filtering
 * by directly posting out-of-scope catalog item IDs to POST /api/carts/items.
 */
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../../src/app.js';
import { usersService } from '../../../src/modules/users/usersService.js';
import { catalogService } from '../../../src/modules/catalog/catalogService.js';
import { vendorsService } from '../../../src/modules/catalog/vendorsService.js';

const app = createApp();

async function login(username: string, password = 'TestPass1!@#') {
  const res = await request(app).post('/api/auth/login').send({ username, password });
  return (res.headers['set-cookie'] as string[]).join('; ');
}

async function setupVendor() {
  return vendorsService.createVendor({ name: 'Scope Cart Vendor', isActive: true });
}

describe('Cart scope enforcement: POST /api/carts/items', () => {
  it('allows adding an in-scope item to cart', async () => {
    const vendor = await setupVendor();
    const item = await catalogService.createItem({
      vendorId: vendor._id, name: 'CS Textbook', sku: 'CS-001',
      unitPrice: 30, currency: 'CNY', taxRate: 0.08, stock: 50,
      isAvailable: true,
      eligibleScopes: [{ school: 'SCHOOL_A', major: 'CS' }],
    });

    await usersService.createUser({
      username: 'scope_cart_in', password: 'TestPass1!@#', role: 'student',
      scope: { school: 'SCHOOL_A', major: 'CS' },
    });
    const cookie = await login('scope_cart_in');

    const res = await request(app)
      .post('/api/carts/items')
      .set('Cookie', cookie)
      .send({ catalogItemId: item._id, quantity: 1 });
    expect(res.status).toBe(201);
  });

  it('rejects adding an out-of-scope item to cart', async () => {
    const vendor = await setupVendor();
    const item = await catalogService.createItem({
      vendorId: vendor._id, name: 'EE Lab Kit', sku: 'EE-001',
      unitPrice: 80, currency: 'CNY', taxRate: 0.08, stock: 20,
      isAvailable: true,
      eligibleScopes: [{ school: 'SCHOOL_A', major: 'EE' }],
    });

    // Student is in CS, but the item is scoped to EE
    await usersService.createUser({
      username: 'scope_cart_out', password: 'TestPass1!@#', role: 'student',
      scope: { school: 'SCHOOL_A', major: 'CS' },
    });
    const cookie = await login('scope_cart_out');

    const res = await request(app)
      .post('/api/carts/items')
      .set('Cookie', cookie)
      .send({ catalogItemId: item._id, quantity: 1 });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('ITEM_OUT_OF_SCOPE');
  });

  it('rejects item from a completely different school', async () => {
    const vendor = await setupVendor();
    const item = await catalogService.createItem({
      vendorId: vendor._id, name: 'School B Item', sku: 'SB-001',
      unitPrice: 25, currency: 'CNY', taxRate: 0.08, stock: 30,
      isAvailable: true,
      eligibleScopes: [{ school: 'SCHOOL_B' }],
    });

    await usersService.createUser({
      username: 'scope_cart_diffschool', password: 'TestPass1!@#', role: 'student',
      scope: { school: 'SCHOOL_A' },
    });
    const cookie = await login('scope_cart_diffschool');

    const res = await request(app)
      .post('/api/carts/items')
      .set('Cookie', cookie)
      .send({ catalogItemId: item._id, quantity: 1 });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('ITEM_OUT_OF_SCOPE');
  });

  it('allows unscoped admin to add any item', async () => {
    const vendor = await setupVendor();
    const item = await catalogService.createItem({
      vendorId: vendor._id, name: 'Restricted Item', sku: 'RI-001',
      unitPrice: 100, currency: 'CNY', taxRate: 0.08, stock: 10,
      isAvailable: true,
      eligibleScopes: [{ school: 'SCHOOL_X', major: 'PHYSICS' }],
    });

    await usersService.createUser({
      username: 'scope_cart_admin', password: 'TestPass1!@#', role: 'department_admin',
      scope: {},
    });
    const cookie = await login('scope_cart_admin');

    const res = await request(app)
      .post('/api/carts/items')
      .set('Cookie', cookie)
      .send({ catalogItemId: item._id, quantity: 1 });
    expect(res.status).toBe(201);
  });

  it('allows adding a globally available item (empty eligibleScopes)', async () => {
    const vendor = await setupVendor();
    const item = await catalogService.createItem({
      vendorId: vendor._id, name: 'Universal Item', sku: 'UNI-001',
      unitPrice: 15, currency: 'CNY', taxRate: 0.08, stock: 200,
      isAvailable: true,
      eligibleScopes: [],
    });

    await usersService.createUser({
      username: 'scope_cart_global', password: 'TestPass1!@#', role: 'student',
      scope: { school: 'ANY_SCHOOL', major: 'ANY_MAJOR' },
    });
    const cookie = await login('scope_cart_global');

    const res = await request(app)
      .post('/api/carts/items')
      .set('Cookie', cookie)
      .send({ catalogItemId: item._id, quantity: 1 });
    expect(res.status).toBe(201);
  });
});

describe('Checkout scope enforcement (defense-in-depth)', () => {
  it('rejects checkout if cart contains out-of-scope items inserted directly into DB', async () => {
    const { getDb } = await import('../../../src/persistence/mongoClient.js');
    const { randomUUID } = await import('crypto');

    const vendor = await setupVendor();
    // Create a scoped item
    const item = await catalogService.createItem({
      vendorId: vendor._id, name: 'Scoped Checkout Item', sku: 'SCO-CHK-001',
      unitPrice: 40, currency: 'CNY', taxRate: 0.08, stock: 50,
      isAvailable: true,
      eligibleScopes: [{ school: 'SCHOOL_Z', major: 'MATH' }],
    });

    // Create user in a different scope
    const user = await usersService.createUser({
      username: 'scope_checkout_bypass', password: 'TestPass1!@#', role: 'student',
      scope: { school: 'SCHOOL_Z', major: 'HISTORY' },
    });
    const cookie = await login('scope_checkout_bypass');

    // Simulate a bypass by inserting directly into the cart collection (DB-level)
    const cartId = randomUUID();
    await getDb().collection('carts').insertOne({
      _id: cartId,
      userId: user._id,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await getDb().collection('cart_items').insertOne({
      _id: randomUUID(),
      cartId,
      catalogItemId: item._id,
      quantity: 1,
      addedAt: new Date(),
    });

    const res = await request(app)
      .post('/api/carts/checkout')
      .set('Cookie', cookie);
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('ITEM_OUT_OF_SCOPE');
  });
});
