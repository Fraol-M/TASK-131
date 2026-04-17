# NexusOrder Desk -- State Machines

## Order Lifecycle State Machine

**Implementation**: `apps/service/src/modules/orders/orderStateMachine.ts`

```
draft --> submitted --> approved --> paid --> allocated --> shipped --> delivered --> closed
  |          |            |
  +-> cancelled  cancelled  cancelled
```

### Transitions

| From | Allowed To |
|------|-----------|
| draft | submitted, cancelled |
| submitted | approved, cancelled |
| approved | paid, cancelled |
| paid | allocated |
| allocated | shipped |
| shipped | delivered |
| delivered | closed |
| closed | (terminal) |
| cancelled | (terminal) |

### Auto-cancel

Orders in `submitted` state have an `autoCancelAt` timestamp (default: 30 minutes). The `autoCancelJob` runs every 5 minutes and cancels expired orders.

### Auto-close

Orders in `delivered` state have an `autoCloseAt` timestamp (default: 14 days). The `autoCloseJob` runs hourly and closes delivered orders -- but skips any order with `afterSalesState !== 'none'` (open RMA).

## After-Sales State Machine

**Implementation**: `apps/service/src/modules/orders/orderStateMachine.ts`

```
none --> rma_requested --> rma_approved --> return_in_transit --> returned
                                                                    |
                                               +--> refund_pending --> refunded --> after_sales_closed
                                               |
                                               +--> exchange_pending --> exchanged --> after_sales_closed
```

### RMA Eligibility

Only orders in `delivered` or `closed` state can have an RMA created.

## Split/Merge Eligibility

- **Split**: orders in `submitted` or `approved` state
- **Merge**: orders in `draft` or `submitted` state
