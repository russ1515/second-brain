# Commercial core — active policy

## Public plans and price source of truth

Only `free`, `pro`, and `pro_max` are public v1 plans. Amounts are persisted in minor USD units:

| Plan | Monthly | Yearly | Public |
|---|---:|---:|---|
| Free | 0 | 0 | yes |
| Pro | 499 | 4900 | yes |
| Pro Max | 1500 | 15000 | yes |

Team, School and Enterprise remain legacy/internal. Boot creates missing rows but never updates an existing plan. `PlanVersion` snapshots price, currency, quotas, features and fallback ratio.

Sprint 7 activates the public pricing above through an additive, versioned
migration. It changes only an active public plan whose price or currency is
different, closes that plan's current snapshot, appends a new snapshot and
records a system audit event. It preserves quotas, features, fallback ratios,
subscriptions, payments, billing periods, quota cycles, reservations and usage
history. Provider-side price configuration and any repricing of an already-paid
external subscription remain **BUSINESS_DECISION_REQUIRED**.

No new detailed resource limits were invented. Existing legacy quota values are preserved for compatibility and mapped only where their units are unambiguous (`ai_questions`) or explicitly converted (`voice_minutes` to seconds).

## Subscription versus entitlements

Subscription states include Free, payment pending, active, trialing, past due, canceled, incomplete, expired and payment failed. Entitlements separately consider account state, paid period validity, the plan snapshot and active overrides. A canceled paid subscription with time remaining keeps its paid window; it does not receive a fresh Free cycle.

Immediate paid cancellation/refund and mid-cycle upgrade prorata are **BUSINESS_DECISION_REQUIRED**.

## Overrides

`EntitlementOverride` supports time-bounded, reasoned, reversible quota/feature overrides. The persistence and resolver are **IMPLEMENTED**. Complete admin mutation endpoints and UI are **PLANNED**.
