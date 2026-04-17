# NexusOrder Desk -- Desktop Behavior

## Window Management

**Implementation**: `apps/desktop/src/main/windowManager.ts`

Named window registry supporting multiple concurrent windows. Each window type (main, order detail, reconciliation) is tracked by name to prevent duplicates.

## System Tray

**Implementation**: `apps/desktop/src/main/trayManager.ts`

Persistent system tray icon with context menu for quick access to common actions.

## Keyboard Shortcuts

**Implementation**: `apps/desktop/src/renderer/shortcuts/shortcutRegistry.ts`

| Shortcut | Action |
|----------|--------|
| Ctrl+K | Open global search |
| Alt+1 | Navigate to Orders |
| Alt+2 | Navigate to Catalog |
| Ctrl+Enter | Submit checkout |

## IPC Security

**Implementation**: `apps/desktop/src/preload/secureBridge.ts`

Only whitelisted IPC channel names can be invoked via `contextBridge.exposeInMainWorld`. The preload script enforces a strict allowlist.

## Notification Polling

**Implementation**: `apps/desktop/src/main/notificationPoller.ts`

Polls the service API for new notifications and displays native Windows notifications.

## Startup Sequence

1. Start MongoDB (`mongoManager.start()`)
2. Start Express service (`serviceManager.start()`)
3. Pin TLS certificate fingerprint
4. Run recovery bootstrap scan
5. Health check (fail-closed: rollback if unhealthy)
6. Register update IPC handlers
7. Launch app windows
