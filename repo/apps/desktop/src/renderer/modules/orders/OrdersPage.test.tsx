/**
 * @vitest-environment jsdom
 *
 * Behavior-driven render tests for OrdersPage.
 * Renders the component and asserts on visible DOM output.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { act } from 'react-dom/test-utils';
import { useAuthStore } from '../auth/useAuth.js';
import OrdersPage from './OrdersPage.js';

let container: HTMLDivElement;
const originalFetch = globalThis.fetch;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  useAuthStore.setState({
    user: { id: 'u1', username: 'student1', role: 'student', scope: {}, displayName: 'student1' },
    loading: false,
    error: null,
  });
  (window as any).nexusorder = { invoke: vi.fn() };
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
          <OrdersPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
  });
}

describe('OrdersPage render behavior', () => {
  it('renders without crashing', () => {
    renderPage([]);
    expect(container.children.length > 0 || (container.textContent ?? '').length > 0).toBe(true);
  });

  it('shows order rows when data is present', async () => {
    const order = {
      _id: 'o1',
      orderNumber: 'NO-00000001',
      userId: 'u1',
      state: 'submitted',
      total: 150,
      currency: 'CNY',
      itemCount: 3,
      createdAt: new Date().toISOString(),
    };
    renderPage([order]);
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
    const text = container.textContent ?? '';
    expect(text).toContain('NO-00000001');
  });

  it('shows order state badge for each order', async () => {
    const order = {
      _id: 'o1',
      orderNumber: 'NO-00000001',
      userId: 'u1',
      state: 'submitted',
      total: 150,
      currency: 'CNY',
      itemCount: 3,
      createdAt: new Date().toISOString(),
    };
    renderPage([order]);
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
    const text = container.textContent ?? '';
    expect(text).toContain('submitted');
  });

  it('context menu is not shown initially (ctx is null)', () => {
    renderPage([]);
    // OrderContextMenu should not be in the DOM when ctx is null
    const text = container.textContent ?? '';
    // The context menu items (Split, Merge, RMA) should not be visible
    expect(text).not.toContain('Split Order');
    expect(text).not.toContain('Create RMA');
  });
});
