<!-- project-type: desktop -->

# NexusOrder Desk

Offline desktop commerce and fulfillment platform for Windows 11.

**Stack:** Electron + React + TypeScript (desktop) | Express + Node.js + TypeScript (service) | MongoDB | pnpm monorepo

---

## Quick Start

### Prerequisites

- Docker Desktop (Windows) — all build, test, and dev tasks run inside containers
- Windows 11 (for running the packaged Electron desktop app)

> **Note:** No host-level Node.js or pnpm installation is required. All dependency resolution and builds happen inside Docker containers.

### 1. Clone

```bash
git clone <repo-url> && cd repo
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env with your values (defaults work for Docker dev)
```

### 3. Run tests (Docker)

```bash
./run_tests.sh
```

This builds all Docker images and runs the complete test suite inside containers. Exit code 0 = all tests pass.

### 4. Start development environment

```bash
docker compose up -d
```

This starts MongoDB, the Express service, and mongo-express (admin UI) in Docker containers.

To run the Electron desktop shell against the Docker service:
```bash
docker compose exec service npx pnpm --filter @nexusorder/desktop dev
```

### 5. Seed the database (optional)

```bash
docker compose exec service bash scripts/ops/seed-db.sh
```

---

## Demo Credentials

After seeding, the following users are available:

| Role | Username | Password | Capabilities |
|------|----------|----------|-------------|
| Student | `student1` | `Test@1234567` | Browse catalog, manage cart, submit orders |
| Faculty Advisor | `advisor1` | `Test@1234567` | All student + approve/reject orders (scoped) |
| Corporate Mentor | `mentor1` | `Test@1234567` | Confirm delivery for assigned orders |
| Department Admin | `admin1` | `Test@1234567` | Full access: users, reconciliation, backup, rules |

---

## Access Methods

| Interface | URL / Path | Notes |
|-----------|-----------|-------|
| Express API (dev) | `https://127.0.0.1:4433` | Self-signed TLS; localhost only |
| mongo-express (dev) | `http://127.0.0.1:8081` | MongoDB admin UI (Docker dev only) |
| Electron desktop | Launch via MSI installer or `docker compose exec service npx pnpm --filter @nexusorder/desktop dev` | Connects to API on `127.0.0.1:4433` |
| Health check | `GET https://127.0.0.1:4433/api/system/health` | Unauthenticated; returns `{ status: 'healthy' }` |

---

## Verification Runbook

A deterministic sequence to confirm the system is functioning end-to-end after deployment or test environment setup.

### Prerequisites
- Docker containers running (`docker compose up -d`)
- Database seeded (see step 5 above)

### Steps

> All commands use `curl` which is available on Windows 11 natively (via Git Bash, WSL, or PowerShell). Run these inside the Docker service container or from Git Bash on the host.

**Step 1 -- Health check (service is reachable)**
```bash
curl -sk https://127.0.0.1:4433/api/system/health
```
Expected: `{"data":{"status":"healthy"}}`

**Step 2 -- Login as admin (save the session cookie to a file)**
```bash
curl -sk -c cookies.txt https://127.0.0.1:4433/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"admin1\",\"password\":\"Test@1234567\"}"
```
Expected: 200 response with user data. Cookie file `cookies.txt` now contains the session.

**Step 3 -- List catalog items (proves auth + DB read)**
```bash
curl -sk -b cookies.txt https://127.0.0.1:4433/api/catalog
```
Expected: `{"data":[...]}` with catalog items. Note a `catalogItemId` from the response for step 5.

**Step 4 -- Login as student (save to separate cookie file)**
```bash
curl -sk -c stu_cookies.txt https://127.0.0.1:4433/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"student1\",\"password\":\"Test@1234567\"}"
```

**Step 5 -- Add item to cart (use a catalogItemId from step 3)**
```bash
curl -sk -b stu_cookies.txt https://127.0.0.1:4433/api/carts/items \
  -H "Content-Type: application/json" \
  -d "{\"catalogItemId\":\"<ID_FROM_STEP_3>\",\"quantity\":1}"
```
Expected: 201 `{"data":{"message":"Item added to cart"}}`

**Step 6 -- Checkout**
```bash
curl -sk -X POST -b stu_cookies.txt https://127.0.0.1:4433/api/carts/checkout
```
Expected: 201 with order in `"submitted"` state.

**Step 7 -- Run automated tests (full suite)**
```bash
./run_tests.sh
```
Expected: exit code 0.

If all API steps succeed, the backend service is verified.

### Desktop UI Verification

After confirming the API is healthy (steps 1-6 above), verify the Electron desktop application:

**Step 8 -- Launch the desktop app**

```bash
# From the repo root, with Docker service running:
docker compose exec service npx pnpm --filter @nexusorder/desktop dev
```

The Electron window should open. Verify:
- The login screen renders with "NexusOrder Desk" title, username/password fields, and a "Sign In" button.

**Step 9 -- Login via desktop UI**

Enter `student1` / `Test@1234567` and click "Sign In". Verify:
- The app navigates to the Orders page (URL hash changes to `#/orders`).
- The left navigation sidebar is visible with menu items: Orders, Cart, Catalog, Notifications.
- No error message is shown.

**Step 10 -- Auth guard redirect**

