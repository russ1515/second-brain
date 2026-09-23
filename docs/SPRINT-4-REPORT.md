# SECOND BRAIN ADMIN — SPRINT 4 REPORT

**Date:** 16 September 2026
**Scope:** provider-usage ledger, cost attribution and Cost Center validation only. Sprint 5 was not started.

## Executive summary

The Sprint 4 foundation is implemented and validated against an isolated, real PostgreSQL 16 instance. The cost ledger records logical provider operations and immutable attempts, preserves retry history, attributes usage to the relevant user, plan, feature, provider and model where known, and does not turn unknown costs into `$0`.

The automated PostgreSQL, API, typecheck and build gates pass. The only acceptance item not visually completed is the real-browser Admin flow: the local browser-automation webview could not attach despite repeated retries. API-level MFA, RBAC, step-up, session and Cost Center endpoint validation did pass against the same isolated system.

## Validation environment

- Dedicated Docker PostgreSQL 16 database: `second_brain_sprint4_test`, exposed only on loopback and labelled as disposable Sprint 4 validation infrastructure.
- Dedicated Docker Redis instance, also loopback-only and disposable.
- No production database, production credentials, production provider account or production snapshot was used.
- The test API used the offline `echo` LLM and fake speech/embedding providers. Qdrant was intentionally unavailable in this narrow cost-ledger environment; this is recorded below as a remaining condition rather than hidden.
- The temporary Finance/MFA browser fixture was removed after validation.

## Database migration status — PASS

- All **57** migrations are present and applied in chronological order.
- Sprint 4 migration applied: `20260916090000_sprint4_provider_cost_ledger`.
- Direct PostgreSQL inspection found 57 completed migrations and no unfinished or rolled-back migration.
- Final `prisma migrate status` result: **Database schema is up to date.**

One intermediate `prisma migrate status` invocation returned an internal schema-engine error while local processes were active. It was retried after a clean local shutdown and passed; direct inspection confirmed there was no migration divergence, so no destructive migration action was taken.

## Provider Usage Ledger and attribution — PASS

The implementation introduces a logical `ProviderUsageOperation` plus immutable `ProviderUsageAttempt` records. An operation carries user, plan, billing-cycle/quota context, feature, provider, model, request correlation and units. Attempts retain retry sequencing and provider-returned measurements independently, so retries are observable rather than folded into a single opaque call.

Recorded unit categories include input, cached input, output and reasoning tokens; STT/TTS seconds; OCR/vision units; embedding tokens; search units; and explicitly named other provider units. The ledger supports an unattributed state rather than inventing an owner.

The real PostgreSQL suite validated retry retention, idempotency-safe operation recording, quota blocking and a deliberate attempted-provider-call-after-block anomaly. It also validates that a normal blocked operation is distinct from a provider call that leaks after `BLOCKED`.

## Cost semantics and pricing catalog — PASS

The versioned pricing catalog has effective dates, currency, source reference validation, status controls and overlap protection. A new version can close an open predecessor atomically; this produces a `PROVIDER_PRICING_VERSION_SUPERSEDED` audit event.

Cost calculation uses the following explicit states:

- `MEASURED` — measured provider units and an applicable price are available.
- `ESTIMATED` — an explicitly justified approximation is used.
- `UNKNOWN` — units are known but no applicable provider price is available.
- `NOT_INSTRUMENTED` — the metric itself is not collected.
- `INSUFFICIENT_DATA` / `NOT_AVAILABLE` — presentation states used where an aggregate cannot safely be calculated.

`knownUsd` is now `null` for an incomplete total. A separately named `knownSubtotalUsd` is available for reconciliation, so a partial subtotal cannot be mistaken for the complete cost. Decimal price snapshots preserve ordinary decimal notation (including very small cached-token rates) rather than scientific notation.

The commercial plan catalog remains informational and does not modify quota behavior:

| Plan | Published price |
| --- | --- |
| FREE | $0 |
| PRO | $19.99/month or $199/year |
| PRO MAX | $49.99/month or $499/year |

No daily or weekly limits were added. PRIMARY → FALLBACK → BLOCKED remains owned by the quota engine.

## Engine coverage — PASS for instrumentation, PARTIAL for paid-provider observation

| Area | Ledger attribution / status behavior |
| --- | --- |
| Tutor | Provider/model/feature operation captured when a provider returns measurements. |
| Language Text | Kept distinct from Language Voice; measured text-token path tested. |
| Language Voice / Voice | STT/TTS seconds captured; offline test coverage is explicitly `ESTIMATED` where provider billing data is unavailable. |
| Documents / OCR / Vision | OCR and vision units supported and tested as observed/estimated data. |
| Embeddings | Embedding tokens captured; no price becomes `UNKNOWN`, never zero. |
| Research / Deep Research | Search units and provider/model attribution supported. |
| Academic Workspace | Routes through the relevant document, embedding and research feature attribution. |

