# NexusOrder Desk Static Audit Report

## 1. Verdict
- Overall conclusion: Partial Pass

Rationale:
- The repository is substantial and product-shaped, with clear Electron + Express + MongoDB architecture, route-level RBAC, local-service packaging intent, and broad test assets.
- However, there is at least one material requirement-breaking security/business-control defect: scope filtering can be bypassed during checkout by directly posting catalog item IDs to cart and then checking out.
- Additional high-impact risks remain in TLS trust fallback and financial integrity safeguards.

## 2. Scope and Static Verification Boundary
- What was reviewed:
  - Project docs and reviewer mappings: repo/README.md, repo/docs/*.md
  - Service entry/config/middleware/routers/core modules under repo/apps/service/src
  - Desktop main/preload/renderer critical modules under repo/apps/desktop/src
  - Shared RBAC/validation/logging/type modules under repo/packages/*
  - Test suites and test configs under repo/apps/service/tests and workspace vitest/package manifests
- What was not reviewed:
  - Runtime behavior under actual Windows desktop execution
  - Real Docker/container execution and real test execution
  - Real MSI signing output and certificate chain verification
  - Real High DPI rendering behavior at 1920x1080+ with scaling factors
- What was intentionally not executed:
  - Project start, Docker, tests, external services (per audit boundary)
- Claims requiring manual verification:
  - Signed .msi validity and trust chain
  - Actual High DPI rendering correctness and keyboard ergonomics in live UI
  - Week-long memory/leak behavior under prolonged runtime
  - End-to-end offline update rollback under real startup failure conditions

## 3. Repository / Requirement Mapping Summary
- Prompt core goal mapped:
  - Offline Windows desktop commerce/fulfillment platform with multi-role workflow, local auth/RBAC/scope isolation, reconciliation, rules, backups/recovery/rollback, tray + notifications.
- Main implementation areas mapped:
  - Desktop shell/security/windows/IPC: repo/apps/desktop/src/main/*, repo/apps/desktop/src/preload/*
  - Service API/security/business logic: repo/apps/service/src/app.ts, middleware, modules, rules, jobs, updates
  - Security and policy primitives: repo/packages/shared-rbac, repo/packages/shared-validation, repo/apps/service/src/crypto/*
  - Static tests and traceability: repo/apps/service/tests/*, repo/docs/reviewer-traceability.md, repo/docs/test-strategy.md

## 4. Section-by-section Review

### 4.1 Hard Gates

#### 4.1.1 Documentation and static verifiability
- Conclusion: Partial Pass
- Rationale:
  - Startup/run/test instructions exist and are fairly complete, including dev/test and packaging notes.
  - Static route/module structure is coherent and discoverable.
  - But documentation includes at least one architecture-security claim inconsistent with code (mentions scopeMiddleware pipeline that does not exist as middleware), reducing reviewer confidence.
- Evidence:
  - repo/README.md:13
  - repo/README.md:34
  - repo/README.md:47
  - repo/docs/security-model.md:16
  - repo/apps/service/src/app.ts:68
  - repo/apps/service/src/app.ts:92
  - repo/apps/service/src/app.ts:95
- Manual verification note:
  - Packaging and cert details still require runtime/manual checks.

#### 4.1.2 Material deviation from Prompt
- Conclusion: Partial Pass
- Rationale:
  - Overall architecture and core domain flows align strongly with prompt.
  - Material deviation exists in data-scope enforcement for checkout path (prompt requires scope filtering by school/major/class/cohort as control; code bypass allows out-of-scope item purchase flow).
- Evidence:
  - repo/apps/service/src/modules/catalog/catalogService.ts:35
  - repo/apps/service/src/modules/catalog/catalogService.ts:63
  - repo/apps/service/src/modules/orders/cartsRouter.ts:54
  - repo/apps/service/src/modules/orders/cartsRouter.ts:62
  - repo/apps/service/src/modules/orders/checkoutService.ts:42
  - repo/apps/service/src/modules/orders/checkoutService.ts:54

### 4.2 Delivery Completeness

#### 4.2.1 Coverage of explicit core requirements
- Conclusion: Partial Pass
- Rationale:
  - Many explicit requirements are statically represented: auth policy, lockout, RBAC, order state machine, reconciliation signatures/idempotency, backups/restore, tray/notifications, update routes.
  - Scope-filtering control is not end-to-end enforced in checkout path.
  - Some requirements are present but runtime-only proof remains unavailable (MSI signing, DPI behavior).
- Evidence:
  - repo/packages/shared-validation/src/password.ts:3
  - repo/apps/service/src/modules/auth/failedLoginTracker.ts:29
  - repo/apps/service/src/modules/orders/orderStateMachine.ts:6
  - repo/apps/service/src/modules/reconciliation/reconciliationService.ts:51
  - repo/apps/service/src/modules/reconciliation/reconciliationService.ts:83
  - repo/apps/service/src/modules/backupRestore/backupService.ts:78
  - repo/apps/service/src/modules/backupRestore/restoreService.ts:49
  - repo/apps/desktop/src/main/trayManager.ts:22
  - repo/apps/desktop/src/main/notificationPoller.ts:51
- Manual verification note:
  - MSI signing and High DPI rendering remain manual verification required.

#### 4.2.2 End-to-end deliverable (not a demo fragment)
- Conclusion: Pass
- Rationale:
  - Monorepo structure, split apps/packages, route coverage, jobs, docs, and tests indicate a real product-style deliverable rather than sample code.
- Evidence:
  - repo/README.md:64
  - repo/package.json:7
  - repo/apps/service/src/app.ts:68
  - repo/apps/desktop/src/main/index.ts:101

### 4.3 Engineering and Architecture Quality

#### 4.3.1 Structure and module decomposition
- Conclusion: Pass
- Rationale:
  - Module decomposition is clear: middleware/modules/jobs/rules/updates/crypto; desktop split into main/preload/renderer.
- Evidence:
  - repo/apps/service/src/app.ts:8
  - repo/apps/service/src/app.ts:28
  - repo/apps/desktop/src/main/windowManager.ts:6
  - repo/apps/desktop/src/preload/secureBridge.ts:8

#### 4.3.2 Maintainability and extensibility
- Conclusion: Partial Pass
- Rationale:
  - Generally maintainable patterns (shared packages, typed contracts, dedicated services).
  - Some control boundaries are brittle: scope enforcement is implemented in listing/search paths but not consistently in mutation path (cart/checkout), indicating policy dispersion risk.
- Evidence:
  - repo/apps/service/src/modules/catalog/catalogService.ts:35
  - repo/apps/service/src/modules/orders/ordersRouter.ts:34
  - repo/apps/service/src/modules/orders/cartsRouter.ts:54
  - repo/apps/service/src/modules/orders/checkoutService.ts:42

### 4.4 Engineering Details and Professionalism

#### 4.4.1 Error handling, logging, validation, API shape
- Conclusion: Partial Pass
- Rationale:
  - Centralized error handling and typed AppError hierarchy are present; pino logging and redaction exist.
  - Input validation exists broadly, but business integrity checks are missing in some financial flows (refund link consistency), and sensitive-path trust fallback in desktop cert handling is fail-open when fingerprint missing.
- Evidence:
  - repo/apps/service/src/middleware/errorHandler.ts:49
  - repo/packages/shared-logging/src/logger.ts:14
  - repo/apps/service/src/modules/payments/refundsService.ts:20
  - repo/apps/service/src/modules/payments/refundsService.ts:38
  - repo/apps/desktop/src/main/index.ts:19
  - repo/apps/desktop/src/main/index.ts:36

#### 4.4.2 Product/service maturity shape
- Conclusion: Partial Pass
- Rationale:
  - Product-level breadth is good.
  - Verification confidence is reduced by missing test coverage for several high-risk requirements documented by the project itself as uncovered.
- Evidence:
  - repo/docs/reviewer-traceability.md:32
  - repo/docs/reviewer-traceability.md:33
  - repo/docs/reviewer-traceability.md:34
  - repo/docs/reviewer-traceability.md:63
  - repo/docs/reviewer-traceability.md:82

### 4.5 Prompt Understanding and Requirement Fit

#### 4.5.1 Business-goal/constraint understanding
- Conclusion: Partial Pass
- Rationale:
  - Core business intent and many constraints are clearly understood and implemented.
  - A key implicit/explicit control (scope-based data restriction) is not consistently enforced for checkout mutations.
  - Some constraints remain statically unprovable.
- Evidence:
  - repo/apps/service/src/modules/orders/cartsRouter.ts:54
  - repo/apps/service/src/modules/orders/checkoutService.ts:42
  - repo/apps/service/src/modules/catalog/catalogService.ts:35
  - repo/apps/desktop/src/renderer/shortcuts/shortcutRegistry.ts:11
  - repo/apps/desktop/src/renderer/components/OrderContextMenu.tsx:28
- Manual verification note:
  - DPI correctness and MSI signing cannot be proven statically.

### 4.6 Aesthetics (frontend-only/full-stack)

#### 4.6.1 Visual/interaction quality
- Conclusion: Cannot Confirm Statistically
- Rationale:
  - Static code shows structured UI modules and keyboard/context interactions, but visual quality, alignment consistency, and DPI behavior require rendering inspection.
- Evidence:
  - repo/apps/desktop/src/renderer/modules/orders/CartPage.tsx:1
  - repo/apps/desktop/src/renderer/components/OrderContextMenu.tsx:1
  - repo/apps/desktop/src/main/windowManager.ts:18
- Manual verification note:
  - Manual desktop QA required at 1920x1080 and High DPI scaling settings.

## 5. Issues / Suggestions (Severity-Rated)

### Blocker

1) Severity: Blocker
- Title: Scope-filtering bypass in cart/checkout path allows out-of-scope ordering
- Conclusion: Fail
- Evidence:
  - repo/apps/service/src/modules/catalog/catalogService.ts:35
  - repo/apps/service/src/modules/catalog/catalogService.ts:63
  - repo/apps/service/src/modules/orders/cartsRouter.ts:54
  - repo/apps/service/src/modules/orders/cartsRouter.ts:62
  - repo/apps/service/src/modules/orders/checkoutService.ts:42
  - repo/apps/service/src/modules/orders/checkoutService.ts:54
- Impact:
  - A user can submit direct cart item IDs and proceed to checkout without enforcing eligibleScopes at mutation stage, violating required school/major/class/cohort data-scope control.
- Minimum actionable fix:
  - Enforce scope eligibility in POST /api/carts/items and/or checkoutService before order creation.
  - Reject out-of-scope catalogItemId with 403/422 and audit event.
  - Add dedicated integration tests for out-of-scope cart insertion and checkout rejection.

### High

2) Severity: High
- Title: Desktop certificate trust can fail open when pinned fingerprint is unavailable
- Conclusion: Partial Fail
- Evidence:
  - repo/apps/desktop/src/main/index.ts:19
  - repo/apps/desktop/src/main/index.ts:27
  - repo/apps/desktop/src/main/index.ts:36
  - repo/apps/desktop/src/main/index.ts:122
- Impact:
  - If fingerprint loading fails in packaged mode, certificate-error handler accepts any localhost cert, weakening localhost TLS trust model.
- Minimum actionable fix:
  - In packaged mode, require successful cert fingerprint load before accepting renderer HTTPS; fail closed if unavailable.
  - Gate acceptance by both host check and exact fingerprint match only.

3) Severity: High
- Title: Refund flow lacks payment-intent/order linkage integrity checks
- Conclusion: Fail
- Evidence:
  - repo/apps/service/src/modules/payments/refundsService.ts:10
  - repo/apps/service/src/modules/payments/refundsService.ts:20
  - repo/apps/service/src/modules/payments/refundsService.ts:38
  - repo/apps/service/src/modules/payments/refundsService.ts:56
  - repo/apps/service/tests (no dedicated refunds integration tests found via static search)
- Impact:
  - Refund records can be created with inconsistent orderId/paymentIntentId combinations, risking financial/audit corruption.
- Minimum actionable fix:
  - Validate that paymentIntent.orderId equals input.orderId and payment status is eligible before insert.
  - Add integration tests for mismatched IDs, duplicates, and unauthorized object access patterns.

### Medium

4) Severity: Medium
- Title: Security documentation pipeline claim does not match implemented middleware model
- Conclusion: Partial Fail
- Evidence:
  - repo/docs/security-model.md:16
  - repo/apps/service/src (no scopeMiddleware symbol found by static search)
- Impact:
  - Reviewer/operator expectations can diverge from real enforcement boundaries, reducing static verifiability quality.
- Minimum actionable fix:
  - Update docs to reflect actual per-module scope enforcement pattern, or implement centralized scope middleware where intended.

5) Severity: Medium
- Title: Coverage gaps exist for several critical lifecycle/recovery requirements
- Conclusion: Partial Fail
- Evidence:
  - repo/docs/reviewer-traceability.md:32
  - repo/docs/reviewer-traceability.md:33
  - repo/docs/reviewer-traceability.md:34
  - repo/docs/reviewer-traceability.md:63
  - repo/docs/reviewer-traceability.md:82
- Impact:
  - Severe defects can remain undetected even if current suite passes.
- Minimum actionable fix:
  - Add focused integration tests for auto-cancel, auto-close with RMA branching, deterministic simulation route/API behavior, and rollback orchestrator behavior boundaries.

### Low

6) Severity: Low
- Title: High DPI and signed MSI requirements are not statically provable
- Conclusion: Cannot Confirm Statistically
- Evidence:
  - repo/apps/desktop/src/main/windowManager.ts:18
  - repo/README.md:51
- Impact:
  - Acceptance risk at delivery handoff if manual QA/signing evidence is absent.
- Minimum actionable fix:
  - Provide signed artifact verification evidence and DPI QA checklist/screenshots in delivery docs.

## 6. Security Review Summary

- Authentication entry points: Pass
  - Evidence: repo/apps/service/src/modules/auth/authRouter.ts:22, repo/apps/service/src/modules/auth/failedLoginTracker.ts:29, repo/packages/shared-validation/src/password.ts:3
  - Reasoning: Local username/password flow, policy and lockout controls are implemented.

- Route-level authorization: Partial Pass
  - Evidence: repo/apps/service/src/middleware/rbac.ts:13, repo/apps/service/src/app.ts:68
  - Reasoning: Broad route-level RBAC exists; sensitive updates route includes internal key + admin session for interactive operations.

- Object-level authorization: Partial Pass
  - Evidence: repo/apps/service/src/modules/orders/ordersRouter.ts:34, repo/apps/service/src/modules/fulfillment/fulfillmentService.ts:73
  - Reasoning: Implemented for order detail/notes/tags and mentor confirm; not consistently enforced for all financial objects (refund linkage check missing).

- Function-level authorization: Partial Pass
  - Evidence: repo/apps/service/src/updates/updatesRouter.ts:22, repo/apps/service/src/updates/updatesRouter.ts:84
  - Reasoning: Function-level guard patterns exist, but auto-rollback machine path is exempt by design and should be tightly verified manually.

- Tenant / user isolation: Fail
  - Evidence: repo/apps/service/src/modules/catalog/catalogService.ts:35, repo/apps/service/src/modules/orders/cartsRouter.ts:62, repo/apps/service/src/modules/orders/checkoutService.ts:42
  - Reasoning: Scope logic exists for browsing/queries, but checkout mutation path can bypass eligible scope checks.

- Admin / internal / debug endpoint protection: Partial Pass
  - Evidence: repo/apps/service/src/updates/updatesRouter.ts:13, repo/apps/service/src/updates/updatesRouter.ts:22, repo/apps/service/src/modules/system/systemRouter.ts:8
  - Reasoning: Internal-key and admin checks are present on update operations; public health endpoint is intentionally unauthenticated and minimal.

## 7. Tests and Logging Review

- Unit tests: Pass
  - Evidence: repo/apps/service/tests/unit/auth/passwordValidator.test.ts:1, repo/apps/service/tests/unit/orders/orderStateMachine.test.ts:1, repo/apps/service/tests/unit/crypto/aes256.test.ts:1
  - Rationale: Core logic areas have dedicated unit suites.

- API / integration tests: Partial Pass
  - Evidence: repo/apps/service/tests/integration/auth/login.test.ts:1, repo/apps/service/tests/integration/orders/orderScopeIsolation.test.ts:68, repo/apps/service/tests/integration/reconciliation/reconciliation.test.ts:1
  - Rationale: Many critical APIs covered, but notable gaps remain (refund flow integrity, documented untested items in traceability).

- Logging categories / observability: Pass
  - Evidence: repo/packages/shared-logging/src/logger.ts:14, repo/apps/service/src/middleware/errorHandler.ts:77, repo/apps/service/src/server.ts:63
  - Rationale: Structured logger, module-level logs, and centralized error path exist.

- Sensitive-data leakage risk in logs / responses: Partial Pass
  - Evidence: repo/packages/shared-logging/src/logger.ts:4, repo/packages/shared-logging/src/redact.ts:11, repo/apps/service/src/modules/auth/authRouter.ts:23
  - Rationale: Redaction and HttpOnly cookie are present; still requires manual log review in runtime scenarios.

## 8. Test Coverage Assessment (Static Audit)

### 8.1 Test Overview
- Unit tests exist: Yes
- API/integration tests exist: Yes
- Frameworks: Vitest + Supertest
- Test entry points:
  - repo/package.json:11
  - repo/apps/service/package.json:10
  - repo/vitest.workspace.ts:3
- Test command docs exist:
  - repo/README.md:34
  - repo/docs/test-strategy.md:31

### 8.2 Coverage Mapping Table

| Requirement / Risk Point | Mapped Test Case(s) | Key Assertion / Fixture / Mock | Coverage Assessment | Gap | Minimum Test Addition |
|---|---|---|---|---|---|
| Password policy + lockout | repo/apps/service/tests/integration/auth/login.test.ts:35; repo/apps/service/tests/unit/auth/failedLoginTracker.test.ts:27 | lockout after 5 attempts and expiry behavior | sufficient | none material | keep regression tests for edge timing |
| Route-level RBAC 401/403 | repo/apps/service/tests/integration/rbac/routeGuard.test.ts:12 | explicit 401/403/200 assertions by role | sufficient | none material | add matrix expansion as roles evolve |
| Object-level scope on order detail/notes/tags | repo/apps/service/tests/integration/orders/orderScopeIsolation.test.ts:68 | 403 for out-of-scope advisor/student | sufficient | none material in covered endpoints | add similar tests for additional modules |
| Checkout throttle + blacklist | repo/apps/service/tests/integration/orders/checkout.test.ts:26 | CHECKOUT_THROTTLED and USER_BLACKLISTED assertions | basically covered | no test for out-of-scope catalog item at cart/checkout mutation | add integration test with eligibleScopes-restricted item and out-of-scope user |
| Reconciliation signature/idempotency/repair | repo/apps/service/tests/integration/reconciliation/reconciliation.test.ts:34 | invalid signature rejects import; duplicate count; repair note required | sufficient | no explicit concurrency/race assertions beyond duplicate handling | add concurrent import race test with same payment_intent_id |
| Updates route auth boundaries | repo/apps/service/tests/integration/updates/updateAuth.test.ts:24 | missing/wrong key and admin-session checks | basically covered | rollback execution semantics under unhealthy startup not covered | add startup-failure rollback integration scenario |
| Refund integrity linkage | no direct integration tests found | n/a | missing | mismatched orderId/paymentIntentId defect undetected | add refunds integration tests for linkage, status eligibility, duplicate/refund-limit edges |
| Auto-cancel / auto-close jobs | repo/docs/reviewer-traceability.md:33 and :34 marked untested | n/a | missing | time-based lifecycle regressions can slip | add job-level integration tests with time control fixtures |

### 8.3 Security Coverage Audit
- Authentication: sufficient
  - Tests: login + failed-login tracker suites cover success/failure/lockout boundaries.
- Route authorization: basically covered
  - Tests: routeGuard and updateAuth cover major 401/403 paths.
- Object-level authorization: insufficient
  - Tests focus on orders/mentor; equivalent rigor is missing for financial object integrity and broader tenant-sensitive mutations.
- Tenant / data isolation: insufficient
  - Existing tests validate order read scope but do not cover cart/checkout scope bypass path.
- Admin / internal protection: basically covered
  - Update routes have targeted auth tests; production-hardening scenarios remain manual.

### 8.4 Final Coverage Judgment
- Final coverage judgment: Partial Pass
- Boundary explanation:
  - Covered: auth lockout, key RBAC paths, order object-level checks, reconciliation signature/idempotency, update-route auth boundaries.
  - Uncovered major risks: scope enforcement on checkout mutation path, refund integrity linkage, and several time/recovery lifecycle behaviors. Current tests could pass while severe defects remain in these areas.

## 9. Final Notes
- This report is static-only and evidence-based; no runtime success is claimed.
- Strong findings were limited to root-cause issues with direct file:line support.
- Manual verification is still required for MSI signing validity, High DPI behavior, and long-session runtime stability.