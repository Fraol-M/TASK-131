import { create } from 'zustand';
import type { UserRole, UserScope } from '@nexusorder/shared-types';

const SERVICE_BASE = `https://127.0.0.1:${import.meta.env['VITE_SERVICE_PORT'] ?? '4433'}`;

interface AuthUser {
  id: string;
  username: string;
  role: UserRole;
  scope: UserScope;
  displayName: string;
}

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  checkSession: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: false,
  error: null,

  async login(username, password) {
    set({ loading: true, error: null });
    try {
      const resp = await fetch(`${SERVICE_BASE}/api/auth/login`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (!resp.ok) {
        const body = await resp.json().catch(() => ({ message: 'Login failed' }));
        set({ loading: false, error: (body as { message?: string }).message ?? 'Login failed' });
        return false;
      }

      const body = await resp.json() as { data: { user: AuthUser } };
      set({ user: body.data.user, loading: false, error: null });
      return true;
    } catch {
      set({ loading: false, error: 'Network error — service unreachable' });
      return false;
    }
  },

  async logout() {
    await fetch(`${SERVICE_BASE}/api/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    }).catch(() => null);
    set({ user: null });
  },

  async checkSession() {
    try {
      const resp = await fetch(`${SERVICE_BASE}/api/auth/session`, {
        credentials: 'include',
      });
      if (resp.ok) {
        const body = await resp.json() as { data: { user: AuthUser } };
        set({ user: body.data.user });
      } else {
        set({ user: null });
      }
    } catch {
      set({ user: null });
    }
  },
}));
