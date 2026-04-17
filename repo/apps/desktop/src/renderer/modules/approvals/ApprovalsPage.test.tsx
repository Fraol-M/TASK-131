/**
 * @vitest-environment jsdom
 *
 * Behavior-driven render tests for ApprovalsPage.
 * Renders the component and asserts on visible DOM output.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { act } from 'react-dom/test-utils';
import { useAuthStore } from '../auth/useAuth.js';
import ApprovalsPage from './ApprovalsPage.js';

let container: HTMLDivElement;
const originalFetch = globalThis.fetch;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  useAuthStore.setState({
    user: { id: 'u1', username: 'admin1', role: 'admin', scope: {}, displayName: 'admin1' },
    loading: false,
    error: null,
  });
});

afterEach(() => {
  document.body.removeChild(container);
  globalThis.fetch = originalFetch;
});

function renderPage(fetchResponse: unknown = []) {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ data: fetchResponse }),
  });

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  act(() => {
    createRoot(container).render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <ApprovalsPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
  });
}

describe('ApprovalsPage render behavior', () => {
  it('renders without crashing', () => {
    renderPage([]);
    const text = container.textContent ?? '';
    expect(/approval/i.test(text) || container.children.length > 0).toBe(true);
  });

  it('shows empty state message when API returns []', async () => {
    renderPage([]);
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
    const text = container.textContent ?? '';
    expect(text).toContain('No orders awaiting approval.');
  });

  it('renders order rows when data has items', async () => {
    const order = {
      _id: 'o1',
      orderNumber: 'NO-00000001',
      userId: 'stu1',
      state: 'submitted',
      total: 100,
      currency: 'CNY',
      itemCount: 2,
      createdAt: new Date().toISOString(),
    };
    renderPage([order]);
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
    const text = container.textContent ?? '';
    expect(text).toContain('NO-00000001');
  });

  it('shows Approve and Reject buttons for each order row', async () => {
    const order = {
      _id: 'o1',
      orderNumber: 'NO-00000001',
      userId: 'stu1',
      state: 'submitted',
      total: 100,
      currency: 'CNY',
      itemCount: 2,
      createdAt: new Date().toISOString(),
    };
    renderPage([order]);
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
    const buttons = Array.from(container.querySelectorAll('button'));
    const labels = buttons.map((b) => b.textContent ?? '');
    expect(labels.some((l) => l.toLowerCase().includes('approve'))).toBe(true);
    expect(labels.some((l) => l.toLowerCase().includes('reject'))).toBe(true);
  });
});
