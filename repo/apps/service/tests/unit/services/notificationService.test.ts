import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../../src/app.js';
import { usersService } from '../../../src/modules/users/usersService.js';
import { catalogService } from '../../../src/modules/catalog/catalogService.js';
import { vendorsService } from '../../../src/modules/catalog/vendorsService.js';
import type { Notification } from '@nexusorder/shared-types';

const app = createApp();

async function login(username: string, password = 'TestPass1!@#') {
  const res = await request(app).post('/api/auth/login').send({ username, password });
  return (res.headers['set-cookie'] as string[]).join('; ');
}

async function setupStudentAndItem(suffix: string) {
  await usersService.createUser({
    username: `notif_stu_${suffix}`, password: 'TestPass1!@#', role: 'student',
    scope: { school: 'NOTIF_SCH' },
  });
  const vendor = await vendorsService.createVendor({ name: `Notif Vendor ${suffix}`, isActive: true });
  const item = await catalogService.createItem({
    vendorId: vendor._id, name: 'Notif Item', sku: `NF-${suffix}`,
    unitPrice: 20, currency: 'CNY', taxRate: 0.08, stock: 100,
    isAvailable: true, eligibleScopes: [],
  });
  const cookie = await login(`notif_stu_${suffix}`);
  return { cookie, item };
}

async function placeOrder(cookie: string, itemId: string): Promise<string> {
  await request(app).post('/api/carts/items').set('Cookie', cookie)
    .send({ catalogItemId: itemId, quantity: 1 });
  const res = await request(app).post('/api/carts/checkout').set('Cookie', cookie);
  return (res.body.data as { _id: string })._id;
}

describe('notificationService via integration', () => {
  it('GET /api/notifications returns empty list before any activity', async () => {
    const { cookie } = await setupStudentAndItem('empty1');

    const res = await request(app).get('/api/notifications').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBe(0);
  });

  it('POST /api/notifications/:id/read marks a notification as read', async () => {
    const { cookie, item } = await setupStudentAndItem('read1');
    await placeOrder(cookie, item._id);

    const listRes = await request(app).get('/api/notifications').set('Cookie', cookie);
    expect(listRes.status).toBe(200);
    const notifications = listRes.body.data as Notification[];
    expect(notifications.length).toBeGreaterThan(0);

    const notif = notifications.find((n) => n.milestone === 'order_placed');
    expect(notif).toBeDefined();
    expect(notif!.isRead).toBe(false);

    const markRes = await request(app)
      .post(`/api/notifications/${notif!._id}/read`)
      .set('Cookie', cookie);
    expect(markRes.status).toBe(200);

    const afterRes = await request(app).get('/api/notifications').set('Cookie', cookie);
    const updated = (afterRes.body.data as Notification[]).find((n) => n._id === notif!._id);
    expect(updated!.isRead).toBe(true);
  });

  it('PUT /api/notifications/preferences opts out of order_placed; subsequent checkout creates no notification', async () => {
    const { cookie, item } = await setupStudentAndItem('pref1');

    const prefRes = await request(app)
      .put('/api/notifications/preferences')
      .set('Cookie', cookie)
      .send({ milestone: 'order_placed', onScreen: false });
    expect(prefRes.status).toBe(200);

    await placeOrder(cookie, item._id);

    const listRes = await request(app).get('/api/notifications').set('Cookie', cookie);
    expect(listRes.status).toBe(200);
    const orderPlacedNotifs = (listRes.body.data as Notification[]).filter(
      (n) => n.milestone === 'order_placed',
    );
    expect(orderPlacedNotifs.length).toBe(0);
  });

  it('GET /api/notifications without auth returns 401', async () => {
    const res = await request(app).get('/api/notifications');
    expect(res.status).toBe(401);
  });
});
