import { app, BrowserWindow } from 'electron';
import { windowManager } from './windowManager.js';
import { trayManager } from './trayManager.js';
import { ipcSecurityRegistrar } from './ipcSecurityRegistrar.js';
import { notificationPoller } from './notificationPoller.js';

export const appLifecycleManager = {
  initialize(): void {
    ipcSecurityRegistrar.register();

    // 'ready' has already fired before initialize() is called (called from app.whenReady()),
    // so we call these directly instead of attaching another 'ready' listener.
    windowManager.openMain();
    trayManager.initialize();
    notificationPoller.start();

    app.on('window-all-closed', () => {
      // On Windows, keep the app alive in tray when all windows are closed
      if (process.platform !== 'darwin') {
        trayManager.minimize();
      }
    });

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        windowManager.openMain();
      }
    });

    app.on('before-quit', () => {
      notificationPoller.stop();
      trayManager.destroy();
    });
  },
};
