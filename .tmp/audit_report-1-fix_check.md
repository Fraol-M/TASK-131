# Reinspection Status Report (Static-Only)
Date: 2026-04-14
Scope: Previous inspection issues from delivery-acceptance-architecture-audit-2026-04-14.md


## Overall
- Total issues rechecked: 5
- Fixed: 5
- Not fixed: 0

## Issue-by-Issue Status

### 1) High: Paid-Unreconciled mandatory admin note not persisted
- Previous finding: Not persisted on payment intent record.
- Current status: Fixed
- Evidence:
  - apps/service/src/modules/reconciliation/reconciliationService.ts:220
  - apps/service/src/modules/reconciliation/reconciliationService.ts:221
  - apps/service/src/modules/reconciliation/reconciliationService.ts:222
  - apps/service/src/modules/reconciliation/reconciliationService.ts:223
- Notes:
  - Current implementation now persists unreconciled note + actor + timestamp fields during flag-unreconciled.
  - Test coverage still only checks status transition, not note-field persistence:
    - apps/service/tests/integration/reconciliation/reconciliation.test.ts:127
    - apps/service/tests/integration/reconciliation/reconciliation.test.ts:149

### 2) Medium: Menu-level RBAC incomplete
- Previous finding: Unmapped routes could be shown due to allow-by-default.
- Current status: Fixed
- Evidence:
  - apps/desktop/src/renderer/modules/auth/menuPermissionMap.ts:22
  - apps/desktop/src/renderer/modules/auth/menuPermissionMap.ts:25
  - apps/desktop/src/renderer/modules/auth/menuPermissionMap.ts:37
- Notes:
  - Route permissions now include cart and other nav entries.
  - Filtering now uses default-deny for unmapped routes.

### 3) Medium: Visual rule time-window editor missing full dimensions
- Previous finding: UI only handled start/end dates.
- Current status: Fixed
- Evidence:
  - apps/desktop/src/renderer/modules/rules/VisualRuleEditor.tsx:40
  - apps/desktop/src/renderer/modules/rules/VisualRuleEditor.tsx:79
  - apps/desktop/src/renderer/modules/rules/VisualRuleEditor.tsx:111
  - apps/desktop/src/renderer/modules/rules/VisualRuleEditor.tsx:304
  - apps/desktop/src/renderer/modules/rules/VisualRuleEditor.tsx:326
  - apps/desktop/src/renderer/modules/rules/VisualRuleEditor.tsx:340
- Notes:
  - Draft model and payload now include startTime, endTime, and daysOfWeek.

### 4) Medium: Desktop requirement verification coverage weak (no desktop tests)
- Previous finding: No desktop test suite present.
- Current status: Fixed
- Evidence:
  - repo/apps/desktop/src/main/windowManager.test.ts
  - repo/apps/desktop/src/main/trayManager.test.ts
  - repo/apps/desktop/src/renderer/shortcuts/shortcutRegistry.test.ts
  - repo/apps/desktop/src/renderer/modules/auth/menuPermissionMap.test.ts
- Notes:
  - Desktop automated tests are now present for core main-process and renderer permission/shortcut behaviors.

### 5) Low: Unauthenticated health endpoint exposes internal metadata
- Previous finding: /api/system/health returned full diagnostics without auth.
- Current status: Fixed
- Evidence:
  - apps/service/src/modules/system/systemRouter.ts:9
  - apps/service/src/modules/system/systemRouter.ts:10
  - apps/service/src/modules/system/systemRouter.ts:15
  - apps/service/src/modules/system/systemRouter.ts:19
- Notes:
  - Public health route now returns status only.
  - Full diagnostics moved to authenticated/admin route /api/system/health/details.

## Boundary
- Static-only reinspection. No runtime execution, no Docker, no tests run.