# Test Coverage Audit

## Project Type Detection
- README declaration found at top: `<!-- project-type: desktop -->` in `repo/README.md`.
- Effective project type used for audit: **desktop** (declared, no inference required).
- Structure note: repository contains both desktop frontend (`repo/apps/desktop`) and backend service (`repo/apps/service`), so both layers were audited.

## Backend Endpoint Inventory
Resolved from `repo/apps/service/src/app.ts` mount points plus router-level paths.

Total unique endpoints (`METHOD + fully resolved PATH`): **78**

1. POST `/api/auth/login`
2. POST `/api/auth/logout`
3. GET `/api/auth/session`
4. POST `/api/auth/change-password`
5. GET `/api/users`
6. POST `/api/users`
7. POST `/api/users/consent/fingerprint`
8. POST `/api/users/fingerprint`
9. POST `/api/users/:id/blacklist`
10. DELETE `/api/users/:id/blacklist`
11. GET `/api/catalog`
12. GET `/api/catalog/:id`
13. POST `/api/catalog`
14. PATCH `/api/catalog/:id`
15. GET `/api/vendors`
16. GET `/api/vendors/:id`
17. POST `/api/vendors`
18. GET `/api/carts/active`
19. GET `/api/carts/me`
20. POST `/api/carts/items`
21. DELETE `/api/carts/items/:catalogItemId`
22. POST `/api/carts/checkout`
23. GET `/api/orders`
24. GET `/api/orders/:id`
25. POST `/api/orders/:id/notes`
26. POST `/api/orders/:id/tags`
27. GET `/api/approvals/pending`
28. POST `/api/approvals/:orderId/approve`
29. POST `/api/approvals/:orderId/reject`
30. POST `/api/approvals/:orderId/decide`
31. POST `/api/fulfillment/:orderId/allocate`
32. POST `/api/fulfillment/:orderId/ship`
33. POST `/api/fulfillment/:orderId/confirm-delivery`
34. POST `/api/payments/intents`
35. GET `/api/payments/intents/:id`
36. POST `/api/payments/intents/:id/confirm`
37. GET `/api/payments/reconciliation`
38. POST `/api/payments/reconciliation/import`
39. POST `/api/payments/reconciliation/flag-unreconciled`
40. POST `/api/payments/reconciliation/repair`
41. POST `/api/refunds`
42. GET `/api/refunds/order/:orderId`
43. POST `/api/payments/refunds`
44. GET `/api/payments/refunds/order/:orderId`
45. POST `/api/rma/orders/merge`
46. POST `/api/rma/orders/:orderId`
47. POST `/api/rma/:rmaId/approve`
48. POST `/api/rma/orders/:orderId/split`
49. GET `/api/reason-codes`
50. POST `/api/reason-codes`
51. PATCH `/api/reason-codes/:id`
52. GET `/api/rules`
53. GET `/api/rules/conflicts`
54. GET `/api/rules/conflicts/all`
55. POST `/api/rules`
56. POST `/api/rules/simulations`
57. GET `/api/rules/:id`
58. PATCH `/api/rules/:id`
59. POST `/api/rules/:id/activate`
60. POST `/api/rules/:id/deactivate`
61. GET `/api/notifications`
62. POST `/api/notifications/:id/read`
63. PUT `/api/notifications/preferences`
64. GET `/api/search`
65. GET `/api/audits`
66. GET `/api/backups`
67. POST `/api/backups`
68. GET `/api/backups/:id`
69. POST `/api/restore`
70. GET `/api/settings`
71. GET `/api/settings/backup-destination`
72. PUT `/api/settings/backup-destination`
73. POST `/api/updates/import`
74. POST `/api/updates/:packageId/apply`
75. POST `/api/updates/rollback`
76. POST `/api/updates/auto-rollback`
77. GET `/api/system/health`
78. GET `/api/system/health/details`

## API Test Mapping Table
Legend: `TNM` = true no-mock HTTP, `HWM` = HTTP with mocking, `Mixed` = both TNM and HWM evidence.

