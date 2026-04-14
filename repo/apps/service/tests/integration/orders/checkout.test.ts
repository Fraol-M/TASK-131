import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../../src/app.js';
import { usersService } from '../../../src/modules/users/usersService.js';
import { catalogService } from '../../../src/modules/catalog/catalogService.js';
import { vendorsService } from '../../../src/modules/catalog/vendorsService.js';
import { config } from '../../../src/config/index.js';
import { getDb } from '../../../src/persistence/mongoClient.js';

const app = createApp();

async function login(username: string, password = 'TestPass1!@#') {
  const res = await request(app).post('/api/auth/login').send({ username, password });
  return (res.headers['set-cookie'] as string[]).join('; ');
}

async function setupCatalogItem() {
  const vendor = await vendorsService.createVendor({ name: 'Test Vendor', isActive: true });
  return catalogService.createItem({
    vendorId: vendor._id, name: 'Test Item', sku: 'TST-001',
    unitPrice: 50, currency: 'USD', taxRate: 0.08, stock: 100,
    isAvailable: true, eligibleScopes: [],
  });
}

describe('Checkout throttle', () => {
  it(`blocks checkout after ${config.checkout.maxAttempts} attempts in the window`, async () => {
    await usersService.createUser({ username: 'throttleuser', password: 'TestPass1!@#', role: 'student', scope: {} });
    const cookie = await login('throttleuser');
    const item = await setupCatalogItem();

    // Exhaust the throttle by checking out maxAttempts times
    // Each checkout clears the cart so we need to re-add an item each time
    for (let i = 0; i < config.checkout.maxAttempts; i++) {
      await request(app).post('/api/carts/items').set('Cookie', cookie)
        .send({ catalogItemId: item._id, quantity: 1 });
      await request(app).post('/api/carts/checkout').set('Cookie', cookie);
    }

    // The maxAttempts+1 checkout should be throttled
    await request(app).post('/api/carts/items').set('Cookie', cookie)
      .send({ catalogItemId: item._id, quantity: 1 });
    const res = await request(app).post('/api/carts/checkout').set('Cookie', cookie);
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('CHECKOUT_THROTTLED');
  });
});

describe('Blacklist policy', () => {
  it('allows blacklisted user to browse catalog', async () => {
    const user = await usersService.createUser({ username: 'blackuser', password: 'TestPass1!@#', role: 'student', scope: {} });
    await usersService.addToBlacklist(user._id, 'test reason', 'admin');
    const cookie = await login('blackuser');
    const res = await request(app).get('/api/catalog').set('Cookie', cookie);
    expect(res.status).toBe(200);
  });

  it('blocks blacklisted user from checkout', async () => {
    const user = await usersService.createUser({ username: 'blackuser2', password: 'TestPass1!@#', role: 'student', scope: {} });
    await usersService.addToBlacklist(user._id, 'test reason', 'admin');
    const cookie = await login('blackuser2');
    const res = await request(app).post('/api/carts/checkout').set('Cookie', cookie);
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('USER_BLACKLISTED');
  });
});
