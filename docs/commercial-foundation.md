# Commercial core — Sprint 1

## Public plans and price source of truth

Only `free`, `pro`, and `pro_max` are public v1 plans. Amounts are persisted in minor USD units:

| Plan | Monthly | Yearly | Public |
|---|---:|---:|---|
| Free | 0 | 0 | yes |
| Pro | 1999 | 19900 | yes |
| Pro Max | 4999 | 49900 | yes |

Team, School and Enterprise remain legacy/internal. Boot creates missing rows but never updates an existing plan. `PlanVersion` snapshots price, currency, quotas, features and fallback ratio.

No new detailed resource limits were invented. Existing legacy quota values are preserved for compatibility and mapped only where their units are unambiguous (`ai_questions`) or explicitly converted (`voice_minutes` to seconds).

## Subscription versus entitlements

Subscription states include Free, payment pending, active, trialing, past due, canceled, incomplete, expired and payment failed. Entitlements separately consider account state, paid period validity, the plan snapshot and active overrides. A canceled paid subscription with time remaining keeps its paid window; it does not receive a fresh Free cycle.

Immediate paid cancellation/refund and mid-cycle upgrade prorata are **BUSINESS_DECISION_REQUIRED**.

## Overrides

`EntitlementOverride` supports time-bounded, reasoned, reversible quota/feature overrides. The persistence and resolver are **IMPLEMENTED**. Complete admin mutation endpoints and UI are **PLANNED**.
