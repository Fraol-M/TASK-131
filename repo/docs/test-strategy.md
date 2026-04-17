# NexusOrder Desk -- Test Strategy

## Overview

Testing uses Vitest as the test runner with real MongoDB (no mocking of the database in integration tests).

## Test Layers

### Unit Tests (`apps/service/tests/unit/`)

Pure logic tests without HTTP or database:
- Password validation, failed login tracking
- Order state machine transitions
- Split/merge invariants
- Rule conflict detection
- Crypto utilities (AES-256, field masking)
- Auto-cancel and auto-close job logic

### Integration Tests (`apps/service/tests/integration/`)

Full HTTP stack tests using `supertest` against `createApp()` with real MongoDB:
- Auth lifecycle (login, logout, change-password, lockout)
- RBAC route guards (401/403 assertions per role)
- Order lifecycle (cart, checkout, approval, payment, fulfillment)
- Scope isolation (object-level access control)
- Reconciliation (CSV import with signature verification)
- Backup/restore
- Rules CRUD, activation, simulation
- Update authentication
- Notification delivery

### Frontend Tests (`apps/desktop/src/`)

- `shortcutRegistry.test.ts` -- keyboard shortcut binding
- `menuPermissionMap.test.ts` -- role-based menu visibility
- `windowManager.test.ts` -- window lifecycle
- `trayManager.test.ts` -- system tray behavior

## Test Infrastructure

- **Database**: real MongoDB instance (Docker in CI, ephemeral tmpfs volume)
- **Setup**: `tests/setup.ts` connects DB, runs indexes, clears collections before each test
- **Timeout**: 30 seconds per test
- **Runner**: `./run_tests.sh` orchestrates Docker containers for CI

## Running Tests

```bash
# Full suite in Docker (CI-compatible)
./run_tests.sh

# Host-only (requires local MongoDB)
pnpm -r test
```
