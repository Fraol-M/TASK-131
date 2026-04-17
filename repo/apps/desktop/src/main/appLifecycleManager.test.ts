import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockOpenMain = vi.fn();
const mockTrayInit = vi.fn();
const mockTrayMin = vi.fn();
const mockTrayDestroy = vi.fn();
const mockPollerStart = vi.fn();
const mockPollerStop = vi.fn();
const mockIpcRegister = vi.fn();

const appListeners: Record<string, (() => void)[]> = {};
const mockAppOn = vi.fn((event: string, cb: () => void) => {
  (appListeners[event] ??= []).push(cb);
});

vi.mock('electron', () => ({
  app: { on: mockAppOn },
  BrowserWindow: { getAllWindows: vi.fn(() => []) },
}));

vi.mock('./windowManager.js', () => ({ windowManager: { openMain: mockOpenMain } }));
vi.mock('./trayManager.js', () => ({
  trayManager: { initialize: mockTrayInit, minimize: mockTrayMin, destroy: mockTrayDestroy },
}));
vi.mock('./notificationPoller.js', () => ({
  notificationPoller: { start: mockPollerStart, stop: mockPollerStop },
}));
vi.mock('./ipcSecurityRegistrar.js', () => ({
  ipcSecurityRegistrar: { register: mockIpcRegister },
}));

describe('appLifecycleManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(appListeners).forEach((k) => delete appListeners[k]);
    vi.resetModules();
  });

  it('registers IPC, opens main window, initializes tray, starts poller', async () => {
    const { appLifecycleManager } = await import('./appLifecycleManager.js');
    appLifecycleManager.initialize();
    expect(mockIpcRegister).toHaveBeenCalledOnce();
    expect(mockOpenMain).toHaveBeenCalledOnce();
    expect(mockTrayInit).toHaveBeenCalledOnce();
    expect(mockPollerStart).toHaveBeenCalledOnce();
  });

  it('window-all-closed minimizes tray to keep app alive on non-darwin', async () => {
    const { appLifecycleManager } = await import('./appLifecycleManager.js');
    appLifecycleManager.initialize();
    const originalPlatform = process.platform;
    Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
    appListeners['window-all-closed']?.forEach((cb) => cb());
    expect(mockTrayMin).toHaveBeenCalled();
    Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
  });

  it('before-quit stops poller and destroys tray', async () => {
    const { appLifecycleManager } = await import('./appLifecycleManager.js');
    appLifecycleManager.initialize();
    appListeners['before-quit']?.forEach((cb) => cb());
    expect(mockPollerStop).toHaveBeenCalled();
    expect(mockTrayDestroy).toHaveBeenCalled();
  });
});
