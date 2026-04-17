/**
 * @vitest-environment jsdom
 *
 * Behavior tests for OrderDetailWindow: missing ID guard, order heading, items table, totals, notes.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act } from 'react-dom/test-utils';
import OrderDetailWindow from './OrderDetailWindow.js';

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
const originalFetch = globalThis.fetch;

function makeOrder(overrides: Record<string, unknown> = {}) {
  return {
    _id: 'ord-123',
    orderNumber: 'ORD-2024-001',
    userId: 'user-42',
    state: 'approved',
    subtotal: 100.00,
    taxTotal: 8.00,
    total: 108.00,
    currency: 'CNY',
    items: [
      { _id: 'item-1', name: 'Blue Pen', skuMasked: 'WM-***-XYZ', quantity: 2, unitPrice: 50.00, lineTotal: 100.00 },
    ],
    notes: [],
    createdAt: new Date('2024-01-15').toISOString(),
    ...overrides,
  };
}

function renderWindow() {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ data: makeOrder() }),
  });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  act(() => {
    root = createRoot(container);
    root.render(
      <QueryClientProvider client={qc}>
        <OrderDetailWindow />
      </QueryClientProvider>,
    );
  });
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  window.location.hash = '';
});

afterEach(async () => {
  await act(async () => { root.unmount(); });
  document.body.removeChild(container);
  globalThis.fetch = originalFetch;
  window.location.hash = '';
});

describe('OrderDetailWindow', () => {
  it('shows "No order ID provided" when hash has no id param', () => {
    window.location.hash = '';
    renderWindow();
    expect(container.textContent).toMatch(/no order id provided/i);
  });

  it('renders order number as heading', async () => {
    window.location.hash = '#/order-detail?id=ord-123';
    renderWindow();
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
    expect(container.querySelector('h2')?.textContent).toContain('ORD-2024-001');
  });

  it('renders order state', async () => {
    window.location.hash = '#/order-detail?id=ord-123';
    renderWindow();
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
    expect(container.textContent).toContain('approved');
  });

  it('renders items table with expected column headers', async () => {
    window.location.hash = '#/order-detail?id=ord-123';
    renderWindow();
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
    const text = container.textContent ?? '';
    expect(text).toContain('Name');
    expect(text).toContain('SKU');
    expect(text).toContain('Qty');
    expect(text).toContain('Unit Price');
    expect(text).toContain('Line Total');
  });

  it('renders item row data', async () => {
    window.location.hash = '#/order-detail?id=ord-123';
    renderWindow();
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
    const text = container.textContent ?? '';
    expect(text).toContain('Blue Pen');
    expect(text).toContain('WM-***-XYZ');
  });

  it('renders order totals', async () => {
    window.location.hash = '#/order-detail?id=ord-123';
    renderWindow();
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
    const text = container.textContent ?? '';
    expect(text).toMatch(/subtotal/i);
    expect(text).toMatch(/tax/i);
    expect(text).toMatch(/total/i);
    expect(text).toContain('108.00');
  });

  it('renders notes when present', async () => {
    window.location.hash = '#/order-detail?id=ord-123';
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: makeOrder({
          notes: [{ _id: 'note-1', content: 'Approved by faculty advisor.', authorId: 'u1', createdAt: new Date().toISOString() }],
        }),
      }),
    });
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    act(() => {
      root = createRoot(container);
      root.render(
        <QueryClientProvider client={qc}>
          <OrderDetailWindow />
        </QueryClientProvider>,
      );
    });
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
    expect(container.textContent).toContain('Approved by faculty advisor.');
  });
});