| Endpoint | Covered | Test type | Test files | Evidence |
|---|---|---|---|---|
| POST /api/auth/login | yes | TNM | integration/auth/login.test.ts | `describe('POST /api/auth/login')` |
| POST /api/auth/logout | yes | TNM | integration/auth/authLifecycle.test.ts | `describe('POST /api/auth/logout')` |
| GET /api/auth/session | yes | TNM | integration/auth/login.test.ts | `describe('GET /api/auth/session')` |
| POST /api/auth/change-password | yes | TNM | integration/auth/authLifecycle.test.ts | `describe('POST /api/auth/change-password')` |
| GET /api/users | yes | TNM | integration/rbac/routeGuard.test.ts | `it('allows admin to access /api/users')` |
| POST /api/users | yes | TNM | integration/users/userManagement.test.ts | `describe('POST /api/users')` |
| POST /api/users/consent/fingerprint | yes | TNM | integration/notifications/notifications.test.ts | requests to `/api/users/consent/fingerprint` |
| POST /api/users/fingerprint | yes | TNM | integration/notifications/notifications.test.ts | requests to `/api/users/fingerprint` |
| POST /api/users/:id/blacklist | yes | TNM | integration/users/userManagement.test.ts | `describe('POST /api/users/:id/blacklist')` |
| DELETE /api/users/:id/blacklist | yes | TNM | integration/users/userManagement.test.ts | `describe('DELETE /api/users/:id/blacklist')` |
| GET /api/catalog | yes | TNM | integration/orders/checkout.test.ts | request `get('/api/catalog')` |
| GET /api/catalog/:id | yes | TNM | integration/catalog/catalogCrud.test.ts | `describe('GET /api/catalog/:id')` |
| POST /api/catalog | yes | TNM | integration/catalog/catalogCrud.test.ts | `describe('POST /api/catalog')` |
| PATCH /api/catalog/:id | yes | TNM | integration/catalog/catalogCrud.test.ts | `describe('PATCH /api/catalog/:id')` |
| GET /api/vendors | yes | TNM | integration/catalog/vendors.test.ts | `describe('GET /api/vendors')` |
| GET /api/vendors/:id | yes | TNM | integration/catalog/vendors.test.ts | `describe('GET /api/vendors/:id')` |
| POST /api/vendors | yes | TNM | integration/catalog/vendors.test.ts | `describe('POST /api/vendors')` |
| GET /api/carts/active | yes | TNM | integration/orders/cartsAndPayments.test.ts | `describe('GET /api/carts/active')` |
| GET /api/carts/me | yes | TNM | integration/orders/cartsAndPayments.test.ts | `describe('GET /api/carts/me')` |
| POST /api/carts/items | yes | TNM | integration/orders/cartScopeEnforcement.test.ts | `describe('Cart scope enforcement: POST /api/carts/items')` |
| DELETE /api/carts/items/:catalogItemId | yes | TNM | integration/orders/cartsAndPayments.test.ts | `describe('DELETE /api/carts/items/:catalogItemId')` |
| POST /api/carts/checkout | yes | TNM | integration/orders/checkout.test.ts | repeated `post('/api/carts/checkout')` |
| GET /api/orders | yes | TNM | integration/orders/ordersListHandler.test.ts | `describe('GET /api/orders (handler-path)')` |
| GET /api/orders/:id | yes | TNM | integration/orders/orderScopeIsolation.test.ts | `describe('Object-level scope isolation: GET /api/orders/:id')` |
| POST /api/orders/:id/notes | yes | TNM | integration/orders/orderScopeIsolation.test.ts | `describe('...POST /api/orders/:id/notes')` |
| POST /api/orders/:id/tags | yes | TNM | integration/orders/orderScopeIsolation.test.ts | `describe('...POST /api/orders/:id/tags')` |
| GET /api/approvals/pending | yes | TNM | integration/approvals/approvals.test.ts | `describe('GET /api/approvals/pending')` |
| POST /api/approvals/:orderId/approve | yes | TNM | unit/services/approvalService.test.ts | requests to `/api/approvals/${orderId}/approve` |
| POST /api/approvals/:orderId/reject | yes | TNM | integration/approvals/approvals.test.ts | `describe('POST /api/approvals/:orderId/reject')` |
| POST /api/approvals/:orderId/decide | yes | TNM | integration/approvals/approvals.test.ts | `describe('POST /api/approvals/:orderId/decide')` |
| POST /api/fulfillment/:orderId/allocate | yes | TNM | unit/services/fulfillmentService.test.ts | request `post('/api/fulfillment/${orderId}/allocate')` |
| POST /api/fulfillment/:orderId/ship | yes | TNM | unit/services/fulfillmentService.test.ts | request `post('/api/fulfillment/${orderId}/ship')` |
| POST /api/fulfillment/:orderId/confirm-delivery | yes | TNM | unit/services/fulfillmentService.test.ts | request `post('/api/fulfillment/${orderId}/confirm-delivery')` |
| POST /api/payments/intents | yes | TNM | integration/payments/paymentConfirm.test.ts | request `post('/api/payments/intents')` |
| GET /api/payments/intents/:id | yes | TNM | integration/orders/cartsAndPayments.test.ts | `describe('GET /api/payments/intents/:id')` |
| POST /api/payments/intents/:id/confirm | yes | TNM | integration/payments/paymentConfirm.test.ts | test title includes `/confirm` endpoint |
| GET /api/payments/reconciliation | yes | TNM | integration/backup/backupRead.test.ts | `describe('GET /api/payments/reconciliation')` |
| POST /api/payments/reconciliation/import | yes | Mixed | integration/reconciliation/reconciliation.test.ts | both mocked `verifyRowSignature` and real-crypto `no mocks` tests |
| POST /api/payments/reconciliation/flag-unreconciled | yes | Mixed | integration/reconciliation/reconciliation.test.ts | route hit in same file; file contains `vi.spyOn(signatureVerifier...)` |
| POST /api/payments/reconciliation/repair | yes | TNM | integration/reconciliation/reconciliationRepair.test.ts | `describe('POST .../repair (handler-path)')` |
| POST /api/refunds | yes | TNM | integration/payments/refundsAlias.test.ts | `describe('POST /api/refunds (alias)')` |
| GET /api/refunds/order/:orderId | yes | TNM | integration/payments/refundsAlias.test.ts | `describe('GET /api/refunds/order/:orderId (alias)')` |
| POST /api/payments/refunds | yes | TNM | integration/payments/refundsAlias.test.ts | setup call `post('/api/payments/refunds')` |
| GET /api/payments/refunds/order/:orderId | yes | TNM | integration/orders/cartsAndPayments.test.ts | `describe('GET /api/payments/refunds/order/:orderId')` |
| POST /api/rma/orders/merge | yes | TNM | integration/orders/splitMerge.test.ts | requests `post('/api/rma/orders/merge')` |
| POST /api/rma/orders/:orderId | yes | TNM | integration/afterSales/reasonCodesAndRma.test.ts | request `post('/api/rma/orders/${orderId}')` |
| POST /api/rma/:rmaId/approve | yes | TNM | integration/afterSales/reasonCodesAndRma.test.ts | `describe('POST /api/rma/:rmaId/approve')` |
| POST /api/rma/orders/:orderId/split | yes | TNM | integration/orders/splitMerge.test.ts | requests `post('/api/rma/orders/${orderId}/split')` |
| GET /api/reason-codes | yes | TNM | integration/afterSales/reasonCodesAndRma.test.ts | `describe('GET /api/reason-codes')` |
| POST /api/reason-codes | yes | TNM | integration/afterSales/reasonCodesAndRma.test.ts | `describe('POST /api/reason-codes')` |
| PATCH /api/reason-codes/:id | yes | TNM | integration/afterSales/reasonCodesAndRma.test.ts | `describe('PATCH /api/reason-codes/:id')` |
| GET /api/rules | yes | TNM | integration/rules/rulesCrud.test.ts | `describe('GET /api/rules')` |
| GET /api/rules/conflicts | yes | TNM | integration/rbac/routeGuard.test.ts | `it('GET /api/rules/conflicts is NOT captured...')` |
| GET /api/rules/conflicts/all | yes | TNM | integration/rules/rulesCrud.test.ts | `describe('GET /api/rules/conflicts/all')` |
| POST /api/rules | yes | TNM | integration/rules/rulesCrud.test.ts | `describe('POST /api/rules')` |
| POST /api/rules/simulations | yes | TNM | integration/rules/rulesCrud.test.ts | `describe('POST /api/rules/simulations')` |
| GET /api/rules/:id | yes | TNM | integration/rules/rulesCrud.test.ts | `describe('GET /api/rules/:id')` |
| PATCH /api/rules/:id | yes | TNM | integration/rules/rulesCrud.test.ts | `describe('PATCH /api/rules/:id')` |
| POST /api/rules/:id/activate | yes | TNM | integration/rules/rulesCrud.test.ts | `describe('POST /api/rules/:id/activate')` |
| POST /api/rules/:id/deactivate | yes | TNM | integration/rules/rulesCrud.test.ts | `describe('POST /api/rules/:id/deactivate')` |
| GET /api/notifications | yes | TNM | integration/notifications/notifications.test.ts | `describe('Notifications: GET /api/notifications')` |
| POST /api/notifications/:id/read | yes | TNM | integration/notifications/notifications.test.ts | request `post('/api/notifications/${id}/read')` |
| PUT /api/notifications/preferences | yes | TNM | integration/notifications/notifications.test.ts | request `put('/api/notifications/preferences')` |
| GET /api/search | yes | TNM | integration/notifications/notifications.test.ts | `describe('Search: GET /api/search')` |
| GET /api/audits | yes | TNM | integration/rbac/routeGuard.test.ts | `it('.../api/audits')` |
| GET /api/backups | yes | TNM | integration/backup/backupRead.test.ts | `describe('GET /api/backups')` |
| POST /api/backups | yes | TNM | integration/backup/backup.test.ts | repeated `post('/api/backups')` |
| GET /api/backups/:id | yes | TNM | integration/backup/backupRead.test.ts | `describe('GET /api/backups/:id')` |
| POST /api/restore | yes | TNM | integration/backup/backup.test.ts | repeated `post('/api/restore')` |
| GET /api/settings | yes | TNM | integration/settings/settings.test.ts | `describe('GET /api/settings')` |
| GET /api/settings/backup-destination | yes | TNM | integration/settings/settings.test.ts | `describe('GET /api/settings/backup-destination')` |
| PUT /api/settings/backup-destination | yes | TNM | integration/settings/settings.test.ts | `describe('PUT /api/settings/backup-destination')` |
| POST /api/updates/import | yes | TNM | integration/updates/updateAuth.test.ts | repeated `post('/api/updates/import')` |
| POST /api/updates/:packageId/apply | yes | TNM | integration/updates/updateAuth.test.ts | requests `post('/api/updates/.../apply')` |
| POST /api/updates/rollback | yes | TNM | integration/updates/updateAuth.test.ts, integration/updates/rollbackHandler.test.ts | both files hit `/api/updates/rollback` |
| POST /api/updates/auto-rollback | yes | TNM | integration/updates/updateAuth.test.ts | repeated `post('/api/updates/auto-rollback')` |
| GET /api/system/health | yes | Mixed | integration/system/health.test.ts | includes normal requests + one `vi.spyOn(runStartupHealthCheck)` |
| GET /api/system/health/details | yes | TNM | integration/system/health.test.ts | `describe('GET /api/system/health/details')` |

