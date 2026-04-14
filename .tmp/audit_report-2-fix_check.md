# Reinspection Fix Check Report (Static-Only)
Date: 2026-04-14
Source baseline: previous inspection issues documented in .tmp/audit_report-static-delivery-architecture.md



## Overall
- Total issues rechecked: 6
- Fixed: 5
- Partially fixed: 0
- Not fixed: 0

## Issue-by-Issue Status

### 1) Blocker: Scope-filtering bypass in cart/checkout path allows out-of-scope ordering
- Previous finding: Cart/checkout mutation path did not enforce eligibleScopes, enabling scope bypass.
- Current status: Fixed
- Evidence:
  - repo/apps/service/src/modules/orders/cartsRouter.ts:67
  - repo/apps/service/src/modules/orders/cartsRouter.ts:73
  - repo/apps/service/src/modules/orders/cartsRouter.ts:85
  - repo/apps/service/src/modules/orders/checkoutService.ts:59
  - repo/apps/service/src/modules/orders/checkoutService.ts:64
  - repo/apps/service/src/modules/catalog/catalogService.ts:39
  - repo/apps/service/tests/integration/orders/cartScopeEnforcement.test.ts:47
  - repo/apps/service/tests/integration/orders/cartScopeEnforcement.test.ts:140
- Reinspection notes:
  - POST /api/carts/items now validates item scope via isItemInScope before cart insertion.
  - checkoutService adds defense-in-depth scope validation and rejects ITEM_OUT_OF_SCOPE.

### 2) High: Desktop certificate trust can fail open when pinned fingerprint is unavailable
- Previous finding: Renderer cert acceptance can allow localhost cert when fingerprint is null.
- Current status: Fixed
- Evidence:
  - repo/apps/desktop/src/main/index.ts:37
  - repo/apps/desktop/src/main/index.ts:41
  - repo/apps/desktop/src/main/index.ts:46
- Reinspection notes:
  - Packaged mode now rejects cert errors when fingerprint is null or mismatched (fail closed).
  - Dev-mode fallback remains explicitly limited to !app.isPackaged.

### 3) High: Refund flow lacks payment-intent/order linkage integrity checks
- Previous finding: Refund creation did not verify payment intent belongs to provided order.
- Current status: Fixed
- Evidence:
  - repo/apps/service/src/modules/payments/refundsService.ts:24
  - repo/apps/service/src/modules/payments/refundsService.ts:30
  - repo/apps/service/src/modules/payments/refundsService.ts:35
  - repo/apps/service/tests/integration/payments/refundIntegrity.test.ts:73
  - repo/apps/service/tests/integration/payments/refundIntegrity.test.ts:94
  - repo/apps/service/tests/integration/payments/refundIntegrity.test.ts:116
  - repo/apps/service/tests/integration/payments/refundIntegrity.test.ts:166
- Reinspection notes:
  - Service now enforces orderId/paymentIntentId linkage and refundable payment status.
  - Dedicated integration suite now validates linkage, status eligibility, and over-refund blocking.

### 4) Medium: Security documentation pipeline claim mismatches implemented middleware model
- Previous finding: Docs state scopeMiddleware pipeline not present in code.
- Current status: Fixed
- Evidence:
  - repo/docs/security-model.md:16
  - repo/docs/security-model.md:18
- Reinspection notes:
  - Documentation now states auth -> requirePermission -> validate and explicitly notes inline scope filtering.

### 5) Medium: Coverage gaps for lifecycle/recovery requirements
- Previous finding: Traceability document marks several critical areas with missing tests.
- Current status: Fixed
- Evidence:
  - repo/docs/reviewer-traceability.md:34
  - repo/docs/reviewer-traceability.md:35
  - repo/docs/reviewer-traceability.md:36
  - repo/docs/reviewer-traceability.md:75
  - repo/docs/reviewer-traceability.md:94
  - repo/apps/service/tests/integration/orders/orderLifecycleJobs.test.ts
  - repo/apps/service/tests/integration/rules/simulationEngine.test.ts
  - repo/apps/service/tests/integration/updates/rollbackOrchestrator.test.ts
- Reinspection notes:
  - Traceability now maps those requirements to concrete test files instead of untested markers.

### 6) Low: Signed MSI and High-DPI fulfillment static proof gap
- Previous finding: Static evidence cannot prove signed artifact validity and DPI rendering quality.
- Current status: Cannot confirm statistically
- Evidence:
  - repo/README.md:51
  - repo/apps/desktop/src/main/windowManager.ts:18
- Reinspection notes:
  - This is a verification-boundary item, not a code fix item; manual verification remains required.

## Conclusion
- Previously reported material code-level defects (scope bypass, TLS packaged fail-open path, refund linkage/integrity, and doc mismatch) now show static evidence of being fixed.
- Remaining open item is verification-boundary only (signed MSI and High-DPI), which still requires manual validation.

## Boundary
- Static-only reinspection.
- No runtime execution, no Docker, no tests executed.