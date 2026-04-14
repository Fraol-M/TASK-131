import { getDb } from './mongoClient.js';
import { createModuleLogger } from '@nexusorder/shared-logging';

const log = createModuleLogger('indexes');

/**
 * Define and ensure all MongoDB collection indexes.
 * Called at startup before the service accepts traffic.
 * All indexes are idempotent (createIndex with same definition is a no-op).
 */
export async function runIndexes(): Promise<void> {
  const db = getDb();
  log.info('Creating/verifying MongoDB indexes');

  await Promise.all([
    // ─── users ──────────────────────────────────────────────────────────────
    db.collection('users').createIndex({ username: 1 }, { unique: true }),
    db.collection('users').createIndex({ role: 1 }),
    db.collection('users').createIndex({ isBlacklisted: 1 }),

    // ─── sessions ───────────────────────────────────────────────────────────
    db.collection('sessions').createIndex({ userId: 1 }),
    db.collection('sessions').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),

    // ─── failed_logins ──────────────────────────────────────────────────────
    db.collection('failed_logins').createIndex({ username: 1 }, { unique: true }),
    // TTL index: MongoDB auto-deletes lockout records once lockedUntil is in the past.
    // expireAfterSeconds:0 means the document is deleted at the lockedUntil timestamp.
    // This matches the security-model.md claim and removes the need for manual cleanup.
    db.collection('failed_logins').createIndex({ lockedUntil: 1 }, { expireAfterSeconds: 0 }),

    // ─── vendors / catalog ──────────────────────────────────────────────────
    db.collection('catalog_items').createIndex({ vendorId: 1 }),
    db.collection('catalog_items').createIndex({ sku: 1 }, { unique: true }),
    db.collection('catalog_items').createIndex({ isAvailable: 1 }),
    db.collection('catalog_items').createIndex({ name: 'text', description: 'text' }),

    // ─── carts ──────────────────────────────────────────────────────────────
    db.collection('carts').createIndex({ userId: 1 }, { unique: true }),
    db.collection('cart_items').createIndex({ cartId: 1 }),

    // ─── orders ─────────────────────────────────────────────────────────────
    db.collection('orders').createIndex({ orderNumber: 1 }, { unique: true }),
    db.collection('orders').createIndex({ orderNumber: 'text' }),
    db.collection('orders').createIndex({ userId: 1, createdAt: -1 }),
    db.collection('orders').createIndex({ state: 1, autoCancelAt: 1 }),
    db.collection('orders').createIndex({ state: 1, autoCloseAt: 1 }),
    db.collection('orders').createIndex({ 'userScopeSnapshot.school': 1 }),
    db.collection('orders').createIndex({ 'userScopeSnapshot.major': 1 }),
    db.collection('orders').createIndex({ 'userScopeSnapshot.cohort': 1 }),
    db.collection('order_items').createIndex({ orderId: 1 }),
    db.collection('order_notes').createIndex({ orderId: 1, createdAt: -1 }),
    db.collection('order_tags').createIndex({ orderId: 1 }),
    db.collection('order_tags').createIndex({ tag: 1 }),
    db.collection('order_audit_events').createIndex({ targetId: 1, occurredAt: -1 }),
    db.collection('order_audit_events').createIndex({ userId: 1, occurredAt: -1 }),
    db.collection('order_audit_events').createIndex({ action: 1, occurredAt: -1 }),

    // ─── approvals / shipping ───────────────────────────────────────────────
    db.collection('order_approvals').createIndex({ orderId: 1 }),
    db.collection('shipping_records').createIndex({ orderId: 1 }),

    // ─── payment_intents ────────────────────────────────────────────────────
    db.collection('payment_intents').createIndex({ paymentIntentId: 1 }, { unique: true }),
    db.collection('payment_intents').createIndex({ orderId: 1 }),
    db.collection('payment_intents').createIndex({ status: 1 }),
    db.collection('payment_intents').createIndex({ duplicateFlag: 1 }),

    // ─── reconciliation ─────────────────────────────────────────────────────
    db.collection('payment_reconciliation_imports').createIndex({ importedAt: -1 }),
    db.collection('payment_reconciliation_rows').createIndex({ paymentIntentId: 1 }, { unique: true }),
    db.collection('payment_reconciliation_rows').createIndex({ importId: 1 }),
    db.collection('payment_reconciliation_rows').createIndex({ isDuplicate: 1 }),

    // ─── refunds / RMAs / reason codes ──────────────────────────────────────
    db.collection('refunds').createIndex({ orderId: 1 }),
    db.collection('refunds').createIndex({ paymentIntentId: 1 }),
    db.collection('rmas').createIndex({ orderId: 1 }),
    db.collection('rmas').createIndex({ requestedBy: 1 }),
    db.collection('after_sales_events').createIndex({ orderId: 1, occurredAt: -1 }),
    db.collection('reason_codes').createIndex({ code: 1 }, { unique: true }),
    db.collection('reason_codes').createIndex({ isActive: 1 }),

    // ─── rules ──────────────────────────────────────────────────────────────
    db.collection('rules').createIndex({ status: 1, priority: 1, updatedAt: -1 }),
    db.collection('rules').createIndex({ name: 'text' }),
    db.collection('rule_versions').createIndex({ ruleId: 1, version: -1 }),
    db.collection('rule_simulations').createIndex({ ruleId: 1, simulatedAt: -1 }),
    db.collection('rule_conflicts').createIndex({ ruleIds: 1 }),

    // ─── notifications ──────────────────────────────────────────────────────
    db.collection('notifications').createIndex({ userId: 1, createdAt: -1 }),
    db.collection('notifications').createIndex({ userId: 1, isRead: 1 }),
    db.collection('notification_preferences').createIndex({ userId: 1, milestone: 1 }, { unique: true }),

    // ─── backups / restore / updates ────────────────────────────────────────
    db.collection('backups').createIndex({ status: 1, startedAt: -1 }),
    db.collection('restore_events').createIndex({ backupId: 1 }),
    db.collection('update_packages').createIndex({ version: 1 }),
    db.collection('rollback_events').createIndex({ updatePackageId: 1 }),

    // ─── recovery ───────────────────────────────────────────────────────────
    db.collection('checkpoint_logs').createIndex({ status: 1, createdAt: -1 }),
    db.collection('checkpoint_logs').createIndex({ operationId: 1 }, { unique: true }),

    // ─── system settings ────────────────────────────────────────────────────
    db.collection('system_settings').createIndex({ updatedAt: -1 }),
  ]);

  log.info('MongoDB indexes ready');
}