Advanced percentiles, forecasting, simulations and anomaly projections do not fabricate a result. They remain `INSUFFICIENT_DATA` or `NOT_INSTRUMENTED` until an adequate real dataset exists.

## Cost Center, security and access control — PASS at API level

- Finance and Super Admin can read Cost Center data; `TECH_OPS` and `ANALYTICS` no longer receive cost-read access by default.
- Cost responses mask user identity instead of exposing raw user IDs.
- Read endpoints use `Cache-Control: no-store`.
- The Cost Center exposes coverage, unknown pricing, unattributed usage, retries, blocked operations and attempted provider calls after blocking; it does not mutate prices, quotas, plans, routing or user rights.
- Admin eligibility is checked before MFA/session resolution, preventing persistence of an implicit bootstrap role before MFA succeeds.
- Automated HTTP validation passed for unauthenticated access (401), normal learner access (403), Finance MFA/TOTP, bad/stale step-up denial, valid step-up, pricing version creation and pricing audit history.

## Browser Admin validation — PARTIAL / environment blocker

The Admin web application compiled and its local server was started against the isolated API. The browser automation controller repeatedly failed to attach its webview (`Timed out waiting for the Browser webview to attach`), including direct local-tab creation attempts. Therefore this report does **not** claim a visual login, TOTP screen, logout or Cost Center rendering pass.

This is an automation-environment blocker, not an API authentication failure: the equivalent real API path passed with MFA/TOTP, RBAC, stale step-up and session protections. A short manual browser smoke test remains required once the local browser webview is available.

## Regression gates — PASS

| Gate | Result |
| --- | --- |
| `pnpm typecheck` | PASS (shared, API, Admin and Mobile) |
| API regression suite | PASS — 108/108 |
| Shared regression suite | PASS — 58/58 |
| `test:sprint4:postgres` | PASS — 6/6 on real PostgreSQL |
| `test:sprint4:http` | PASS — 1/1 with API MFA/RBAC and Cost Center assertions |
| API build | PASS |
| Admin web build | PASS |
| Mobile web export | PASS |
| `git diff --check` | PASS (Windows CRLF warnings only) |
| Known local test-secret markers in Admin/Mobile bundles | Absent |

## Problems corrected during Sprint 4

1. A tiny cached-token rate was serialized as scientific notation; price snapshots now preserve exact decimal text.
2. The offline `echo` LLM provider existed but could not be selected during isolated startup; it is now selectable for safe validation.
3. Cost aggregation had a silent attempt-row cap; it was removed so totals cannot silently omit rows.
4. Incomplete cost aggregates could look like complete totals; `knownUsd` now remains null and the reconciliable subtotal is explicitly named.
5. Pricing creation now validates status, public HTTPS source references, effective ranges and atomic supersession of an open version.
6. Admin identity resolution could persist a bootstrap role before MFA; eligibility is now read without mutation before MFA/session validation.
7. Cost access was narrowed and raw user identifiers were removed from Cost Center responses.
8. Cost Center/frontend contract mismatches were corrected for status labels, pricing-unit display, anomalies and unavailable data.

## Remaining conditions

1. **Browser smoke test:** repair/enable the local browser webview, then perform the visual Admin login → bad TOTP → valid TOTP → Cost Center → logout check.
2. **Real-provider confirmation:** run an approved staging test with providers that return real billable usage and provider pricing references. This sprint intentionally did not send paid production-provider traffic.
3. **Staging snapshot:** no staging snapshot was available. Only the clean, dedicated PostgreSQL database was validated.
4. **Provider cost adjustments:** the schema supports adjustments, but an Admin adjustment workflow and its cost-center reconciliation view are not yet implemented; it remains deliberately PARTIAL rather than implied.
5. **Qdrant/document-storage E2E:** the cost-ledger test environment did not include Qdrant, so full vector-store document E2E needs a separate staging smoke test.
6. **Advanced analytics:** percentile, forecast and simulation output remains correctly unavailable until sufficient measured data accumulates.

## Conclusion

**SPRINT 5 READY WITH CONDITIONS**

The Sprint 4 telemetry and cost-foundation gates are reliable enough to progress, subject to the six conditions above—especially the outstanding visual browser smoke test and a later approved real-provider staging observation. No Sprint 5 work was started.

**STOP.**
