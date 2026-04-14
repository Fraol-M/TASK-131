import { beforeAll, afterAll, beforeEach } from 'vitest';
import { connectDatabase, disconnectDatabase, getDb } from '../src/persistence/mongoClient.js';
import { runIndexes } from '../src/persistence/runIndexes.js';

// Connect once per test suite
beforeAll(async () => {
  await connectDatabase();
  await runIndexes();
});

afterAll(async () => {
  await disconnectDatabase();
});

// Clean all collections before each test for isolation
beforeEach(async () => {
  const db = getDb();
  const collections = await db.listCollections().toArray();
  await Promise.all(collections.map((c) => db.collection(c.name).deleteMany({})));
});