Close and relaunch the app (or clear cookies). Attempt to navigate directly to `#/orders`. Verify:
- The app redirects to the login screen (`#/login`) because no session exists.

**Step 11 -- Role-based navigation**

Log in as `admin1` / `Test@1234567`. Verify:
- The sidebar shows additional admin-only menu items: Rules, Audit, Backup/Restore, Updates, Users, Reconciliation.
- These items are hidden when logged in as `student1`.

**Step 12 -- Cart and checkout flow (desktop)**

Log in as `student1`. Navigate to Catalog, click a product to add it to the cart. Navigate to Cart. Verify:
- The cart page shows the added item with name, quantity, and subtotal.
- Press Ctrl+Enter (or click Checkout). Verify the order is created and the page shows "submitted" status.

**Step 13 -- System tray**

Verify the NexusOrder Desk icon appears in the Windows system tray. Right-click it to confirm the context menu appears.

**Step 14 -- Keyboard shortcuts**

While on the Orders page, press Ctrl+K. Verify:
- The global search modal opens.

Press Escape to close, then Alt+2. Verify:
- The app navigates to the Catalog page.

If all desktop steps pass, the full application is verified: backend API, desktop shell rendering, auth guard flow, role-based navigation, cart/checkout lifecycle, tray integration, and keyboard shortcuts.

---

## Monorepo Structure

```
repo/
  apps/
    desktop/          Electron + React + Vite desktop shell
    service/          Express + TypeScript + MongoDB backend
  packages/
    shared-types/     Domain interfaces (Order, Rule, User...)
    shared-validation/ Zod validation schemas
    shared-rbac/       Role permissions + canDo()
    shared-logging/    Structured pino logger
  database/
    mongo-indexes/    MongoDB index definitions
    seed/             Development seed data
  docs/               Technical documentation
  scripts/            Build, dev, operations scripts
  Dockerfile.service  Multi-stage service Docker image
  Dockerfile.test-runner Test runner Docker image
  docker-compose.yml  Dev: MongoDB + service + mongo-express
  docker-compose.test.yml Test: ephemeral MongoDB + test runner
  run_tests.sh        Single command to run all tests in Docker
```

---

## Key Features

- **Full order lifecycle** -- draft -> submitted -> approved -> paid -> allocated -> shipped -> delivered -> closed
- **WeChat Pay offline CSV reconciliation** -- RSA signature verification per row, idempotent re-import
- **Rules engine** -- priority-ordered, conflict detection, cycle detection, simulation
- **Split/merge orders** -- with invoice/tax invariant validation and audit trail
- **After-sales / RMA** -- state machine, blocks auto-close while open
- **AES-256-GCM field encryption** for sensitive data at rest
- **Write-ahead checkpoints** for multi-step critical mutations
- **Backup/restore** with SHA-256 checksum validation
- **Update rollback** -- automatic rollback on startup health check failure
- **Electron multi-window** -- named window registry, system tray, keyboard shortcuts
- **RBAC at every layer** -- service middleware, React navigation, renderer menus

---

## Documentation

| Document | Description |
|----------|-------------|
| [Architecture](docs/architecture.md) | System overview, component diagram |
| [Data Model](docs/data-model.md) | MongoDB collections and schemas |
| [Security Model](docs/security-model.md) | Auth, RBAC, encryption, audit |
| [State Machines](docs/state-machines.md) | Order and after-sales state machines |
| [Rules Engine](docs/rules-engine.md) | Rule evaluation, conflict detection, simulation |
| [Desktop Behavior](docs/desktop-behavior.md) | Windows, tray, IPC, keyboard shortcuts |
| [Backup/Restore](docs/backup-restore.md) | Backup creation, restore, scheduling |
| [Update/Rollback](docs/update-rollback.md) | Update import, apply, rollback |
| [Test Strategy](docs/test-strategy.md) | Test structure, invariants, Docker setup |
| [API Spec](docs/api-spec.md) | All 21 route groups with methods and permissions |
| [Reviewer Traceability](docs/reviewer-traceability.md) | Requirements -> files -> tests |

---

## Building the MSI Installer

> **Development and testing require no manual prerequisites.** Running `docker compose up -d` is the only setup step needed -- all services, including MongoDB, are fully Docker-contained. The `mongod.exe` placement described below is a **build-time step for producing the production MSI installer only** and is never required for development or running tests.

### How the packaged MSI works at runtime

The packaged MSI bundles both the Express service (`serviceManager.ts`) and a MongoDB Community Server binary (`mongoManager.ts`). On launch, Electron starts MongoDB first (data stored in `%APPDATA%\NexusOrder Desk\mongodb\data`), then the Express service. No Docker or pre-installed database is required at runtime.

### Build-time prerequisite: placing `mongod.exe`

Before running the build script below, place `mongod.exe` in `apps/desktop/vendor/mongodb/` so that `electron-builder` can bundle it into the installer (see `electron-builder.yml` `extraResources`). This is a one-time step required **only** when producing the MSI -- it is not needed for development or CI.

Requires a Windows host with a code-signing certificate:

```bash
export CSC_LINK=/path/to/cert.pfx
export CSC_KEY_PASSWORD=<password>
./scripts/build/sign-and-package.sh
# Output: apps/desktop/dist-installer/NexusOrder-Desk-Setup-1.0.0.msi
```
