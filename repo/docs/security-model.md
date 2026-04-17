# NexusOrder Desk -- Security Model

## Authentication

**Implementation**: `apps/service/src/modules/auth/`

- **Password hashing**: Argon2id via `passwordHashService.ts`
- **Password policy** (`passwordValidator.ts`): >=12 characters, >=1 digit, >=1 special character
- **Session token**: JOSE HS256 JWT stored in `nexusorder_session` HttpOnly cookie
- **Brute-force protection** (`failedLoginTracker.ts`): 5 failed attempts trigger a 15-minute lockout; record stored in `failed_logins` collection with TTL index

## Authorization (RBAC)

**Implementation**: `packages/shared-rbac/`, `apps/service/src/middleware/rbac.ts`

Every protected route applies: `authMiddleware -> requirePermission (RBAC) -> validate (input schema)`

Scope filtering is enforced inline within individual service and repository methods (see [Scope Isolation](#scope-isolation) below), not as a global middleware.

Permission matrix lives in `packages/shared-rbac/src/permissions.ts`. The same `canDo(role, permission)` function is used by both:
1. Express `requirePermission()` middleware -- server enforcement
2. React `menuPermissionMap.ts` -- UI navigation hiding (defense-in-depth, not the primary control)

### Role Capabilities Summary

| Permission | student | faculty_advisor | corporate_mentor | department_admin |
|------------|---------|-----------------|------------------|-----------------|
| orders:create | Y | | | |
| orders:checkout | Y | | | |
| orders:admin | | | | Y |
| approvals:approve | | Y | | Y |
| fulfillment:confirm_receipt | | | Y | Y |
| reconciliation:reconcile | | | | Y |
| rules:manage_rules | | | | Y |
| backups:backup | | | | Y |
| users:manage_users | | | | Y |

## Scope Isolation

**Implementation**: individual service modules (`orderRepository`, `catalogService`, `searchRouter`, `auditRouter`)

Every user has a `scope` object: `{ school?, major?, class?, cohort? }`. Scope filtering is applied directly within each service or repository method that returns user-scoped data. Administrators have an empty scope (`{}`), which bypasses scope filters.

Scope enforcement also applies to cart/checkout mutations via `isItemInScope()` in `catalogService.ts`.

## Encryption at Rest

**Implementation**: `apps/service/src/crypto/aes256.ts`

- Algorithm: AES-256-GCM
- Key: `FIELD_ENCRYPTION_KEY` env variable (32-byte hex)
- IV: 16 random bytes per encryption operation
- Encrypted fields: `catalog_items.sku`, `payment_intents.paymentReferenceEncrypted`

## Electron Security

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`
- `secureBridge.ts` -- only whitelisted IPC channel names via `contextBridge`
- Content Security Policy: `connect-src` limited to `localhost:4433`
- TLS cert fingerprint pinning in packaged mode (fail-closed)

## Audit Trail

**Implementation**: `apps/service/src/audit/auditLog.ts`

Every state-changing request emits an `order_audit_events` document. Audit records are append-only. Access restricted to `faculty_advisor` and `department_admin` roles.
