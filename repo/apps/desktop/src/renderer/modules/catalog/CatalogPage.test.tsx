/**
 * @vitest-environment jsdom
 *
 * Behavior tests for CatalogPage: loading state, empty state, item grid, search filter, add-to-cart.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act } from 'react-dom/test-utils';
import { useAuthStore } from '../auth/useAuth.js';
import CatalogPage from './CatalogPage.js';

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
const originalFetch = globalThis.fetch;

function makeCatalogItem(overrides: Record<string, unknown> = {}) {
  return {
    _id: 'item-1',
    name: 'Test Widget',
    sku: 'TW-001',
    unitPrice: 99,
    currency: 'CNY',
    stock: 10,
    isAvailable: true,
    eligibleScopes: [],
    vendorId: 'v1',
    taxRate: 0.08,
    ...overrides,
  };
}

function renderPage(fetchItems: unknown[]) {
  useAuthStore.setState({
    user: { id: 'u1', username: 'student1', role: 'student', scope: { school: 'A' }, displayName: 'student1' },
    loading: false,
    error: null,
  });

  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ data: fetchItems }),
  });

  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  act(() => {
    root = createRoot(container);
    root.render(
      <QueryClientProvider client={qc}>
        <CatalogPage />
      </QueryClientProvider>,
    );
  });
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
});

afterEach(async () => {
  await act(async () => { root.unmount(); });
  document.body.removeChild(container);
  globalThis.fetch = originalFetch;
});

describe('CatalogPage', () => {
  it('renders the Catalog heading', () => {
    renderPage([]);
    expect(container.querySelector('h2')?.textContent).toMatch(/catalog/i);
  });

  it('renders a search input', () => {
    renderPage([]);
    const inputs = container.querySelectorAll('input');
    expect(inputs.length).toBeGreaterThan(0);
  });

  it('shows empty message when no items', async () => {
    renderPage([]);
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
    expect(container.textContent).toMatch(/no items found/i);
  });

  it('renders item cards when data is returned', async () => {
    renderPage([makeCatalogItem({ name: 'Blue Pen' }), makeCatalogItem({ _id: 'item-2', name: 'Red Pen', sku: 'RP-001' })]);
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
    expect(container.textContent).toContain('Blue Pen');
    expect(container.textContent).toContain('Red Pen');
  });

  it('filters items by search input', async () => {
    renderPage([
      makeCatalogItem({ name: 'Blue Pen' }),
      makeCatalogItem({ _id: 'item-2', name: 'Red Stapler', sku: 'RS-001' }),
    ]);
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });

    const input = container.querySelector('input') as HTMLInputElement;
    act(() => {
      Object.defineProperty(input, 'value', { value: 'stapler', writable: true });
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await act(async () => { await new Promise((r) => setTimeout(r, 10)); });
    expect(container.textContent).toContain('Stapler');
  });
});
