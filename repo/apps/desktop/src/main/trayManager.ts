import { Tray, Menu, nativeImage } from 'electron';
import path from 'path';
import { windowManager } from './windowManager.js';

let tray: Tray | null = null;

export const trayManager = {
  initialize(): void {
    const iconPath = path.join(__dirname, '../../assets/icons/tray.png');
    const icon = nativeImage.createFromPath(iconPath);
    tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon);

    tray.setToolTip('NexusOrder Desk');
    this._buildMenu();

    tray.on('double-click', () => {
      windowManager.openMain();
    });
  },

  minimize(): void {
    // App stays alive in tray — background jobs continue
    tray?.setToolTip('NexusOrder Desk (background)');
  },

  restore(): void {
    windowManager.openMain();
    tray?.setToolTip('NexusOrder Desk');
  },

  destroy(): void {
    tray?.destroy();
    tray = null;
  },

  _buildMenu(): void {
    const contextMenu = Menu.buildFromTemplate([
      { label: 'Open Dashboard', click: () => windowManager.openMain() },
      { label: 'Open Reconciliation', click: () => windowManager.openReconciliation() },
      { label: 'Update Manager', click: () => windowManager.openMain() },
      { type: 'separator' },
      { label: 'Quit', role: 'quit' },
    ]);
    tray?.setContextMenu(contextMenu);
  },
};
