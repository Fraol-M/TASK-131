/**
 * @vitest-environment jsdom
 *
 * Behavior-driven component tests for RequireAuth.
 * Verifies auth guard redirect and content rendering behavior.
 */
import React from 'react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { act } from 'react-dom/test-utils';
import { useAuthStore } from './useAuth.js';
import { RequireAuth } from './RequireAuth.js';

let container: HTMLDivElement;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
});

afterEach(() => {
  document.body.removeChild(container);
});

describe('RequireAuth render behavior', () => {
  it('shows loading indicator when auth state is loading', () => {
    useAuthStore.setState({ user: null, loading: true, error: null });

    act(() => {
      createRoot(container).render(
        <MemoryRouter initialEntries={['/']}>
          <Routes>
            <Route path="/" element={<RequireAuth />}>
              <Route index element={<div>Protected Content</div>} />
            </Route>
          </Routes>
        </MemoryRouter>,
      );
    });

    expect(container.textContent).toContain('Loading');
    expect(container.textContent).not.toContain('Protected Content');
  });

  it('redirects to /login when user is null and not loading', () => {
    useAuthStore.setState({ user: null, loading: false, error: null });

    act(() => {
      createRoot(container).render(
        <MemoryRouter initialEntries={['/']}>
          <Routes>
            <Route path="/login" element={<div>Login Page</div>} />
            <Route path="/" element={<RequireAuth />}>
              <Route index element={<div>Protected Content</div>} />
            </Route>
          </Routes>
        </MemoryRouter>,
      );
    });

    // Should redirect to login — protected content should NOT render
    expect(container.textContent).toContain('Login Page');
    expect(container.textContent).not.toContain('Protected Content');
  });

  it('renders child routes when user is authenticated', () => {
    useAuthStore.setState({
      user: { id: 'u1', username: 'student1', role: 'student', scope: {}, displayName: 'student1' },
      loading: false,
      error: null,
    });

    act(() => {
      createRoot(container).render(
        <MemoryRouter initialEntries={['/']}>
          <Routes>
            <Route path="/login" element={<div>Login Page</div>} />
            <Route path="/" element={<RequireAuth />}>
              <Route index element={<div>Protected Content</div>} />
            </Route>
          </Routes>
        </MemoryRouter>,
      );
    });

    // Should NOT redirect — protected content should render
    expect(container.textContent).not.toContain('Login Page');
    // NavLayout wraps the Outlet, so "NexusOrder" brand + content should be present
    expect(container.textContent).toContain('NexusOrder');
  });
});
