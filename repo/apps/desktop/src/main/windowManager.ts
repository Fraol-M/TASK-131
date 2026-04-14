import { BrowserWindow } from 'electron';
import path from 'path';

type WindowName = 'main' | 'orderDetail' | 'reconciliation' | 'rulesEditor' | 'auditViewer';

// Named window registry — prevents duplicate windows and ensures explicit cleanup
const windows = new Map<WindowName, BrowserWindow>();

const RENDERER_URL = process.env['VITE_DEV_SERVER_URL'] ?? `file://${path.join(__dirname, '../../renderer/index.html')}`;

function createWindow(name: WindowName, options: Electron.BrowserWindowConstructorOptions & { route?: string }): BrowserWindow {
  if (windows.has(name)) {
    windows.get(name)!.focus();
    return windows.get(name)!;
  }

  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1280,
    minHeight: 720,
    show: false,
    webPreferences: {
      nodeIntegration: false,      // security: never enable node in renderer
      contextIsolation: true,       // security: required
      preload: path.join(__dirname, '../preload/secureBridge.js'),
      sandbox: true,
    },
    ...options,
  });

  win.loadURL(options.route ? `${RENDERER_URL}#${options.route}` : RENDERER_URL).catch(console.error);

  win.once('ready-to-show', () => win.show());

  win.on('closed', () => {
    windows.delete(name);
  });

  windows.set(name, win);
  return win;
}

export const windowManager = {
  openMain(): BrowserWindow {
    return createWindow('main', { route: '/' });
  },

  openOrderDetail(orderId: string): BrowserWindow {
    return createWindow('orderDetail', { width: 900, height: 700, route: `/order-detail?id=${orderId}` });
  },

  openReconciliation(): BrowserWindow {
    return createWindow('reconciliation', { width: 1100, height: 750, route: '/reconciliation' });
  },

  openRulesEditor(): BrowserWindow {
    return createWindow('rulesEditor', { width: 1200, height: 800, route: '/rules' });
  },

  openAuditViewer(): BrowserWindow {
    return createWindow('auditViewer', { width: 1100, height: 750, route: '/audit' });
  },

  closeAll(): void {
    for (const [, win] of windows) {
      win.close();
    }
    windows.clear();
  },

  get(name: WindowName): BrowserWindow | undefined {
    return windows.get(name);
  },
};
