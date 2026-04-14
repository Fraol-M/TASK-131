import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSetToolTip = vi.fn();
const mockSetContextMenu = vi.fn();
const mockTrayOn = vi.fn();
const mockDestroy = vi.fn();

const mockTrayInstance = {
  setToolTip: mockSetToolTip,
  setContextMenu: mockSetContextMenu,
  on: mockTrayOn,
  destroy: mockDestroy,
};

vi.mock('electron', () => ({
  Tray: vi.fn(() => mockTrayInstance),
  Menu: {
    buildFromTemplate: vi.fn((template) => ({ template })),
  },
  nativeImage: {
    createFromPath: vi.fn(() => ({ isEmpty: () => true })),
    createEmpty: vi.fn(() => ({})),
  },
}));

vi.mock('path', () => ({
  default: { join: (...args: string[]) => args.join('/') },
}));

vi.mock('./windowManager.js', () => ({
  windowManager: {
    openMain: vi.fn(),
    openReconciliation: vi.fn(),
  },
}));

describe('trayManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('initialize creates tray with tooltip and context menu', async () => {
    const { trayManager } = await import('./trayManager.js');
    trayManager.initialize();
    expect(mockSetToolTip).toHaveBeenCalledWith('NexusOrder Desk');
    expect(mockSetContextMenu).toHaveBeenCalled();
  });

  it('initialize registers double-click handler', async () => {
    const { trayManager } = await import('./trayManager.js');
    trayManager.initialize();
    expect(mockTrayOn).toHaveBeenCalledWith('double-click', expect.any(Function));
  });

  it('minimize updates tooltip to indicate background mode', async () => {
    const { trayManager } = await import('./trayManager.js');
    trayManager.initialize();
    mockSetToolTip.mockClear();
    trayManager.minimize();
    expect(mockSetToolTip).toHaveBeenCalledWith('NexusOrder Desk (background)');
  });

  it('restore resets tooltip to normal', async () => {
    const { trayManager } = await import('./trayManager.js');
    trayManager.initialize();
    trayManager.minimize();
    mockSetToolTip.mockClear();
    trayManager.restore();
    expect(mockSetToolTip).toHaveBeenCalledWith('NexusOrder Desk');
  });

  it('destroy cleans up the tray', async () => {
    const { trayManager } = await import('./trayManager.js');
    trayManager.initialize();
    trayManager.destroy();
    expect(mockDestroy).toHaveBeenCalled();
  });
});
