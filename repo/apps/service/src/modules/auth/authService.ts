import { getDb } from '../../persistence/mongoClient.js';
import type { User, LoginResponse } from '@nexusorder/shared-types';
import { verifyPassword, hashPassword } from './passwordHashService.js';
import { assertValidPassword } from './passwordValidator.js';
import {
  isLockedOut,
  getLockoutExpiry,
  recordFailedAttempt,
  clearFailedAttempts,
} from './failedLoginTracker.js';
import { sessionService } from './sessionService.js';
import { emitAuditEvent } from '../../audit/auditLog.js';
import { AppError } from '../../middleware/errorHandler.js';

const COLLECTION = 'users';

export const authService = {
  async login(username: string, password: string): Promise<LoginResponse & { token: string }> {
    // Check lockout before any DB user lookup (timing-safe order)
    const locked = await isLockedOut(username);
    if (locked) {
      const expiry = await getLockoutExpiry(username);
      await emitAuditEvent({ action: 'auth.lockout', meta: { username, lockedUntil: expiry } });
      throw new AppError(
        'AUTH_LOCKED',
        `Account locked. Try again after ${expiry?.toISOString() ?? 'lockout expiry'}.`,
        403,
      );
    }

    const user = await getDb().collection<User>(COLLECTION).findOne({ username });

    if (!user || !(await verifyPassword(user.passwordHash, password))) {
      await recordFailedAttempt(username);
      await emitAuditEvent({ action: 'auth.login_failed', meta: { username } });
      throw new AppError('AUTH_FAILED', 'Invalid username or password', 401);
    }

    await clearFailedAttempts(username);
    const { sessionId, token, expiresAt } = await sessionService.createSession({
      userId: user._id,
      role: user.role,
      scope: user.scope,
    });

    await emitAuditEvent({ action: 'auth.login', userId: user._id, meta: { role: user.role } });

    return { sessionId, userId: user._id, username: user.username, role: user.role, scope: user.scope, expiresAt, token };
  },

  async logout(sessionId: string, userId: string): Promise<void> {
    await sessionService.revokeSession(sessionId);
    await emitAuditEvent({ action: 'auth.logout', userId });
  },

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    assertValidPassword(newPassword);

    const user = await getDb().collection<User>(COLLECTION).findOne({ _id: userId } as { _id: string });
    if (!user) throw new AppError('NOT_FOUND', 'User not found', 404);

    if (!(await verifyPassword(user.passwordHash, currentPassword))) {
      throw new AppError('AUTH_FAILED', 'Current password is incorrect', 401);
    }

    const newHash = await hashPassword(newPassword);
    await getDb().collection<User>(COLLECTION).updateOne(
      { _id: userId } as { _id: string },
      { $set: { passwordHash: newHash, updatedAt: new Date() } },
    );
    await sessionService.revokeAllUserSessions(userId);
    await emitAuditEvent({ action: 'auth.password_changed', userId });
  },
};