## API Test Classification
1. **True No-Mock HTTP**
- Evidence: service HTTP tests use `createApp()` + `supertest`, real middleware stack, DB connected in `tests/setup.ts`.
- Representative files:
  - `repo/apps/service/tests/integration/auth/login.test.ts`
  - `repo/apps/service/tests/integration/orders/ordersListHandler.test.ts`
  - `repo/apps/service/tests/integration/catalog/catalogCrud.test.ts`
  - `repo/apps/service/tests/integration/updates/updateAuth.test.ts`
  - `repo/apps/service/tests/unit/services/fulfillmentService.test.ts` (despite `unit/` folder, it is HTTP-level)

2. **HTTP with Mocking**
- `repo/apps/service/tests/integration/reconciliation/reconciliation.test.ts`
  - `vi.spyOn(signatureVerifier, 'verifyRowSignature').mockReturnValue(...)`
- `repo/apps/service/tests/integration/system/health.test.ts`
  - `vi.spyOn(mod, 'runStartupHealthCheck').mockResolvedValueOnce(...)`

3. **Non-HTTP (unit/integration without HTTP)**
- Backend examples:
  - `repo/apps/service/tests/unit/auth/failedLoginTracker.test.ts` (direct module calls, mocked DB)
  - `repo/apps/service/tests/unit/rules/ruleEvaluator.test.ts`
  - `repo/apps/service/tests/unit/orders/orderStateMachine.test.ts`
