/**
 * @vitest-environment jsdom
 *
 * Behavior-driven component tests for LoginPage.
 * Renders the component in a DOM environment and asserts on visible output.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { act } from 'react-dom/test-utils';
import { useAuthStore } from './useAuth.js';
import LoginPage from './LoginPage.js';

let container: HTMLDivElement;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  useAuthStore.setState({ user: null, loading: false, error: null });
});

afterEach(() => {
  document.body.removeChild(container);
});

function renderInRouter(ui: React.ReactElement) {
  act(() => {
    createRoot(container).render(
      <MemoryRouter initialEntries={['/login']}>{ui}</MemoryRouter>,
    );
  });
}

describe('LoginPage render behavior', () => {
  it('renders the login form with title, inputs, and button', () => {
    renderInRouter(<LoginPage />);

    expect(container.textContent).toContain('NexusOrder Desk');
    expect(container.textContent).toContain('Sign in to your account');

    const inputs = container.querySelectorAll('input');
    expect(inputs.length).toBeGreaterThanOrEqual(2);

    const usernameInput = container.querySelector('input[autocomplete="username"]');
    expect(usernameInput).not.toBeNull();

    const passwordInput = container.querySelector('input[type="password"]');
    expect(passwordInput).not.toBeNull();

    const button = container.querySelector('button[type="submit"]');
    expect(button).not.toBeNull();
    expect(button!.textContent).toContain('Sign In');
  });

  it('shows "Signing in..." when loading', () => {
    useAuthStore.setState({ loading: true });
    renderInRouter(<LoginPage />);

    const button = container.querySelector('button[type="submit"]');
    expect(button!.textContent).toContain('Signing in');
    expect((button as HTMLButtonElement).disabled).toBe(true);
  });

  it('button is not disabled when not loading', () => {
    renderInRouter(<LoginPage />);

    const button = container.querySelector('button[type="submit"]') as HTMLButtonElement;
    expect(button.disabled).toBe(false);
  });
});
