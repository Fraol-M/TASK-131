# NexusOrder Desk -- Reviewer Traceability

Maps each platform requirement to the implementing file and test coverage.

## Authentication and Session

| Requirement | File | Test |
|-------------|------|------|
| Password >=12 chars, >=1 digit, >=1 symbol | `packages/shared-validation/src/password.ts` | `apps/service/tests/unit/auth/passwordValidator.test.ts` |
| Argon2id hashing | `apps/service/src/modules/auth/passwordHashService.ts` | `apps/service/tests/integration/auth/login.test.ts` (indirect) |
| 5-attempt lockout, 15-min expiry | `apps/service/src/modules/auth/failedLoginTracker.ts` | `apps/service/tests/unit/auth/failedLoginTracker.test.ts` |
| JWT session cookie (HttpOnly) | `apps/service/src/modules/auth/sessionService.ts` | `apps/service/tests/integration/auth/login.test.ts` |
| Session validation middleware | `apps/service/src/middleware/auth.ts` | `apps/service/tests/integration/rbac/routeGuard.test.ts` |
| Logout and password change | `apps/service/src/modules/auth/authRouter.ts` | `apps/service/tests/integration/auth/authLifecycle.test.ts` |

## RBAC and Scope

| Requirement | File | Test |
|-------------|------|------|
| Role permission matrix | `packages/shared-rbac/src/permissions.ts` | `apps/service/tests/integration/rbac/routeGuard.test.ts` |
| `requirePermission()` middleware | `apps/service/src/middleware/rbac.ts` | `apps/service/tests/integration/rbac/routeGuard.test.ts` |
| Scope enforcement on cart/checkout mutation path | `apps/service/src/modules/orders/cartsRouter.ts`, `apps/service/src/modules/orders/checkoutService.ts`, `apps/service/src/modules/catalog/catalogService.ts` `isItemInScope()` | `apps/service/tests/integration/orders/cartScopeEnforcement.test.ts` |
| Object-level scope isolation on orders | `apps/service/src/modules/orders/ordersRouter.ts` | `apps/service/tests/integration/orders/orderScopeIsolation.test.ts` |

## Order Lifecycle

| Requirement | File | Test |
|-------------|------|------|
| State machine transitions | `apps/service/src/modules/orders/orderStateMachine.ts` | `apps/service/tests/unit/orders/orderStateMachine.test.ts` |
| Checkout throttle (10/10min) | `apps/service/src/modules/orders/checkoutThrottle.ts` | `apps/service/tests/integration/orders/checkout.test.ts` |
| Blacklist policy (browse OK, no checkout) | `apps/service/src/modules/catalog/blacklistPolicy.ts` | `apps/service/tests/integration/orders/checkout.test.ts` |
| auto_cancel_at on submission | `apps/service/src/modules/orders/orderScheduler.ts` | `apps/service/tests/integration/orders/orderLifecycleJobs.test.ts` |
| autoCancelJob | `apps/service/src/jobs/autoCancelJob.ts` | `apps/service/tests/unit/jobs/autoCancelJob.test.ts`, `apps/service/tests/integration/orders/orderLifecycleJobs.test.ts` |
| autoCloseJob (skips open RMAs) | `apps/service/src/jobs/autoCloseJob.ts` | `apps/service/tests/unit/jobs/autoCancelJob.test.ts`, `apps/service/tests/integration/orders/orderLifecycleJobs.test.ts` |
| Optimistic concurrency (version field) | `apps/service/src/modules/orders/orderRepository.ts` | `apps/service/tests/integration/orders/orderLifecycleJobs.test.ts` (version increment assertions) |

## Payments and Refunds

| Requirement | File | Test |
|-------------|------|------|
| Payment intent creation (one per order) | `apps/service/src/modules/payments/paymentIntentService.ts` | `apps/service/tests/integration/payments/paymentConfirm.test.ts` |
| Payment confirmation (Approved -> Paid) | `apps/service/src/modules/payments/paymentIntentService.ts` `markPaid()` | `apps/service/tests/integration/payments/paymentConfirm.test.ts` |
| Refund orderId/paymentIntentId linkage | `apps/service/src/modules/payments/refundsService.ts` | `apps/service/tests/integration/payments/refundIntegrity.test.ts` |
| Refund payment-status eligibility | `apps/service/src/modules/payments/refundsService.ts` | `apps/service/tests/integration/payments/refundIntegrity.test.ts` |
| Refund amount limit (cannot exceed paid) | `apps/service/src/modules/payments/refundsService.ts` | `apps/service/tests/integration/payments/refundIntegrity.test.ts` |

## Rules Engine

| Requirement | File | Test |
|-------------|------|------|
| Deterministic evaluation | `apps/service/src/rules/ruleEvaluator.ts` | `apps/service/tests/unit/rules/conflictDetector.test.ts` (indirect) |
| Conflict detection | `apps/service/src/rules/conflictDetector.ts` | `apps/service/tests/unit/rules/conflictDetector.test.ts` |
| Deterministic simulation | `apps/service/src/rules/simulationEngine.ts` | `apps/service/tests/integration/rules/simulationEngine.test.ts` |
| Rules CRUD and lifecycle | `apps/service/src/rules/ruleService.ts`, `apps/service/src/rules/rulesRouter.ts` | `apps/service/tests/integration/rules/rulesCrud.test.ts` |

## Crypto

| Requirement | File | Test |
|-------------|------|------|
| AES-256-GCM field encryption | `apps/service/src/crypto/aes256.ts` | `apps/service/tests/unit/crypto/aes256.test.ts` |
| Field masking (last 4 chars) | `packages/shared-logging/src/redact.ts` | `apps/service/tests/unit/crypto/maskField.test.ts` |

## Backup / Restore / Recovery

| Requirement | File | Test |
|-------------|------|------|
| Encrypted backup archive + SHA-256 | `apps/service/src/modules/backupRestore/backupService.ts` | `apps/service/tests/integration/backup/backup.test.ts` |
| Checksum validation on restore | `apps/service/src/modules/backupRestore/restoreService.ts` | `apps/service/tests/integration/backup/backup.test.ts` |
| Backup list and detail | `apps/service/src/modules/backupRestore/backupsRouter.ts` | `apps/service/tests/integration/backup/backupRead.test.ts` |
| Write-ahead checkpoints | `apps/service/src/recovery/checkpointWriter.ts` | `apps/service/tests/integration/recovery/recovery.test.ts` |
| Startup recovery scanner | `apps/service/src/recovery/recoveryScanner.ts` | `apps/service/tests/integration/recovery/recovery.test.ts` |
| Rollback orchestrator | `apps/service/src/updates/rollbackOrchestrator.ts` | `apps/service/tests/integration/updates/rollbackOrchestrator.test.ts` |