- Frontend examples:
  - `repo/apps/desktop/src/renderer/modules/auth/LoginPage.test.tsx`
  - `repo/apps/desktop/src/main/windowManager.test.ts`

## Mock Detection
Detected mocking/stubbing relevant to strict classification:
- `repo/apps/service/tests/unit/auth/failedLoginTracker.test.ts`
  - `vi.mock('../../../src/persistence/mongoClient.js', ...)` (mocked persistence provider)
- `repo/apps/service/tests/integration/reconciliation/reconciliation.test.ts`
  - `vi.spyOn(signatureVerifier, 'verifyRowSignature').mockReturnValue(...)` (crypto verifier mocked in some HTTP cases)
- `repo/apps/service/tests/integration/system/health.test.ts`
  - `vi.spyOn(mod, 'runStartupHealthCheck').mockResolvedValueOnce(...)` (health checker mocked in one HTTP case)
- Frontend tests (non-API): multiple `globalThis.fetch = vi.fn().mockResolvedValue(...)` and `vi.mock('electron', ...)` across desktop test files.

## Coverage Summary
- Total endpoints: **78**
- Endpoints with HTTP tests: **78**
- Endpoints with true no-mock HTTP evidence: **78** (some also have additional mocked HTTP tests)
- HTTP coverage: **100.0%**
- True API coverage: **100.0%**

