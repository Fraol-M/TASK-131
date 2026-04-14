import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFocus = vi.fn();
const mockLoadURL = vi.fn().mockResolvedValue(undefined);
const mockShow = vi.fn();
const mockClose = vi.fn();
const mockOn = vi.fn();
const mockOnce = vi.fn((event: string, cb: () => void) => {
  if (event === 'ready-to-show') cb();
});

const mockBrowserWindowInstance = {
  focus: mockFocus,
  loadURL: mockLoadURL,
  show: mockShow,
  close: mockClose,
  on: mockOn,
  once: mockOnce,
};

vi.mock('electron', () => ({
  BrowserWindow: vi.fn(() => mockBrowserWindowInstance),
}));

vi.mock('path', () => ({
  default: { join: (...args: string[]) => args.join('/') },
}));

describe('windowManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('openMain creates a window and loads the root route', async () => {
    const { windowManager } = await import('./windowManager.js');
    const win = windowManager.openMain();
    expect(win).toBeDefined();
    expect(mockLoadURL).toHaveBeenCalledTimes(1);
    expect(mockLoadURL.mock.calls[0]![0]).toContain('#/');
  });

  it('openMain returns existing window on second call (no duplicate)', async () => {
    const { windowManager } = await import('./windowManager.js');
    const win1 = windowManager.openMain();
    const win2 = windowManager.openMain();
    expect(win1).toBe(win2);
    expect(mockFocus).toHaveBeenCalled();
  });

  it('openOrderDetail passes orderId in route hash', async () => {
    const { windowManager } = await import('./windowManager.js');
    windowManager.openOrderDetail('ord-123');
    expect(mockLoadURL.mock.calls[0]![0]).toContain('id=ord-123');
  });

  it('openReconciliation loads reconciliation route', async () => {
    const { windowManager } = await import('./windowManager.js');
    windowManager.openReconciliation();
    expect(mockLoadURL.mock.calls[0]![0]).toContain('#/reconciliation');
  });

  it('get returns undefined for unregistered window name', async () => {
    const { windowManager } = await import('./windowManager.js');
    expect(windowManager.get('auditViewer')).toBeUndefined();
  });

  it('closeAll closes all open windows', async () => {
    const { windowManager } = await import('./windowManager.js');
    windowManager.openMain();
    windowManager.closeAll();
    expect(mockClose).toHaveBeenCalled();
  });
});
