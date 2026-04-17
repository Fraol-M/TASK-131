# NexusOrder Desk -- Architecture

## Overview

NexusOrder Desk is an offline-first desktop commerce and fulfillment platform built for Windows 11. It runs entirely on localhost with no cloud dependency at runtime.

## Component Diagram

```
+-------------------------------------------------+
|  Electron Desktop Shell (apps/desktop)          |
|  +-------------------------------------------+  |
|  | Renderer (React + Vite)                   |  |
|  |   LoginPage / OrdersPage / CartPage       |  |
|  |   CatalogPage / RulesPage / AuditViewer   |  |
|  +-------------------------------------------+  |
|  | Preload (secureBridge.ts / ipcContract.ts)|  |
|  +-------------------------------------------+  |
|  | Main Process                              |  |
|  |   windowManager / trayManager             |  |
|  |   serviceManager / mongoManager           |  |
|  |   notificationPoller / updateImportMgr    |  |
|  +-------------------------------------------+  |
+-------------------------------------------------+
         |  HTTPS (127.0.0.1:4433, pinned cert)
+-------------------------------------------------+
|  Express Service (apps/service)                 |
|  +-------------------------------------------+  |
|  | Middleware: auth / rbac / validate / audit |  |
|  +-------------------------------------------+  |
|  | Modules: auth / users / catalog / orders  |  |
|  |   approvals / fulfillment / payments      |  |
|  |   reconciliation / afterSales / backup    |  |
|  |   notifications / settings / system       |  |
|  +-------------------------------------------+  |
|  | Rules Engine / Jobs / Updates / Recovery  |  |
|  +-------------------------------------------+  |
|  | Persistence: mongoClient / runIndexes     |  |
|  +-------------------------------------------+  |
+-------------------------------------------------+
         |  MongoDB wire protocol (localhost)
+-------------------------------------------------+
|  MongoDB Community Server                       |
|  (bundled in MSI or Docker in dev)              |
+-------------------------------------------------+
```

## Key Principles

- **Offline-first**: no network calls to external services at runtime
- **Localhost TLS**: self-signed cert with fingerprint pinning in packaged mode
- **Monorepo**: pnpm workspace with shared packages (types, validation, RBAC, logging)
- **Docker for dev/CI**: all test and development flows run in containers
- **MSI for production**: Electron bundles MongoDB + Express service

## Shared Packages

| Package | Purpose |
|---------|---------|
| `shared-types` | TypeScript interfaces for all domain entities |
| `shared-validation` | Zod schemas for request validation |
| `shared-rbac` | Role permission matrix and `canDo()` utility |
| `shared-logging` | Structured pino logger with redaction |