## Unit Test Summary

### Backend Unit Tests
- Unit test files found under `repo/apps/service/tests/unit`: **21 files**.
- Covered module categories:
  - Controllers/route behavior via HTTP-style tests in `unit/services/*` and `unit/middleware/internalAuth.test.ts`
  - Services: `approvalService`, `authService`, `checkoutService`, `fulfillmentService`, `notificationService`, `paymentIntentService`, `refundsService`
  - Middleware: `errorHandler`, `internalAuth`, `rbacAndValidate`
  - Rules/Domain logic: `ruleEvaluator`, `conflictDetector`, `orderStateMachine`, `splitMergeInvariants`
  - Crypto/Auth helpers: `aes256`, `maskField`, `passwordValidator`, `failedLoginTracker`
- Important backend modules not directly unit-tested (file-level gap):
  - `repo/apps/service/src/modules/orders/orderRepository.ts`
  - `repo/apps/service/src/modules/backupRestore/backupService.ts`
  - `repo/apps/service/src/modules/backupRestore/restoreService.ts`
  - `repo/apps/service/src/modules/search/searchRouter.ts` handler internals (only HTTP-level)
  - `repo/apps/service/src/modules/users/deviceFingerprintService.ts` has HTTP coverage but no direct unit suite

### Frontend Unit Tests (STRICT REQUIREMENT)
- Frontend test files: **present** (29 files under `repo/apps/desktop/src/**/*test*`).
- Framework/tools detected:
  - Vitest (`repo/apps/desktop/vitest.config.ts`, imports from `vitest`)
  - jsdom test environment annotations (`@vitest-environment jsdom`)
  - React render-level tests using `react-dom/test-utils`, `createRoot`, router wrappers
- Evidence tests import/render actual frontend modules/components:
  - `repo/apps/desktop/src/renderer/modules/auth/LoginPage.test.tsx` imports and renders `LoginPage`
  - `repo/apps/desktop/src/renderer/router.test.tsx` imports `router`
  - Multiple module page tests (`OrdersPage.test.tsx`, `CatalogPage.test.tsx`, `RulesPage.test.tsx`, etc.)
- Important frontend modules/components not tested (no colocated `.test.*` found):
  - `repo/apps/desktop/src/renderer/App.tsx`
  - `repo/apps/desktop/src/renderer/components/NavLayout.tsx`
  - `repo/apps/desktop/src/main/updateImportManager.ts`
  - `repo/apps/desktop/src/main/serviceManager.ts`
  - `repo/apps/desktop/src/main/notificationBridge.ts`
- **Mandatory verdict: Frontend unit tests: PRESENT**

### Cross-Layer Observation
- Backend and frontend both have substantial test surfaces.
- Balance is acceptable: backend has broader API-path coverage; frontend has broad component/module-level unit coverage.

