/**
 * @vitest-environment jsdom
 *
 * Behavior tests for SimulationRunner: disabled state, successful run, error paths.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act } from 'react-dom/test-utils';
import { SimulationRunner } from './SimulationRunner.js';

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
const originalFetch = globalThis.fetch;

function renderRunner() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  act(() => {
    root = createRoot(container);
    root.render(
      <QueryClientProvider client={qc}>
        <SimulationRunner />
      </QueryClientProvider>,
    );
  });
}

function typeRuleId(value: string) {
  const input = container.querySelector('input') as HTMLInputElement;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  act(() => {
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
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

describe('SimulationRunner', () => {
  it('shows Run Simulation button disabled when rule ID is empty', () => {
    renderRunner();
    const btn = Array.from(container.querySelectorAll('button')).find((b) =>
      /run simulation/i.test(b.textContent ?? ''),
    );
    expect(btn).toBeDefined();
    expect(btn?.disabled).toBe(true);
  });

  it('shows simulation results after successful run', async () => {
    globalThis.fetch = vi.fn((url: string) => {
      if ((url as string).includes('/api/orders')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ data: [{ _id: 'ord-1' }, { _id: 'ord-2' }] }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({
          data: { totalOrders: 2, matchedCount: 1, matchedOrderIds: ['ord-2'] },
        }),
      });
    }) as typeof fetch;

    renderRunner();
    typeRuleId('rule-xyz');

    const btn = Array.from(container.querySelectorAll('button')).find((b) =>
      /run simulation/i.test(b.textContent ?? ''),
    )!;
    await act(async () => { btn.click(); });
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });

    expect(container.textContent).toMatch(/orders tested/i);
    expect(container.textContent).toMatch(/match rate/i);
    expect(container.textContent).toContain('2');
  });

  it('shows error when no orders exist in the system', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    }) as typeof fetch;

    renderRunner();
    typeRuleId('rule-xyz');

    const btn = Array.from(container.querySelectorAll('button')).find((b) =>
      /run simulation/i.test(b.textContent ?? ''),
    )!;
    await act(async () => { btn.click(); });
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });

    expect(container.textContent).toMatch(/no orders found/i);
  });

  it('shows error when orders fetch fails', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false }) as typeof fetch;

    renderRunner();
    typeRuleId('rule-xyz');

    const btn = Array.from(container.querySelectorAll('button')).find((b) =>
      /run simulation/i.test(b.textContent ?? ''),
    )!;
    await act(async () => { btn.click(); });
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });

    expect(container.textContent).toMatch(/failed to load orders/i);
  });
});
