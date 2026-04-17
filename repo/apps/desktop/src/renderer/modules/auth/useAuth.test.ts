/**
 * Unit tests for the useAuthStore Zustand store.
 * Tests the store's state management logic without DOM rendering.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useAuthStore } from './useAuth.js';

// Mock fetch globally
const originalFetch = globalThis.fetch;

beforeEach(() => {
  // Reset store state between tests
  useAuthStore.setState({ user: null, loading: false, error: null });
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('useAuthStore', () => {
  describe('initial state', () => {
    it('starts with no user, not loading, no error', () => {
      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  describe('login', () => {
    it('sets user on successful login', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            user: { id: 'u1', username: 'student1', role: 'student', scope: {}, displayName: 'student1' },
          },
        }),
      });

      const result = await useAuthStore.getState().login('student1', 'pass');
      expect(result).toBe(true);

      const state = useAuthStore.getState();
      expect(state.user).not.toBeNull();
      expect(state.user!.username).toBe('student1');
      expect(state.user!.role).toBe('student');
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('sets error on failed login (401)', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ message: 'Invalid credentials' }),
      });

      const result = await useAuthStore.getState().login('bad', 'wrong');
      expect(result).toBe(false);

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.error).toBe('Invalid credentials');
      expect(state.loading).toBe(false);
    });

    it('sets network error when fetch throws', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network failure'));

      const result = await useAuthStore.getState().login('user', 'pass');
      expect(result).toBe(false);

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.error).toContain('Network error');
    });
  });

  describe('logout', () => {
    it('clears user on logout', async () => {
      // Set user first
      useAuthStore.setState({
        user: { id: 'u1', username: 'test', role: 'student', scope: {}, displayName: 'test' },
      });

      globalThis.fetch = vi.fn().mockResolvedValue({ ok: true });

      await useAuthStore.getState().logout();

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
    });
  });

  describe('checkSession', () => {
    it('restores user from valid session', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            user: { id: 'u2', username: 'admin1', role: 'department_admin', scope: {}, displayName: 'admin1' },
          },
        }),
      });

      await useAuthStore.getState().checkSession();

      const state = useAuthStore.getState();
      expect(state.user).not.toBeNull();
      expect(state.user!.role).toBe('department_admin');
    });

    it('clears user when session is invalid', async () => {
      useAuthStore.setState({
        user: { id: 'u1', username: 'test', role: 'student', scope: {}, displayName: 'test' },
      });

      globalThis.fetch = vi.fn().mockResolvedValue({ ok: false });

      await useAuthStore.getState().checkSession();

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
    });
  });
});
