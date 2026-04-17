/**
 * @vitest-environment jsdom
 *
 * Behavior tests for UpdateManagerPage: browse, import, apply flows
 * and disabled-state enforcement.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import UpdateManagerPage from './UpdateManagerPage.js';

let mockInvoke: ReturnType<typeof vi.fn>;
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

beforeEach(() => {
  mockInvoke = vi.fn();
  vi.stubGlobal('window', {
    ...globalThis.window,
    nexusorder: { invoke: mockInvoke },
  });
  container = document.createElement('div');
  document.body.appendChild(container);
  act(() => {
    root = createRoot(container);
    root.render(<UpdateManagerPage />);
  });
});

afterEach(async () => {
  await act(async () => { root.unmount(); });
  document.body.removeChild(container);
  vi.unstubAllGlobals();
});

describe('UpdateManagerPage', () => {
  it('renders heading and description', () => {
    expect(container.querySelector('h2')?.textContent).toMatch(/update manager/i);
  });

  it('shows Browse, Import, and Apply buttons', () => {
    const buttons = Array.from(container.querySelectorAll('button')).map((b) => b.textContent ?? '');
    expect(buttons.some((t) => /browse/i.test(t))).toBe(true);
    expect(buttons.some((t) => /import/i.test(t))).toBe(true);
    expect(buttons.some((t) => /apply/i.test(t))).toBe(true);
  });

  it('Import and Apply buttons are disabled before a file is selected', () => {
    const buttons = Array.from(container.querySelectorAll('button'));
    const importBtn = buttons.find((b) => /^import$/i.test(b.textContent ?? ''));
    const applyBtn = buttons.find((b) => /^apply$/i.test(b.textContent ?? ''));
    expect(importBtn?.disabled).toBe(true);
    expect(applyBtn?.disabled).toBe(true);
  });

  it('Browse calls dialog:open-file and populates the file path input', async () => {
    mockInvoke.mockResolvedValueOnce('/tmp/update.zip');
    const browseBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      /browse/i.test(b.textContent ?? ''),
    )!;

    await act(async () => {
      browseBtn.click();
    });

    expect(mockInvoke).toHaveBeenCalledWith('dialog:open-file', expect.any(Array));
    const input = container.querySelector('input') as HTMLInputElement;
    expect(input.value).toBe('/tmp/update.zip');
  });

  it('Import calls update:import and shows staged message on success', async () => {
    // First browse to select a file
    mockInvoke.mockResolvedValueOnce('/tmp/update.zip');
    const browseBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      /browse/i.test(b.textContent ?? ''),
    )!;
    await act(async () => { browseBtn.click(); });

    // Then import
    mockInvoke.mockResolvedValueOnce({
      success: true,
      data: { data: { packageId: 'pkg-abc-123' } },
    });
    const importBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      /^import/i.test(b.textContent ?? ''),
    )!;
    await act(async () => { importBtn.click(); });

    expect(mockInvoke).toHaveBeenCalledWith('update:import', '/tmp/update.zip');
    expect(container.textContent).toMatch(/pkg-abc-123/);
  });

  it('shows error message when import fails', async () => {
    mockInvoke.mockResolvedValueOnce('/tmp/bad.zip');
    const browseBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      /browse/i.test(b.textContent ?? ''),
    )!;
    await act(async () => { browseBtn.click(); });

    mockInvoke.mockResolvedValueOnce({ success: false, error: 'Invalid package signature' });
    const importBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      /^import/i.test(b.textContent ?? ''),
    )!;
    await act(async () => { importBtn.click(); });

    expect(container.textContent).toMatch(/invalid package signature/i);
  });

  it('Apply calls update:apply with packageId and shows restart message on success', async () => {
    // Browse → select file
    mockInvoke.mockResolvedValueOnce('/tmp/update.zip');
    await act(async () => {
      Array.from(container.querySelectorAll('button'))
        .find((b) => /browse/i.test(b.textContent ?? ''))!
        .click();
    });

    // Import → stage package
    mockInvoke.mockResolvedValueOnce({
      success: true,
      data: { data: { packageId: 'pkg-xyz-999' } },
    });
    await act(async () => {
      Array.from(container.querySelectorAll('button'))
        .find((b) => /^import/i.test(b.textContent ?? ''))!
        .click();
    });

    // Apply
    mockInvoke.mockResolvedValueOnce({ success: true });
    await act(async () => {
      Array.from(container.querySelectorAll('button'))
        .find((b) => /^apply/i.test(b.textContent ?? ''))!
        .click();
    });

    expect(mockInvoke).toHaveBeenCalledWith('update:apply', 'pkg-xyz-999');
    expect(container.textContent).toMatch(/restart/i);
  });

  it('shows error message when apply fails', async () => {
    mockInvoke.mockResolvedValueOnce('/tmp/update.zip');
    await act(async () => {
      Array.from(container.querySelectorAll('button'))
        .find((b) => /browse/i.test(b.textContent ?? ''))!
        .click();
    });

    mockInvoke.mockResolvedValueOnce({
      success: true,
      data: { data: { packageId: 'pkg-fail-001' } },
    });
    await act(async () => {
      Array.from(container.querySelectorAll('button'))
        .find((b) => /^import/i.test(b.textContent ?? ''))!
        .click();
    });

    mockInvoke.mockResolvedValueOnce({ success: false, error: 'Rollback triggered' });
    await act(async () => {
      Array.from(container.querySelectorAll('button'))
        .find((b) => /^apply/i.test(b.textContent ?? ''))!
        .click();
    });

    expect(container.textContent).toMatch(/rollback triggered/i);
  });
});
