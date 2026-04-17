# NexusOrder Desk -- Update and Rollback

## Update Flow

**Implementation**: `apps/service/src/updates/`

1. Admin imports update package via `POST /api/updates/import`
2. Update is staged in `builds/` directory
3. Admin applies update via `POST /api/updates/:packageId/apply`
4. `rollbackOrchestrator.promoteUpdate()` archives current build as `previous` and promotes staged build to `current`
5. Service restart required after update

## Rollback

**Implementation**: `apps/service/src/updates/rollbackOrchestrator.ts`

### Automatic Rollback

On startup, `startupHealthCoordinator.check()` verifies the service is healthy. If unhealthy:
1. Desktop main process triggers `POST /api/updates/auto-rollback`
2. `rollbackOrchestrator.rollbackToPrevious()` swaps `current` and `previous` symlinks
3. Records rollback event in `rollback_events` collection
4. App quits for restart

### Manual Rollback

Admin can trigger via `POST /api/updates/rollback`.

### Local Fallback

If the service is unreachable during auto-rollback, the desktop main process performs a direct filesystem symlink swap (`tryLocalFallbackRollback` in `index.ts`).

## API Endpoints

- `POST /api/updates/import` -- import update package (internal key required)
- `POST /api/updates/:packageId/apply` -- apply update (admin + internal key)
- `POST /api/updates/rollback` -- manual rollback (admin + internal key)
- `POST /api/updates/auto-rollback` -- automatic rollback (internal key only)
