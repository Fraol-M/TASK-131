# NexusOrder Desk -- Rules Engine

## Overview

The rules engine supports priority-ordered business rules with conflict detection, cycle detection, and deterministic simulation.

**Implementation**: `apps/service/src/rules/`

## Rule Structure

Each rule has:
- **Conditions**: AST with AND/OR groups and leaf conditions (field, operator, value)
- **Actions**: array of typed actions with parameters
- **Priority**: integer (lower = higher priority)
- **Scope**: user scope for targeting
- **Time window**: optional start/end dates, time-of-day, day-of-week constraints
- **Status**: draft, active, inactive, archived

## Condition Operators

`eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `in`, `not_in`, `contains`, `not_contains`, `is_null`, `is_not_null`

## Rule Evaluation

**Implementation**: `ruleEvaluator.ts`

1. Check rule status (must be `active`)
2. Check time window (if defined)
3. Evaluate condition tree recursively against context object

## Conflict Detection

**Implementation**: `conflictDetector.ts`

Detects overlapping scopes, priority clashes, and circular dependencies between active rules.

## Simulation

**Implementation**: `simulationEngine.ts`

Simulates a rule against historical orders. Results are deterministic (orders sorted by `_id` before evaluation). Simulation records are persisted in `rule_simulations` collection.

## API Endpoints

- `GET /api/rules` -- list all rules
- `POST /api/rules` -- create a new rule (starts as draft)
- `GET /api/rules/:id` -- get rule by ID
- `PATCH /api/rules/:id` -- update rule fields
- `POST /api/rules/:id/activate` -- activate a rule
- `POST /api/rules/:id/deactivate` -- deactivate a rule
- `GET /api/rules/conflicts` -- flat conflict list
- `GET /api/rules/conflicts/all` -- conflicts + cycles
- `POST /api/rules/simulations` -- run simulation
