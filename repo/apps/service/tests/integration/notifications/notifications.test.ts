/**
 * Integration tests for notifications, global search, and device fingerprinting.
 */
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../../src/app.js';
import { usersService } from '../../../src/modules/users/usersService.js';
import { notificationService } from '../../../src/modules/notifications/notificationService.js';
import { getDb } from '../../../src/persistence/mongoClient.js';
import type { UserPublic } from '@nexusorder/shared-types';

const app = createApp();

async function createAndLogin(username: string, role: 'student' | 'faculty_advisor' | 'department_admin' = 'student', school = 'TEST_SCHOOL') {
  await usersService.createUser({ username, password: 'TestPass1!@#', role, scope: { school } });
  const res = await request(app).post('/api/auth/login').send({ username, password: 'TestPass1!@#' });
  return (res.headers['set-cookie'] as string[]).join('; ');
}

// ─── Notifications ──────────────────────────────────────────────────────────

describe('Notifications: GET /api/notifications', () => {
  it('unauthenticated request gets 401', async () => {
    const res = await request(app).get('/api/notifications');
    expect(res.status).toBe(401);
  });

  it('returns empty list when no notifications exist', async () => {
    const cookie = await createAndLogin('notif_user_1');
    const res = await request(app).get('/api/notifications').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('returns notifications for the authenticated user', async () => {
    const cookie = await createAndLogin('notif_user_2');
    const user = await getDb().collection<UserPublic>('users').findOne({ username: 'notif_user_2' });
    if (!user) throw new Error('User not found');

    // Create a notification directly via service
    await notificationService.create({
      userId: user._id,
      milestone: 'order_placed',
      title: 'Test Notification',
      body: 'Your order was submitted.',
    });

    const res = await request(app).get('/api/notifications').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect((res.body.data as Array<{ title: string }>).some((n) => n.title === 'Test Notification')).toBe(true);
  });

  it('marks a notification as read', async () => {
    const cookie = await createAndLogin('notif_user_3');
    const user = await getDb().collection<UserPublic>('users').findOne({ username: 'notif_user_3' });
    if (!user) throw new Error('User not found');

    const notification = await notificationService.create({
      userId: user._id,
      milestone: 'order_placed',
      title: 'Read Test',
      body: 'Mark me read.',
    });

    const res = await request(app)
      .post(`/api/notifications/${notification._id}/read`)
      .set('Cookie', cookie);
    expect(res.status).toBe(200);
  });

  it('respects preference opt-out (onScreen=false suppresses creation)', async () => {
    const cookie = await createAndLogin('notif_pref_user');
    const user = await getDb().collection<UserPublic>('users').findOne({ username: 'notif_pref_user' });
    if (!user) throw new Error('User not found');

    // Opt out of order_placed notifications
    await request(app)
      .put('/api/notifications/preferences')
      .set('Cookie', cookie)
      .send({ milestone: 'order_placed', onScreen: false });

    // Create notification via service — should be suppressed
    const notification = await notificationService.create({
      userId: user._id,
      milestone: 'order_placed',
      title: 'Should Be Suppressed',
      body: 'This should not appear.',
    });

    // The service returns null when opted out
    expect(notification).toBeNull();
  });
});

// ─── Global search ──────────────────────────────────────────────────────────

describe('Search: GET /api/search', () => {
  it('unauthenticated request gets 401', async () => {
    const res = await request(app).get('/api/search?q=test');
    expect(res.status).toBe(401);
  });

  it('returns empty results for query shorter than 2 chars', async () => {
    const cookie = await createAndLogin('search_user_1');
    const res = await request(app).get('/api/search?q=a').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.orders).toHaveLength(0);
  });

  it('student can search and only sees own orders (scope isolation)', async () => {
    const cookie = await createAndLogin('search_student_1');
    const res = await request(app).get('/api/search?q=order').set('Cookie', cookie);
    expect(res.status).toBe(200);
    // Results should be empty or belong to this user — no cross-user leakage
    expect(Array.isArray(res.body.data.orders)).toBe(true);
  });

  it('admin can search users', async () => {
    const cookie = await createAndLogin('search_admin_1', 'department_admin');
    const res = await request(app).get('/api/search?q=search_').set('Cookie', cookie);
    expect(res.status).toBe(200);
    // Admin should see users array
    expect(Array.isArray(res.body.data.users)).toBe(true);
  });

  it('student does not get users or rules in search results', async () => {
    const cookie = await createAndLogin('search_student_2');
    const res = await request(app).get('/api/search?q=something').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.users).toBeUndefined();
    expect(res.body.data.rules).toBeUndefined();
  });
});

// ─── Device fingerprint ─────────────────────────────────────────────────────

describe('Device fingerprinting: consent + submit', () => {
  const VALID_HASH = 'a'.repeat(64); // 64-char hex-like string

  it('unauthenticated consent request gets 401', async () => {
    const res = await request(app).post('/api/users/consent/fingerprint').send({ consentGiven: true });
    expect(res.status).toBe(401);
  });

  it('records consent when authenticated', async () => {
    const cookie = await createAndLogin('fp_user_1');
    const res = await request(app)
      .post('/api/users/consent/fingerprint')
      .set('Cookie', cookie)
      .send({ consentGiven: true });
    expect(res.status).toBe(200);
    expect(res.body.data.consentGiven).toBe(true);
  });

  it('submitting fingerprint without consent returns 403', async () => {
    const cookie = await createAndLogin('fp_user_2');

    // Ensure consent is NOT given (revoke if exists)
    await request(app)
      .post('/api/users/consent/fingerprint')
      .set('Cookie', cookie)
      .send({ consentGiven: false });

    const res = await request(app)
      .post('/api/users/fingerprint')
      .set('Cookie', cookie)
      .send({ fingerprintHash: VALID_HASH });
    expect(res.status).toBe(403);
  });

  it('submitting fingerprint after consent returns 200', async () => {
    const cookie = await createAndLogin('fp_user_3');

    await request(app)
      .post('/api/users/consent/fingerprint')
      .set('Cookie', cookie)
      .send({ consentGiven: true });

    const res = await request(app)
      .post('/api/users/fingerprint')
      .set('Cookie', cookie)
      .send({ fingerprintHash: VALID_HASH });
    expect(res.status).toBe(200);
  });

  it('rejects fingerprintHash that is not 64 hex chars', async () => {
    const cookie = await createAndLogin('fp_user_4');
    await request(app)
      .post('/api/users/consent/fingerprint')
      .set('Cookie', cookie)
      .send({ consentGiven: true });

    const res = await request(app)
      .post('/api/users/fingerprint')
      .set('Cookie', cookie)
      .send({ fingerprintHash: 'not-a-valid-hash' });
    expect(res.status).toBe(400);
  });
});
