/**
 * @vitest-environment jsdom
 *
 * Behavior-driven render tests for NotificationsPage.
 * Renders the component and asserts on visible DOM output.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { act } from 'react-dom/test-utils';
import NotificationsPage from './NotificationsPage.js';

let container: HTMLDivElement;
const originalFetch = globalThis.fetch;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
});

afterEach(() => {
  document.body.removeChild(container);
  globalThis.fetch = originalFetch;
});

describe('NotificationsPage render behavior', () => {
  it('renders and shows loading or empty state', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    });

    act(() => {
      createRoot(container).render(
        <MemoryRouter><NotificationsPage /></MemoryRouter>,
      );
    });

    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });

    const text = container.textContent ?? '';
    // Should contain some notification-related heading or empty state
    expect(text.length).toBeGreaterThan(0);
  });

  it('renders notification items when data is returned', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { _id: 'n1', title: 'Order Placed', body: 'Your order NO-00000001 has been submitted.', milestone: 'order_placed', read: false, createdAt: '2026-04-10T12:00:00Z' },
          { _id: 'n2', title: 'Payment Confirmed', body: 'Payment received.', milestone: 'order_paid', read: true, createdAt: '2026-04-11T12:00:00Z' },
        ],
      }),
    });

    act(() => {
      createRoot(container).render(
        <MemoryRouter><NotificationsPage /></MemoryRouter>,
      );
    });

    await act(async () => { await new Promise((r) => setTimeout(r, 100)); });

    const text = container.textContent ?? '';
    expect(text).toContain('Order Placed');
    expect(text).toContain('Payment Confirmed');
  });

  it('fetches from /api/notifications endpoint', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    });

    act(() => {
      createRoot(container).render(
        <MemoryRouter><NotificationsPage /></MemoryRouter>,
      );
    });

    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });

    expect(globalThis.fetch).toHaveBeenCalled();
    const callUrl = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(String(callUrl)).toContain('/api/notifications');
  });
});
