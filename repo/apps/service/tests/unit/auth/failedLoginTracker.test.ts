import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock mongoClient before importing the module under test
const mockFindOne = vi.fn();
const mockInsertOne = vi.fn();
const mockUpdateOne = vi.fn();
const mockDeleteOne = vi.fn();

vi.mock('../../../src/persistence/mongoClient.js', () => ({
  getDb: () => ({
    collection: () => ({
      findOne: mockFindOne,
      insertOne: mockInsertOne,
      updateOne: mockUpdateOne,
      deleteOne: mockDeleteOne,
    }),
  }),
}));

import { recordFailedAttempt, isLockedOut, clearFailedAttempts } from '../../../src/modules/auth/failedLoginTracker.js';

describe('failedLoginTracker (unit — mocked DB)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('recordFailedAttempt', () => {
    it('inserts a new record when none exists', async () => {
      mockFindOne.mockResolvedValue(null);
      mockInsertOne.mockResolvedValue({});
      await recordFailedAttempt('newuser');
      expect(mockInsertOne).toHaveBeenCalledWith(
        expect.objectContaining({ username: 'newuser', attempts: 1 }),
      );
    });

    it('increments attempts on an existing record', async () => {
      mockFindOne.mockResolvedValue({ username: 'user1', attempts: 2, lastAttemptAt: new Date() });
      mockUpdateOne.mockResolvedValue({});
      await recordFailedAttempt('user1');
      expect(mockUpdateOne).toHaveBeenCalledWith(
        { username: 'user1' },
        { $set: expect.objectContaining({ attempts: 3 }) },
      );
    });

    it('sets lockedUntil when attempts reach the threshold', async () => {
      mockFindOne.mockResolvedValue({ username: 'user1', attempts: 4, lastAttemptAt: new Date() });
      mockUpdateOne.mockResolvedValue({});
      await recordFailedAttempt('user1');
      expect(mockUpdateOne).toHaveBeenCalledWith(
        { username: 'user1' },
        { $set: expect.objectContaining({ lockedUntil: expect.any(Date) }) },
      );
    });
  });

  describe('isLockedOut', () => {
    it('returns false when no record exists', async () => {
      mockFindOne.mockResolvedValue(null);
      expect(await isLockedOut('nobody')).toBe(false);
    });

    it('returns false when record has no lockedUntil', async () => {
      mockFindOne.mockResolvedValue({ username: 'user1', attempts: 2 });
      expect(await isLockedOut('user1')).toBe(false);
    });

    it('returns true when lockedUntil is in the future', async () => {
      const future = new Date(Date.now() + 60_000);
      mockFindOne.mockResolvedValue({ lockedUntil: future });
      expect(await isLockedOut('user1')).toBe(true);
    });

    it('returns false when lockedUntil is in the past', async () => {
      const past = new Date(Date.now() - 1000);
      mockFindOne.mockResolvedValue({ lockedUntil: past });
      expect(await isLockedOut('user1')).toBe(false);
    });
  });

  describe('clearFailedAttempts', () => {
    it('deletes the record for the given username', async () => {
      mockDeleteOne.mockResolvedValue({ deletedCount: 1 });
      await clearFailedAttempts('user1');
      expect(mockDeleteOne).toHaveBeenCalledWith({ username: 'user1' });
    });
  });
});
