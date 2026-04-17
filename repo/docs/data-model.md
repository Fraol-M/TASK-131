# NexusOrder Desk -- Data Model

## MongoDB Collections

| Collection | Primary Key | Description |
|------------|-------------|-------------|
| `users` | UUID `_id` | User accounts with role and scope |
| `sessions` | UUID `_id` | Active JWT sessions |
| `failed_logins` | UUID `_id` | Brute-force lockout tracking (TTL index) |
| `catalog_items` | UUID `_id` | Product catalog with eligibleScopes |
| `vendors` | UUID `_id` | Vendor/supplier records |
| `carts` | UUID `_id` | Active shopping carts (one per user) |
| `cart_items` | UUID `_id` | Line items within a cart |
| `orders` | UUID `_id` | Order documents with state machine |
| `order_items` | UUID `_id` | Line items within an order |
| `order_sequences` | `'order_seq'` | Auto-incrementing order number counter |
| `payment_intents` | UUID `_id` | Payment records (one per order) |
| `refunds` | UUID `_id` | Refund records linked to payment intents |
| `reconciliation_imports` | UUID `_id` | CSV import metadata |
| `reconciliation_rows` | UUID `_id` | Individual reconciliation row results |
| `rules` | UUID `_id` | Business rules with condition AST |
| `rule_versions` | UUID `_id` | Immutable rule version snapshots |
| `rule_conflicts` | UUID `_id` | Detected rule conflicts |
| `rule_simulations` | UUID `_id` | Simulation execution records |
| `rma_requests` | UUID `_id` | Return merchandise authorization requests |
| `reason_codes` | UUID `_id` | After-sales reason code definitions |
| `order_audit_events` | UUID `_id` | Append-only audit trail |
| `backups` | UUID `_id` | Backup metadata with checksums |
| `notifications` | UUID `_id` | User notification records |
| `notification_preferences` | UUID `_id` | Per-user notification opt-in/out |
| `device_fingerprints` | UUID `_id` | Device fingerprint consent + hashes |
| `settings` | `'global'` | Application settings singleton |
| `rollback_events` | auto | Update rollback event log |
| `recovery_checkpoints` | UUID `_id` | Write-ahead checkpoint records |
| `checkout_attempts` | UUID `_id` | Checkout throttle tracking (TTL index) |
| `blacklists` | UUID `_id` | Blacklisted user records |

## Key Relationships

- `Order.userId` -> `users._id`
- `Order.userScopeSnapshot` -- captured at checkout for scope isolation
- `OrderItem.orderId` -> `orders._id`
- `OrderItem.catalogItemId` -> `catalog_items._id`
- `PaymentIntent.orderId` -> `orders._id` (one-to-one)
- `Refund.paymentIntentId` -> `payment_intents._id`
- `Refund.orderId` -> `orders._id` (must match intent's orderId)

## Indexes

Defined in `database/mongo-indexes/indexes.ts`. Key indexes include TTL on `failed_logins`, unique on `sessions`, compound on `orders` state + scope fields, and text search on `catalog_items`.
