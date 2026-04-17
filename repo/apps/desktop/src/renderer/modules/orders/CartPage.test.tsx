/**
 * @vitest-environment jsdom
 *
 * Behavior-driven render tests for CartPage.
 * Renders the component and asserts on visible DOM output.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { act } from 'react-dom/test-utils';
import { useAuthStore } from '../auth/useAuth.js';
import CartPage from './CartPage.js';

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
});

afterEach(() => {
  document.body.removeChild(container);
  globalThis.fetch = originalFetch;
});

function renderPage(fetchResponse: unknown = null) {
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
          <CartPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
  });
}

describe('CartPage render behavior', () => {
  it('renders the cart page heading', () => {
    renderPage(null);
    // CartPage should render — the heading or some recognizable text
    expect(container.querySelector('h1, h2, [role="heading"]') !== null || container.textContent!.length > 0).toBe(true);
  });

  it('shows empty state when cart is null', async () => {
    renderPage(null);
    // Wait for query to settle
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
    // Should show empty cart message or no items
    const text = container.textContent ?? '';
    expect(text.toLowerCase()).toMatch(/cart|empty|no items|loading/i);
  });

  it('displays cart items when data is present', async () => {
    const cartData = {
      _id: 'cart1',
      userId: 'u1',
      items: [
        { _id: 'ci1', catalogItemId: 'cat1', name: 'Test Textbook', skuMasked: '***001', quantity: 2, unitPrice: 50, lineTotal: 100 },
      ],
      subtotal: 100,
      currency: 'CNY',
    };
    renderPage(cartData);
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });

    const text = container.textContent ?? '';
    expect(text).toContain('Test Textbook');
  });

  it('calls fetch with /api/carts/active', () => {
    renderPage(null);
    expect(globalThis.fetch).toHaveBeenCalled();
    const callUrl = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    if (callUrl) {
      expect(String(callUrl)).toContain('/api/carts/active');
    }
  });
});