## API Observability Check
- Strong in most HTTP suites: tests usually show endpoint, request payload/query, and response body/status assertions.
- Weak spots:
  - Some setup-path calls are not always directly asserted (example: occasional setup `POST /api/payments/refunds` before later assertions in `refundsAlias.test.ts`).
  - Mixed mocked/non-mocked behavior in same endpoint suites can obscure whether a failing assertion is business logic vs mock behavior.

## Test Quality & Sufficiency
- Success path coverage: strong across auth, catalog, orders, approvals, payments, reconciliation, updates.
- Failure/validation coverage: strong (401/403/404/422/400 paths frequently tested).
- Auth/permissions: strong (`routeGuard.test.ts`, many role-based checks).
- Edge cases: good for reconciliation signatures, lockout flows, scope enforcement, split/merge invariants.
- Over-mocking risk: limited to targeted areas (`reconciliation` and one `system health` case), with compensating no-mock tests present.
- `run_tests.sh` check: **Docker-based test execution**; no local dependency hard requirement detected.

## End-to-End Expectations
- For declared `desktop` type, strict FE?BE browser-style E2E is not a hard requirement.
- Current posture: strong API integration + strong frontend unit coverage; no true end-to-end desktop UI + backend automation found.

## Tests Check
- Static inspection only: complied.
- Runtime execution: not performed.
- Endpoint inventory + mapping: completed.
- Mock classification: completed.
- Frontend strict presence detection: completed.

## Test Coverage Score (0-100)
**90/100**

## Score Rationale
- + Full endpoint HTTP coverage with substantial permission/validation testing.
- + Wide backend and frontend unit coverage footprint.
- - Some endpoint exercises are setup-only with weaker direct response assertions.
- - Mixed mocked HTTP tests in critical areas (reconciliation/health) reduce strict realism signal in those subsets.

## Key Gaps
1. No automated true desktop end-to-end scenario (UI interaction + backend assertions) despite rich component and API suites.
2. Select backend core modules are covered only indirectly (repository and backup/restore internals).
3. A few HTTP calls are used as setup helpers without explicit assertions on that specific call.

## Confidence & Assumptions
- Confidence: **high** for endpoint inventory and coverage mapping.
- Assumptions:
  - Endpoint resolution based on static `app.use` + router declarations only.
  - Coverage judged by explicit `supertest` request paths/methods in source tests.
  - True no-mock classification is endpoint-level if at least one no-mock HTTP path exists, even when other tests for same endpoint use mocks.

---

# README Audit

## README Location
- Required file `repo/README.md`: **present**.

## Hard Gate Evaluation

### Formatting
- Result: **PASS**
- Evidence: clear markdown hierarchy, tables, code blocks.

### Startup Instructions
- Project type used: **desktop** (declared).
- Desktop run/build instructions present:
  - Dev start via Docker + desktop dev command.
  - MSI packaging section with build command.
- Result: **PASS**

### Access Method
- Access/launch methods documented:
  - API URL/port and health URL
  - desktop launch flow
- Result: **PASS**

### Verification Method
- Explicit verification runbook present (API curl flow + desktop UI flow).
- Result: **PASS**

### Environment Rules (STRICT)
- No host-level `npm install`/`pip install`/`apt-get` instructions for runtime.
- Tests and core dev stack are Docker-driven.
- Result: **PASS**

### Demo Credentials (Conditional)
- Authentication exists and README provides username/password for all listed roles.
- Result: **PASS**

## Engineering Quality Assessment
- Tech stack clarity: strong.
- Architecture and docs linkage: strong.
- Testing instructions: strong (`./run_tests.sh`, Docker test context).
- Security/roles explanation: adequate and tied to credentials and docs.
- Workflow clarity: good (quick start + verification + packaging sections).
- Presentation quality: high.

## High Priority Issues
- None.

## Medium Priority Issues
1. Command style uses `docker compose` while some environments/scripts still expect `docker-compose`; consistency note only (not a gate failure).

## Low Priority Issues
1. README includes production MSI prerequisite (`mongod.exe` placement) that is clearly labeled as build-time only, but it can be misread as dev prerequisite.

## Hard Gate Failures
- None.

## README Verdict
**PASS**
