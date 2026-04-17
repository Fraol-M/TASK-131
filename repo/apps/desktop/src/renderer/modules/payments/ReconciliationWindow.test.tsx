/**
 * @vitest-environment jsdom
 *
 * Behavior tests for ReconciliationWindow: heading, Import CSV, table columns,
 * Repair button only on exception rows, repair panel flow.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act } from 'react-dom/test-utils';
import ReconciliationWindow from './ReconciliationWindow.js';

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
const originalFetch = globalThis.fetch;

function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    _id: 'row-1',
    paymentIntentId: 'pi_abc123',
    amount: 299.99,
    currency: 'CNY',
    status: 'matched',
    importedAt: new Date('2024-03-01').toISOString(),
    ...overrides,
  };
}

function renderWindow(rows: unknown[] = []) {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ data: rows }),
  });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  act(() => {
    root = createRoot(container);
    root.render(
      <QueryClientProvider client={qc}>
        <ReconciliationWindow />
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

describe('ReconciliationWindow', () => {
  it('renders WeChat Pay Reconciliation heading', () => {
    renderWindow();
    expect(container.querySelector('h2')?.textContent).toMatch(/wechat pay reconciliation/i);
  });

  it('shows Import CSV label', () => {
    renderWindow();
    const labels = Array.from(container.querySelectorAll('label'));
    expect(labels.some((l) => /import csv/i.test(l.textContent ?? ''))).toBe(true);
  });

  it('renders table column headers after load', async () => {
    renderWindow([]);
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
    const text = container.textContent ?? '';
    expect(text).toContain('Payment Intent ID');
    expect(text).toContain('Amount');
    expect(text).toContain('Status');
    expect(text).toContain('Imported');
    expect(text).toContain('Actions');
  });

  it('renders row data including paymentIntentId and amount', async () => {
    renderWindow([makeRow({ paymentIntentId: 'pi_xyz999', amount: 150.5, currency: 'CNY' })]);
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
    expect(container.textContent).toContain('pi_xyz999');
    expect(container.textContent).toContain('150.50');
  });

  it('does not show Repair button for non-exception rows', async () => {
    renderWindow([makeRow({ status: 'matched' }), makeRow({ _id: 'row-2', paymentIntentId: 'pi_dup', status: 'duplicate' })]);
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
    const repairBtns = Array.from(container.querySelectorAll('button')).filter((b) =>
      /^repair$/i.test(b.textContent ?? ''),
    );
    expect(repairBtns).toHaveLength(0);
  });

  it('shows Repair button only for exception rows', async () => {
    renderWindow([
      makeRow({ status: 'matched' }),
      makeRow({ _id: 'row-2', paymentIntentId: 'pi_exc', status: 'exception' }),
    ]);
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
    const repairBtns = Array.from(container.querySelectorAll('button')).filter((b) =>
      /^repair$/i.test(b.textContent ?? ''),
    );
    expect(repairBtns).toHaveLength(1);
  });

  it('clicking Repair opens the repair panel with textarea and Submit Repair button', async () => {
    renderWindow([makeRow({ _id: 'row-exc', paymentIntentId: 'pi_exc', status: 'exception' })]);
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });

    const repairBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      /^repair$/i.test(b.textContent ?? ''),
    )!;
    act(() => { repairBtn.click(); });

    expect(container.querySelector('textarea')).not.toBeNull();
    const submitBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      /submit repair/i.test(b.textContent ?? ''),
    );
    expect(submitBtn).toBeDefined();
  });

  it('Submit Repair button is disabled when note is empty', async () => {
    renderWindow([makeRow({ _id: 'row-exc', paymentIntentId: 'pi_exc', status: 'exception' })]);
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });

    act(() => {
      Array.from(container.querySelectorAll('button'))
        .find((b) => /^repair$/i.test(b.textContent ?? ''))!
        .click();
    });

    const submitBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      /submit repair/i.test(b.textContent ?? ''),
    )!;
    expect(submitBtn.disabled).toBe(true);
  });

  it('Cancel in repair panel closes the panel', async () => {
    renderWindow([makeRow({ _id: 'row-exc', paymentIntentId: 'pi_exc', status: 'exception' })]);
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });

    act(() => {
      Array.from(container.querySelectorAll('button'))
        .find((b) => /^repair$/i.test(b.textContent ?? ''))!
        .click();
    });

    expect(container.querySelector('textarea')).not.toBeNull();

    act(() => {
      Array.from(container.querySelectorAll('button'))
        .find((b) => /^cancel$/i.test(b.textContent ?? ''))!
        .click();
    });

    expect(container.querySelector('textarea')).toBeNull();
  });
});
