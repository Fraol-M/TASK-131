# NexusOrder Desk

Offline desktop commerce and fulfillment platform for Windows 11.

**Stack:** Electron + React + TypeScript (desktop) | Express + Node.js + TypeScript (service) | MongoDB | pnpm monorepo

---

## Quick Start

### Prerequisites

- Docker Desktop (Windows)
- Node.js 20+ and pnpm (`npm i -g pnpm`)
- Windows 11 (for Electron desktop)

### 1. Clone and install

```bash
git clone <repo-url> && cd repo
pnpm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env with your values
```

### 3. Run tests (Docker)

```bash
./run_tests.sh
```

This builds all Docker images and runs the complete test suite inside containers. Exit code 0 = all tests pass.

### 4. Start development environment

```bash
./scripts/dev/start-dev.sh
```

Or manually:
```bash
docker compose up -d          # MongoDB + Express service (development only)
pnpm --filter @nexusorder/desktop dev   # Electron desktop (Windows host)
```

> **Production (MSI):** The packaged MSI bundles both the Express service (`serviceManager.ts`) and a MongoDB Community Server binary (`mongoManager.ts`). On launch, Electron starts MongoDB first (data stored in `%APPDATA%\NexusOrder Desk\mongodb\data`), then the Express service. No Docker or pre-installed database is required at runtime — Docker is only used during development and CI. Before building the MSI, place `mongod.exe` in `apps/desktop/vendor/mongodb/` (see `electron-builder.yml` extraResources).

### 5. Seed the database (optional)

```bash
./scripts/ops/seed-db.sh
# Creates 4 users: student1, advisor1, mentor1, admin1
# Password for all: Test@1234567
```

---

## Monorepo Structure

```
repo/
  apps/
    desktop/          Electron + React + Vite desktop shell
    service/          Express + TypeScript + MongoDB backend
  packages/
    shared-types/     Domain interfaces (Order, Rule, User…)
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

## User Roles

| Role | Username (dev) | Capabilities |
|------|---------------|-------------|
| Student | `student1` | Browse catalog, manage cart, submit orders |
| Faculty Advisor | `advisor1` | All student + approve/reject orders (scoped) |
| Corporate Mentor | `mentor1` | Confirm delivery for assigned orders |
| Department Admin | `admin1` | Full access: users, reconciliation, backup, rules |

---

## Key Features

- **Full order lifecycle** — draft → submitted → approved → paid → allocated → shipped → delivered → closed
- **WeChat Pay offline CSV reconciliation** — RSA signature verification per row, idempotent re-import
- **Rules engine** — priority-ordered, conflict detection, cycle detection, simulation
- **Split/merge orders** — with invoice/tax invariant validation and audit trail
- **After-sales / RMA** — state machine, blocks auto-close while open
- **AES-256-GCM field encryption** for sensitive data at rest
- **Write-ahead checkpoints** for multi-step critical mutations
- **Backup/restore** with SHA-256 checksum validation
- **Update rollback** — automatic rollback on startup health check failure
- **Electron multi-window** — named window registry, system tray, keyboard shortcuts
- **RBAC at every layer** — service middleware, React navigation, renderer menus

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
| [Reviewer Traceability](docs/reviewer-traceability.md) | Requirements → files → tests |

---

## Building the MSI Installer

Requires Windows host with a code-signing certificate:

```bash
export CSC_LINK=/path/to/cert.pfx
export CSC_KEY_PASSWORD=<password>
./scripts/build/sign-and-package.sh
# Output: apps/desktop/dist-installer/NexusOrder-Desk-Setup-1.0.0.msi
```
