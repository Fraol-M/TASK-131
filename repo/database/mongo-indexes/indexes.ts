/**
 * @deprecated This module is a legacy index definition file and is NOT used at runtime.
 * The active index orchestration lives in apps/service/src/persistence/runIndexes.ts
 * and is called during service startup. Do not modify this file — apply index changes
 * to the active module instead. This file is retained only for historical reference
 * and will be removed in a future cleanup pass.
 */
import { Db } from 'mongodb';
import { createModuleLogger } from '@nexusorder/shared-logging';

const log = createModuleLogger('runIndexes');

/** @deprecated Use apps/service/src/persistence/runIndexes.ts instead. */
export async function runIndexes(db: Db): Promise<void> {
  log.info('Creating/verifying MongoDB indexes…');

  // ── users ─────────────────────────────────────────────────────────────────
  await db.collection('users').createIndexes([
    { key: { username: 1 }, unique: true, name: 'users_username_unique' },
    { key: { email: 1 }, unique: true, sparse: true, name: 'users_email_unique' },
    { key: { role: 1 }, name: 'users_role' },
    { key: { 'scope.school': 1, 'scope.major': 1 }, name: 'users_scope' },
  ]);

  // ── sessions ──────────────────────────────────────────────────────────────
  await db.collection('sessions').createIndexes([
    { key: { userId: 1 }, name: 'sessions_userId' },
    { key: { expiresAt: 1 }, expireAfterSeconds: 0, name: 'sessions_ttl' },
  ]);

  // ── failed_logins ─────────────────────────────────────────────────────────
  await db.collection('failed_logins').createIndexes([
    { key: { username: 1 }, name: 'failed_logins_username' },
    // TTL: auto-expire stale lockout records 24h after last attempt
    { key: { lastAttemptAt: 1 }, expireAfterSeconds: 86400, name: 'failed_logins_ttl' },
  ]);

  // ── vendors ───────────────────────────────────────────────────────────────
  await db.collection('vendors').createIndexes([
    { key: { name: 1 }, name: 'vendors_name' },
    { key: { status: 1 }, name: 'vendors_status' },
  ]);

  // ── catalog_items ─────────────────────────────────────────────────────────
  await db.collection('catalog_items').createIndexes([
    { key: { vendorId: 1 }, name: 'catalog_vendorId' },
    { key: { name: 'text', description: 'text' }, name: 'catalog_text_search' },
    { key: { isBlacklisted: 1 }, name: 'catalog_blacklisted' },
    { key: { 'scope.school': 1 }, name: 'catalog_scope_school' },
  ]);

  // ── blacklists ────────────────────────────────────────────────────────────
  await db.collection('blacklists').createIndexes([
    { key: { userId: 1 }, unique: true, name: 'blacklists_userId_unique' },
  ]);

  // ── carts ─────────────────────────────────────────────────────────────────
  await db.collection('carts').createIndexes([
    { key: { userId: 1, status: 1 }, name: 'carts_userId_status' },
  ]);

  // ── orders ────────────────────────────────────────────────────────────────
  await db.collection('orders').createIndexes([
    { key: { userId: 1 }, name: 'orders_userId' },
    { key: { status: 1 }, name: 'orders_status' },
    { key: { 'scope.school': 1, 'scope.major': 1 }, name: 'orders_scope' },
    { key: { autoCancelAt: 1 }, sparse: true, name: 'orders_autoCancelAt' },
    { key: { autoCloseAt: 1 }, sparse: true, name: 'orders_autoCloseAt' },
    { key: { createdAt: -1 }, name: 'orders_createdAt_desc' },
    { key: { version: 1 }, name: 'orders_version' },
  ]);

  // ── payment_intents ───────────────────────────────────────────────────────
  await db.collection('payment_intents').createIndexes([
    { key: { orderId: 1 }, unique: true, name: 'payment_intents_orderId_unique' },
    { key: { status: 1 }, name: 'payment_intents_status' },
  ]);

  // ── payment_reconciliation_imports ────────────────────────────────────────
  await db.collection('payment_reconciliation_imports').createIndexes([
    { key: { importedAt: -1 }, name: 'recon_imports_date_desc' },
    { key: { importedBy: 1 }, name: 'recon_imports_by' },
  ]);

  // ── payment_reconciliation_rows ───────────────────────────────────────────
  await db.collection('payment_reconciliation_rows').createIndexes([
    { key: { paymentIntentId: 1 }, unique: true, name: 'recon_rows_paymentIntentId_unique' },
    { key: { importId: 1 }, name: 'recon_rows_importId' },
    { key: { status: 1 }, name: 'recon_rows_status' },
  ]);

  // ── rmas ──────────────────────────────────────────────────────────────────
  await db.collection('rmas').createIndexes([
    { key: { orderId: 1 }, name: 'rmas_orderId' },
    { key: { afterSalesState: 1 }, name: 'rmas_afterSalesState' },
    { key: { requestedBy: 1 }, name: 'rmas_requestedBy' },
  ]);

  // ── reason_codes ──────────────────────────────────────────────────────────
  await db.collection('reason_codes').createIndexes([
    { key: { code: 1 }, unique: true, name: 'reason_codes_code_unique' },
    { key: { isActive: 1 }, name: 'reason_codes_isActive' },
  ]);

  // ── rules ─────────────────────────────────────────────────────────────────
  await db.collection('rules').createIndexes([
    { key: { priority: 1 }, name: 'rules_priority' },
    { key: { status: 1 }, name: 'rules_status' },
    { key: { 'scope.school': 1 }, name: 'rules_scope' },
  ]);

  // ── rule_versions ─────────────────────────────────────────────────────────
  await db.collection('rule_versions').createIndexes([
    { key: { ruleId: 1, version: 1 }, unique: true, name: 'rule_versions_unique' },
  ]);

  // ── rule_simulations ──────────────────────────────────────────────────────
  await db.collection('rule_simulations').createIndexes([
    { key: { ruleId: 1 }, name: 'simulations_ruleId' },
    { key: { createdAt: -1 }, name: 'simulations_date' },
  ]);

  // ── notifications ─────────────────────────────────────────────────────────
  await db.collection('notifications').createIndexes([
    { key: { userId: 1, readAt: 1 }, name: 'notifications_userId_unread' },
    { key: { createdAt: 1 }, expireAfterSeconds: 90 * 24 * 3600, name: 'notifications_ttl_90d' },
  ]);

  // ── order_audit_events ────────────────────────────────────────────────────
  await db.collection('order_audit_events').createIndexes([
    { key: { entityId: 1 }, name: 'audit_entityId' },
    { key: { userId: 1 }, name: 'audit_userId' },
    { key: { timestamp: -1 }, name: 'audit_timestamp_desc' },
    { key: { action: 1 }, name: 'audit_action' },
  ]);

  // ── backups ───────────────────────────────────────────────────────────────
  await db.collection('backups').createIndexes([
    { key: { createdAt: -1 }, name: 'backups_date_desc' },
    { key: { status: 1 }, name: 'backups_status' },
  ]);

  // ── checkpoint_logs ───────────────────────────────────────────────────────
  await db.collection('checkpoint_logs').createIndexes([
    { key: { status: 1 }, name: 'checkpoints_status' },
    { key: { operationType: 1 }, name: 'checkpoints_opType' },
    { key: { entityId: 1 }, name: 'checkpoints_entityId' },
    { key: { createdAt: 1 }, expireAfterSeconds: 30 * 24 * 3600, name: 'checkpoints_ttl_30d' },
  ]);

  // ── update_packages ───────────────────────────────────────────────────────
  await db.collection('update_packages').createIndexes([
    { key: { status: 1 }, name: 'updates_status' },
    { key: { importedAt: -1 }, name: 'updates_date_desc' },
  ]);

  // ── device_consents ───────────────────────────────────────────────────────
  await db.collection('device_consents').createIndexes([
    { key: { userId: 1 }, unique: true, name: 'device_consents_userId_unique' },
    { key: { consentGiven: 1 }, name: 'device_consents_given' },
  ]);

  // ── device_fingerprints ───────────────────────────────────────────────────
  await db.collection('device_fingerprints').createIndexes([
    { key: { userId: 1 }, unique: true, name: 'device_fp_userId_unique' },
    { key: { registeredAt: -1 }, name: 'device_fp_date_desc' },
  ]);

  // ── search (text index on orders for global search) ───────────────────────
  await db.collection('orders').createIndex(
    { 'items.name': 'text' },
    { name: 'orders_items_text_search' },
  );

  log.info('All indexes created/verified');
}
