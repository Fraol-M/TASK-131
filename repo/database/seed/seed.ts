/**
 * Development seed — populates MongoDB with:
 * - 4 roles (student, faculty_advisor, corporate_mentor, department_admin)
 * - 1 user per role (password: Test@1234567)
 * - 2 vendors
 * - 8 catalog items (1 blacklisted)
 * - 1 active rule
 *
 * Run: ts-node database/seed/seed.ts
 * Or:  MONGODB_URI=mongodb://localhost:27017 pnpm ts-node database/seed/seed.ts
 */

import { MongoClient } from 'mongodb';
import argon2 from 'argon2';

const MONGODB_URI = process.env['MONGODB_URI'] ?? 'mongodb://localhost:27017';
const DB_NAME = process.env['MONGODB_DB_NAME'] ?? 'nexusorder';
const PASSWORD = 'Test@1234567';

async function seed(): Promise<void> {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db(DB_NAME);

  console.log(`Seeding ${DB_NAME}…`);

  // Drop existing seed collections (dev only)
  for (const col of ['users', 'vendors', 'catalog_items', 'rules', 'reason_codes']) {
    await db.collection(col).deleteMany({});
  }

  const now = new Date();
  const passwordHash = await argon2.hash(PASSWORD, { type: argon2.argon2id });

  // ── Users ────────────────────────────────────────────────────────────────
  const users = [
    {
      username: 'student1',
      passwordHash,
      role: 'student',
      scope: { school: 'Engineering', major: 'Computer Science', class: '2025' },
      isBlacklisted: false,
      deviceFingerprintConsent: false,
      createdAt: now,
      updatedAt: now,
    },
    {
      username: 'advisor1',
      passwordHash,
      role: 'faculty_advisor',
      scope: { school: 'Engineering' },
      isBlacklisted: false,
      deviceFingerprintConsent: false,
      createdAt: now,
      updatedAt: now,
    },
    {
      username: 'mentor1',
      passwordHash,
      role: 'corporate_mentor',
      scope: { school: 'Engineering', major: 'Computer Science' },
      isBlacklisted: false,
      deviceFingerprintConsent: false,
      createdAt: now,
      updatedAt: now,
    },
    {
      username: 'admin1',
      passwordHash,
      role: 'department_admin',
      scope: {},
      isBlacklisted: false,
      deviceFingerprintConsent: false,
      createdAt: now,
      updatedAt: now,
    },
  ];
  await db.collection('users').insertMany(users);
  console.log(`  ✓ ${users.length} users`);

  // ── Vendors ───────────────────────────────────────────────────────────────
  const vendors = [
    { name: 'TechSupply Co.', contactEmail: 'vendor@techsupply.local', isActive: true, createdAt: now, updatedAt: now },
    { name: 'EduMaterials Ltd.', contactEmail: 'vendor@edumaterials.local', isActive: true, createdAt: now, updatedAt: now },
  ];
  const vendorResult = await db.collection('vendors').insertMany(vendors);
  const [v1Id, v2Id] = Object.values(vendorResult.insertedIds);
  console.log(`  ✓ ${vendors.length} vendors`);

  // ── Catalog Items ─────────────────────────────────────────────────────────
  const catalogItems = [
    { name: 'Laptop Stand', description: 'Adjustable aluminum stand', unitPrice: 29.99, currency: 'CNY', taxRate: 0.08, stock: 10, vendorId: v1Id.toHexString(), sku: 'TS-001', isAvailable: true, eligibleScopes: [], createdAt: now, updatedAt: now },
    { name: 'USB-C Hub', description: '7-port USB-C hub', unitPrice: 49.99, currency: 'CNY', taxRate: 0.08, stock: 10, vendorId: v1Id.toHexString(), sku: 'TS-002', isAvailable: true, eligibleScopes: [], createdAt: now, updatedAt: now },
    { name: 'Mechanical Keyboard', description: 'TKL brown switches', unitPrice: 89.99, currency: 'CNY', taxRate: 0.08, stock: 10, vendorId: v1Id.toHexString(), sku: 'TS-003', isAvailable: true, eligibleScopes: [], createdAt: now, updatedAt: now },
    { name: 'Wireless Mouse', description: 'Ergonomic 2.4GHz mouse', unitPrice: 39.99, currency: 'CNY', taxRate: 0.08, stock: 10, vendorId: v1Id.toHexString(), sku: 'TS-004', isAvailable: true, eligibleScopes: [], createdAt: now, updatedAt: now },
    { name: 'Textbook: Algorithms', description: 'Introduction to Algorithms, 4th ed.', unitPrice: 79.00, currency: 'CNY', taxRate: 0.08, stock: 10, vendorId: v2Id.toHexString(), sku: 'EM-001', isAvailable: true, eligibleScopes: [], createdAt: now, updatedAt: now },
    { name: 'Lab Notebook', description: 'Hardcover lab notebook, 200 pages', unitPrice: 8.99, currency: 'CNY', taxRate: 0.08, stock: 50, vendorId: v2Id.toHexString(), sku: 'EM-002', isAvailable: true, eligibleScopes: [], createdAt: now, updatedAt: now },
    { name: 'Safety Goggles', description: 'ANSI Z87.1 certified', unitPrice: 12.50, currency: 'CNY', taxRate: 0.08, stock: 20, vendorId: v2Id.toHexString(), sku: 'EM-003', isAvailable: true, eligibleScopes: [], createdAt: now, updatedAt: now },
    { name: 'RESTRICTED ITEM', description: 'Not available for student ordering', unitPrice: 999.00, currency: 'CNY', taxRate: 0.08, stock: 0, vendorId: v1Id.toHexString(), sku: 'TS-999', isAvailable: false, eligibleScopes: [], createdAt: now, updatedAt: now },
  ];
  await db.collection('catalog_items').insertMany(catalogItems);
  console.log(`  ✓ ${catalogItems.length} catalog items (1 unavailable)`);

  // ── Active Rule ───────────────────────────────────────────────────────────
  const rule = {
    name: 'Block high-value orders from new students',
    priority: 100,
    scope: { school: 'Engineering' },
    conditions: {
      logic: 'and',
      conditions: [
        { field: 'order.total', operator: 'gt', value: 500 },
        { field: 'user.role', operator: 'eq', value: 'student' },
      ],
    },
    actions: [
      { type: 'flag_for_review', parameters: { reason: 'High-value order from student' } },
    ],
    status: 'active',
    version: 1,
    createdBy: 'seed',
    updatedBy: 'seed',
    createdAt: now,
    updatedAt: now,
  };
  await db.collection('rules').insertOne(rule);
  console.log('  ✓ 1 rule');

  // ── Reason Codes ──────────────────────────────────────────────────────────
  const reasonCodes = [
    { _id: 'rc-defective', code: 'DEFECTIVE_PRODUCT', label: 'Product arrived defective or damaged', applicableTo: ['return', 'refund', 'exchange'], isActive: true, createdBy: 'seed', createdAt: now, updatedAt: now },
    { _id: 'rc-wrong-item', code: 'WRONG_ITEM', label: 'Wrong item received', applicableTo: ['return', 'exchange'], isActive: true, createdBy: 'seed', createdAt: now, updatedAt: now },
    { _id: 'rc-not-needed', code: 'NO_LONGER_NEEDED', label: 'Item no longer required', applicableTo: ['return', 'refund'], isActive: true, createdBy: 'seed', createdAt: now, updatedAt: now },
    { _id: 'rc-duplicate', code: 'DUPLICATE_ORDER', label: 'Duplicate order submitted in error', applicableTo: ['return', 'refund'], isActive: true, createdBy: 'seed', createdAt: now, updatedAt: now },
  ];
  // Drop existing before re-seeding
  await db.collection('reason_codes').deleteMany({});
  await db.collection('reason_codes').insertMany(reasonCodes);
  console.log(`  ✓ ${reasonCodes.length} reason codes`);

  await client.close();
  console.log('\nSeed complete.');
  console.log('Credentials: username=(student1|advisor1|mentor1|admin1), password=Test@1234567');
}

seed().catch((err) => { console.error(err); process.exit(1); });
