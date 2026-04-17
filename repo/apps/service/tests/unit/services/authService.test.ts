/**
 * Unit tests for authService business logic.
 * Tests the service's validation and flow decisions without full HTTP stack.
 * Uses the real DB (integration-style) but calls service methods directly.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { getDb } from '../../../src/persistence/mongoClient.js';
import { authService } from '../../../src/modules/auth/authService.js';
import { usersService } from '../../../src/modules/users/usersService.js';

describe('authService', () => {
  describe('login', () => {
    it('returns session data on valid credentials', async () => {
      await usersService.createUser({
        username: 'auth_svc_valid', password: 'TestPass1!@#', role: 'student', scope: {},
      });

      const result = await authService.login('auth_svc_valid', 'TestPass1!@#');
      expect(result.username).toBe('auth_svc_valid');
      expect(result.role).toBe('student');
      expect(result.token).toBeDefined();
      expect(result.sessionId).toBeDefined();
      expect(result.expiresAt).toBeInstanceOf(Date);
    });

    it('throws AUTH_FAILED on wrong password', async () => {
      await usersService.createUser({
        username: 'auth_svc_wrong', password: 'TestPass1!@#', role: 'student', scope: {},
      });

      await expect(authService.login('auth_svc_wrong', 'WrongPass999!'))
        .rejects.toThrow('Invalid username or password');
    });

    it('throws AUTH_FAILED on non-existent user', async () => {
      await expect(authService.login('no_such_user_xyz', 'TestPass1!@#'))
        .rejects.toThrow('Invalid username or password');
    });
  });

  describe('changePassword', () => {
    it('changes password successfully when current password is correct', async () => {
      const user = await usersService.createUser({
        username: 'auth_svc_chpw', password: 'TestPass1!@#', role: 'student', scope: {},
      });

      await authService.changePassword(user._id, 'TestPass1!@#', 'NewPass2!@#$');

      // Old password should fail
      await expect(authService.login('auth_svc_chpw', 'TestPass1!@#'))
        .rejects.toThrow();

      // New password should work
      const result = await authService.login('auth_svc_chpw', 'NewPass2!@#$');
      expect(result.username).toBe('auth_svc_chpw');
    });

    it('rejects change when current password is wrong', async () => {
      const user = await usersService.createUser({
        username: 'auth_svc_chpw_bad', password: 'TestPass1!@#', role: 'student', scope: {},
      });

      await expect(authService.changePassword(user._id, 'WrongCurrent!', 'NewPass2!@#$'))
        .rejects.toThrow('Current password is incorrect');
    });

    it('rejects weak new password', async () => {
      const user = await usersService.createUser({
        username: 'auth_svc_chpw_weak', password: 'TestPass1!@#', role: 'student', scope: {},
      });

      await expect(authService.changePassword(user._id, 'TestPass1!@#', 'short'))
        .rejects.toThrow();
    });
  });

  describe('logout', () => {
    it('revokes the session', async () => {
      await usersService.createUser({
        username: 'auth_svc_logout', password: 'TestPass1!@#', role: 'student', scope: {},
      });

      const loginResult = await authService.login('auth_svc_logout', 'TestPass1!@#');
      await authService.logout(loginResult.sessionId, loginResult.userId);

      // Session should be revoked in DB
      const session = await getDb().collection('sessions')
        .findOne({ _id: loginResult.sessionId } as { _id: string });
      expect(session).toBeNull();
    });
  });
});
