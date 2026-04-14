import { MongoClient, Db } from 'mongodb';
import { config } from '../config/index.js';
import { createModuleLogger } from '@nexusorder/shared-logging';

const log = createModuleLogger('mongoClient');

let client: MongoClient | null = null;
let db: Db | null = null;

export async function connectDatabase(): Promise<Db> {
  if (db) return db;

  // Log host/dbName only — never log the full URI as it may contain credentials
  const safeUri = config.mongodb.uri.replace(/\/\/[^@]*@/, '//***@');
  log.info({ uri: safeUri }, 'Connecting to MongoDB');
  client = new MongoClient(config.mongodb.uri, {
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 10000,
  });

  await client.connect();
  db = client.db(config.mongodb.dbName);
  log.info({ dbName: config.mongodb.dbName }, 'MongoDB connected');
  return db;
}

export function getDb(): Db {
  if (!db) throw new Error('Database not initialized — call connectDatabase() first');
  return db;
}

export async function disconnectDatabase(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    db = null;
    log.info('MongoDB disconnected');
  }
}
