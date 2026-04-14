import { randomUUID } from 'crypto';
import { getDb } from '../../persistence/mongoClient.js';
import type { User, UserPublic } from '@nexusorder/shared-types';
import { hashPassword } from '../auth/passwordHashService.js';
import { ConflictError, NotFoundError } from '../../middleware/errorHandler.js';

export const usersService = {
  async listUsers(): Promise<UserPublic[]> {
    const users = await getDb()
      .collection<User>('users')
      .find({}, { projection: { passwordHash: 0 } })
      .toArray();
    return users as unknown as UserPublic[];
  },

  async createUser(params: {
    username: string;
    password: string;
    role: User['role'];
    scope: User['scope'];
  }): Promise<UserPublic> {
    const existing = await getDb().collection<User>('users').findOne({ username: params.username });
    if (existing) throw new ConflictError(`Username '${params.username}' is already taken`);

    const passwordHash = await hashPassword(params.password);
    const now = new Date();
    const user: User & { _id: string } = {
      _id: randomUUID(),
      username: params.username,
      passwordHash,
      role: params.role,
      scope: params.scope,
      isBlacklisted: false,
      deviceFingerprintConsent: false,
      createdAt: now,
      updatedAt: now,
    };

    await getDb().collection<User>('users').insertOne(user);
    const { passwordHash: _, ...publicUser } = user;
    return publicUser as UserPublic;
  },

  async addToBlacklist(userId: string, reason: string, addedBy: string): Promise<void> {
    const result = await getDb()
      .collection<User>('users')
      .updateOne(
        { _id: userId } as { _id: string },
        { $set: { isBlacklisted: true, blacklistReason: reason, updatedAt: new Date() } },
      );
    if (result.matchedCount === 0) throw new NotFoundError('User');
  },

  async removeFromBlacklist(userId: string, removedBy: string): Promise<void> {
    const result = await getDb()
      .collection<User>('users')
      .updateOne(
        { _id: userId } as { _id: string },
        { $set: { isBlacklisted: false, blacklistReason: undefined, updatedAt: new Date() } },
      );
    if (result.matchedCount === 0) throw new NotFoundError('User');
  },

  async isBlacklisted(userId: string): Promise<boolean> {
    const user = await getDb().collection<User>('users').findOne({ _id: userId } as { _id: string });
    return user?.isBlacklisted ?? false;
  },
};
