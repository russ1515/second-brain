# SECOND BRAIN ADMIN — GATE 5.5 VALIDATION REPORT

**Date:** 17 September 2026
**Scope:** Sprint 5 final integration and E2E validation only. No Sprint 6 work was started.

## 1. Environment

The worktree was already substantially dirty before this Gate. That state was preserved. The Gate changed only the existing Sprint 5 PostgreSQL integration suite and added this report; it did not reset, deploy, restart, or alter a production service.

The dedicated non-production PostgreSQL container observed during this Gate was:

```text
sb-sprint4-pg  Up 26 hours (healthy)  127.0.0.1:15434->5432/tcp
```

No production database, provider account, quota, plan, routing rule, Docker lifecycle, or application pool setting was changed.

## 2. P1001 Root Cause

**Status: NOT CONFIRMED — environment failure suspected, application failure not demonstrated.**

Evidence collected across the Sprint 5 and Gate 5.5 attempts:

- a prior real Prisma targeted run connected and passed its redaction/health checks (2/2);
- the subsequent concurrency run failed in `prisma.$connect()` with `P1001`, before fixtures, ingestion requests, Bug Group updates, or a business transaction began;
- the observed database activity did not show blocked sessions;
- the container is currently reported healthy and its port is published, but current `docker exec`, host TCP, and Prisma-status attempts stall in the Windows runner without returning an application error;
- the fresh `prisma migrate status` attempt was therefore interrupted without a result. No migration action was taken.

This is compatible with intermittent Windows/Docker Desktop/runner reachability or command-lifecycle instability. It is not proof of a SQL deadlock, Prisma pool defect, Error Event race, or application defect. The Gate did not lower concurrency, increase business timeouts, restart Docker, or change the pool simply to make a test pass.

## 3. PostgreSQL Stability

**Status: NOT VERIFIED.** The container health is positive, but an internal `pg_isready` command and a bounded host/Prisma validation could not complete reliably through the current runner. A healthy container alone does not prove the host-to-container path required by Prisma.

Required reproducible sequence once the runner is responsive:

1. verify container status and published port;
2. run `pg_isready` inside the dedicated test container;
3. run a bounded TCP probe to `127.0.0.1:15434`;
4. obtain the test-container credential only in process memory, run `prisma migrate status`, then run the PostgreSQL suite;
5. if `P1001` recurs, collect only grouped connection state and sanitized container lifecycle/error counts.

## 4. Migration Status

**Last verified real status: PASS (pre-Gate).** Prisma previously found **59 migrations** and reported the dedicated test schema up to date.

The two Sprint 5 migrations remain present:

- `20260917090000_sprint5_diagnostics_control_center`
- `20260917100000_sprint5_report_observed_request`

**Fresh Gate status: NOT VERIFIED** because the read-only Prisma command did not return. There is no observed divergence and no destructive correction was attempted.

## 5. 20-Concurrent-Ingestion Result

**Status: NOT VERIFIED.** The reusable PostgreSQL test is real, not synthetic: it uses `PrismaClient`, sends 20 simultaneous same-fingerprint Error Events, and asserts one Bug Group, 20 occurrences, exactly five affected fixture users, no lost event, no duplicate group, and retry idempotency. It cannot be honestly marked PASS until the dedicated database path is stable and that test completes.

## 6. Fingerprint Concurrency

**Status: NOT VERIFIED.** The same PostgreSQL suite covers same-fingerprint grouping, unique ingest IDs, SQL uniqueness constraints, affected-user membership, and counters. It was not runnable during this Gate because the failure occurs before the test setup reaches application code.

## 7. Backpressure Result

**Status: PARTIAL.** The bounded ingestion/backpressure implementation remains in place. The prior `P1001` occurs before an ingest transaction, so it is not evidence that backpressure loses events, changes counters, deadlocks, or masks an error. Those runtime properties remain **NOT VERIFIED** until the 20-event PostgreSQL scenario completes repeatedly.

## 8. Raw Events vs Bug Aggregates

**Status: NOT VERIFIED.** The PostgreSQL suite contains direct assertions for raw Error Events, `occurrenceCount`, `affectedUsersCount`, membership, first/last seen semantics, and uniqueness. No fresh full run could be completed.

## 9. Report Correlation

**Status: PARTIAL — implementation and static regression coverage verified; E2E PostgreSQL execution pending.**

The Gate found a coverage gap, not a changed product behavior. `UserReportService` already constrains observed-request matching to the same user, environment and correlation time window; when a safe route is supplied, it also applies exact route equality.

Two PostgreSQL regressions were added to [sprint5-postgres.integration.test.cjs](../apps/api/test/sprint5-postgres.integration.test.cjs):

- same user/request ID but `/learn` event and `/tutor` report remains `independent` / `unconfirmed`, with no persisted Bug Group link;
- same user/request ID/route but an event aged 31 minutes remains `independent` / `unconfirmed`, with no persisted Bug Group link.

`node --check apps/api/test/sprint5-postgres.integration.test.cjs` passed. The database execution of these cases is pending a stable test connection.

## 10. Redaction

**Status: PARTIAL.** A prior direct PostgreSQL targeted run passed redaction and health checks (2/2). The full Gate suite has explicit persisted-field sentinels for passwords, authorization headers, JWTs, refresh tokens, OTP/TOTP material, API keys, SMTP-like secrets, email, IP, stack and raw context. It was not re-executed during this Gate because the database setup path is unstable.

No secret was printed while collecting the Gate evidence. No claim is made for Admin HTTP responses, Audit Log rows, or process logs until the full runtime suite and HTTP/browser path can complete.

## 11. Bug Workflow

**Status: NOT VERIFIED.** The real PostgreSQL suite covers human-only transitions from `NEW` through `RESOLVED`, invalid-transition refusal, historical evidence, and meaningful reopening. It did not execute in this Gate.

## 12. Regression / Reopen

**Status: NOT VERIFIED.** Reopening after a significant new occurrence is covered in the same unexecuted PostgreSQL workflow suite.

## 13. Incident Linking

**Status: NOT VERIFIED.** Existing PostgreSQL coverage creates linked bugs/incidents and checks relations, status, timeline and audit evidence; it could not be run against the dedicated database.

## 14. Support Case

**Status: NOT VERIFIED.** The PostgreSQL suite covers User Report → Support Case → Bug/Incident link with privacy boundaries. Runtime validation is blocked by the same database connection condition.

## 15. Rule-Based Diagnostic

**Status: NOT VERIFIED.** The suite has deterministic provider-timeout fixtures and verifies a rule-based diagnosis without a provider call or fabricated `CONFIRMED` cause. It has not completed on real PostgreSQL in this Gate.

## 16. AI Diagnostic E2E

**Status: NOT VERIFIED.** No real provider test execution was available. No provider usage, `ADMIN_DIAGNOSTIC` attribution, ledger entry, or cost-center attribution is claimed.

## 17. Prompt Injection

**Status: PARTIAL.** The implemented model treats User Reports as untrusted data and correlation regressions do not elevate report prose into a confirmed cause. The malicious-report runtime test remains pending the PostgreSQL/API path; it is not marked PASS.

## 18. Admin Browser

**Status: NOT VERIFIED.** The browser controller had no attached tabs. Creating the local Admin login tab at `http://127.0.0.1:8083/login` timed out waiting for the browser webview to attach. The earlier historical login page render followed by `Failed to fetch` before MFA remains the only browser evidence.

## 19. MFA

**Status: NOT VERIFIED.** Because Admin → API connectivity and browser control are unavailable, invalid TOTP, valid TOTP, recovery, session expiry, logout, and Control Center access were not simulated or claimed.

## 20. RBAC

**Status: NOT VERIFIED.** The HTTP suite contains guarded test coverage for normal-user `403`, SUPPORT sensitive-detail restrictions, TECH_OPS technical access with redaction, diagnostic safety and step-up. It requires a loopback API plus dedicated test credentials and did not run. Browser RBAC is likewise not verified.

## 21. Responsive

**Status: NOT VERIFIED.** No browser session could attach, so 1440/1024/768 validation was not performed.

## 22. i18n / Themes

**Status: NOT VERIFIED.** No browser session could attach, so FR/EN and light/dark critical-path validation was not performed.

## 23. Sprint 4 Open Conditions

All inherited conditions remain open exactly as before:

- real staging provider responses;
- Qdrant E2E confirmation and outstanding cost adjustments;
- Cost Center browser validation.

None has been converted to PASS.

## 24. Corrections Made

No application behavior was modified and no new feature was added.

The only Gate correction is regression coverage for two evidence-boundary cases in observed-request correlation: supplied-route mismatch and a report outside the 30-minute correlation window. It protects against falsely merging a report into a Bug Group when the available facts do not support it.

## 25. Regression Results

| Check | Result | Evidence |
| --- | --- | --- |
| Shared tests | **PASS** | `pnpm --filter @second-brain/shared test`: 58/58 passed, 0 failed |
| Sprint 5 PostgreSQL suite | **NOT VERIFIED** | controlled test DB connection setup stalls before it can be safely run |
| Sprint 5 HTTP suite | **NOT VERIFIED** | loopback API and test credentials/browser prerequisites unavailable |
| API tests | **NOT VERIFIED** | `prisma generate` stalled before build/test files began; controlled interruption, exit 1 |
| Sprint 1–4 suites | **Not rerun in this Gate** | no new behavior change; prior outcomes are preserved but not re-certified here |

## 26. Typecheck

**NOT VERIFIED as a complete Gate run.** `pnpm typecheck` completed shared and Admin checks, then API/Mobile did not return a final result in the current runner. The command was interrupted rather than recorded as a pass.

## 27. Builds

| Build | Gate 5.5 status |
| --- | --- |
| API | **NOT VERIFIED** — the API regression stalled at `prisma generate` before the build/tests began |
| Admin Web | **NOT VERIFIED** — `expo export --platform web --output-dir dist` produced no further progress for about 60 seconds and was interrupted; no compiler error was produced |
| Mobile Web | **NOT VERIFIED** — `expo export --platform web` produced no further progress for about 150 seconds and was interrupted; no compiler error was produced |

The previously documented Sprint 5 API/Admin/Mobile build successes remain historical evidence only; they are not substituted for a fresh Gate result.

## 28. Remaining Conditions

1. Restore reproducible host → Docker PostgreSQL test connectivity and execute `migrate status`, then run the 20-event PostgreSQL suite repeatedly.
2. Run the loopback API HTTP suite with a dedicated TOTP-enrolled Admin, normal user, and role-specific fixtures; never display credentials or secrets.
3. Restore browser-webview control and validate Admin login/MFA/RBAC/critical action step-up, responsive layouts, themes and FR/EN manually or through approved browser automation.
4. Re-run the complete typecheck, API tests, API/Admin/Mobile builds and historical Sprint suites with explicit exit results.
5. Preserve the open Sprint 4 staging-provider, Qdrant E2E and Cost Center browser conditions until real proof is collected.

## 29. Sprint 6 Readiness

# SPRINT 6 NOT READY

Critical PostgreSQL concurrency, Admin browser/MFA/RBAC, loopback HTTP, and current full regression evidence are not yet available. The Gate stops here; Sprint 6 must not begin without explicit user validation.

## OVH P1 ADDENDUM — 25 September 2026

**Scope.** This addendum records later evidence from the dedicated, non-production OVH staging environment. It preserves the historical Windows findings above. For the validations named below, this section supersedes the earlier `NOT VERIFIED` result; no untested condition is upgraded by implication.

### Closed Gate 5.5 conditions

| Validation | Status | Verified evidence |
| --- | --- | --- |
| Linux runner and isolated PostgreSQL | **PASS** | The Linux runner build completed; PostgreSQL and runner became healthy. |
| Prisma migrations | **PASS** | 59 migrations were present and `prisma migrate status` reported the schema up to date. |
| Sprint 5 PostgreSQL validation | **PASS** | Three retained real PostgreSQL runs completed; final run `20260923144224-423eb555` was 10/10, including 20 simultaneous ingestions, retry idempotency, redaction/persistence, report correlation, telemetry retry idempotency, support/report relationships, and Bug/Incident/Support/Diagnostics workflow evidence. |
| HTTP/security P1 | **PASS** | The retained Sprint 5 HTTP suite completed 3/3 against staging, including authorization, role boundaries, MFA/step-up paths, privacy sentinels, and normal-learner Admin denial. |
| Cost Center HTTP | **PASS** | The retained Cost Center HTTP validation completed 1/1. |
| Admin browser MFA/RBAC/step-up | **PASS for the stated P1 flows** | SUPER_ADMIN invalid/valid TOTP, logout/session invalidation, learner suspend/reactivate; TECH_OPS Bug triage and deterministic `rule_based` diagnostic after MFA step-up (`admin-browser-techops-diagnostics-20260925-techops-diagnostics-r3.json`) plus Incident transition; SUPPORT cases, untrusted/redacted treatment and sensitive denial; and FINANCE Cost Center state display were exercised. |
| Admin quality routes | **PASS for the stated P1 route/viewport scope** | `admin-browser-quality-full-20260925-quality-full-r5.json` passed on `/dashboard`, `/bugs`, `/incidents`, `/support`, and `/costs` at recorded desktop/tablet/mobile viewports, keyboard focus checks, EN/FR persistence, automated WCAG A/AA checks, and the three Dashboard progress-bar range semantics. This is not a claim for routes or assistive technologies outside that explicit scope. |
| Qdrant document lifecycle | **PASS — bounded scope** | `qdrant-document-e2e-20260925031227-qdrant.json` verifies real staging document creation, vector presence in Qdrant, owner retrieval, cross-user isolation, and purge after deletion. The configured embedding provider was fake; this is not evidence of an external embedding provider, provider pricing, or provider usage instrumentation. |

Retained evidence is under the run-specific OVH P1 staging evidence directory, including `sprint5-http-retest-20260923T205504Z.tap`, the role-specific Admin browser results, Cost Center browser result, Qdrant document E2E result, and browser-quality result. No credential, token, TOTP seed, or provider key is recorded in this report.

**Image provenance.** The final P1 Admin container was rebuilt from the reviewed isolated build context containing the accessibility delta and was validated before replacement. The OVH repository commit recorded by the browser evidence remains the prior staging SHA until the local patch commits are transferred; no production image or production service was changed.

### Conditions still open

- **Real providers / provider instrumentation: NOT_VERIFIED.** No new staging provider credential was used and no attributable external provider call, provider ledger record, or real provider price observation was established.
- Any Admin route, device, locale, screen-reader combination, or accessibility behavior outside the explicit quality-run scope remains **NOT_VERIFIED** rather than implied PASS.
- The fake-embedding Qdrant validation does not close the real-provider condition.

## Sprint 6 readiness (updated)

# SPRINT 6 NOT READY

The former Linux/PostgreSQL, HTTP/security, Cost Center HTTP, and stated P1 Admin-browser blockers are closed. Sprint 6 remains blocked until real provider/instrumentation validation is performed with a new staging-only credential and attributable evidence; no value is inferred as zero or PASS without that evidence.

## Browser-quality evidence supersession — 25 September 2026

This section supersedes the earlier five-route Browser-quality row and its corresponding route/device wording above. `admin-browser-quality-full-20260925-quality-all-r4.json` is **PASS** for all 15 protected navigation sections at four recorded viewports: 90 layout samples, 60 keyboard-focus samples, EN/FR persistence, zero automated WCAG A/AA violations, and three verified Dashboard progress-bar ranges. Role-specific evidence still covers the dynamic User and Bug details. Manual screen-reader/assistive-technology validation remains **NOT_VERIFIED**; automated Axe and keyboard evidence does not imply a human assistive-technology review.

## Official staging-source reconciliation — 25 September 2026

The official `codex/staging-ovh-2026-09-23` ref was advanced by an ordinary fast-forward from `899e42c` to `d013b70c8f47db1bb57e84a8df64a1c4c6f1a2b4`; no force-push, reset, migration, or production action occurred. The reconciliation retains the requested commits `2d95ed8`, `a73dc66`, `df2929a`, and `b45b28a`, their prerequisite P1 Admin fixes, the mobile root-navigation correction, and the separate staging study-screen correction `9b1823c`.

The clean OVH checkout then performed `pull --ff-only` to `d013b70`; all 59 Prisma migrations remained present. The Admin image was rebuilt from that checkout with the frozen lockfile, passed a network-isolated Admin typecheck, and only the Admin container was recreated successfully. The previous image remains tagged as a rollback artifact.

The source-provenance browser run `20260925-source-d013-r3` passed SUPER_ADMIN login/wrong-TOTP rejection/correct-TOTP acceptance/logout invalidation/step-up suspend-reactivate, TECH_OPS triage and deterministic rule-based diagnostics, Incident transition, FINANCE Cost Center literal-state display, EN/FR, and the full protected-route quality audit. The Support fixture is intentionally consumable by its transition test; after controlled fixture regeneration, `admin-browser-support-stepup-20260925-source-d013-support-r4.json` passed its untrusted/redacted/sensitive-denial and step-up retry checks. The earlier `r2` files are retained as invalid harness evidence only: that runner omitted `/api` from a direct test endpoint and is not used for a Gate result. The mobile frozen-install, Shared build, Mobile typecheck, and Mobile Web export proof container exited `0` on the same staging SHA.

### Provider/instrumentation readiness — still open

This is **NOT_VERIFIED**, not a failure disguised as zero cost. The live P1 API is configured with the non-billable `echo` LLM and `fake` embeddings; no Gemini key is present. Read-only staging catalog inspection found no Gemini pricing version with an effective, sourced text-rate pair. A blank out-of-repository staging-only secret file was prepared with owner-only permissions for a future credential, but no credential, provider call, quota reset, pricing insertion, or provider configuration change was made.

Before this last Gate can pass, a human must supply a new staging-only Gemini credential directly on the VPS and create an active, source-referenced Finance pricing version for the exact approved model through the protected Finance/MFA workflow. Only then may one short authenticated learner operation be made, with durable operation/attempt/user/plan/quota/provider/model/token/cost evidence and Cost Center aggregation. A real Gemini embedding → Qdrant → owner-scoped retrieval is separately possible, but its current adapter exposes observed embedding units rather than provider token usage; its status must remain **ESTIMATED** (or **UNKNOWN** without pricing), never falsely **MEASURED**.

## Sprint 6 readiness (source-reconciled)

# SPRINT 6 NOT READY

All reconciled source, Linux/PostgreSQL, HTTP/security, and stated P1 Admin/browser evidence is retained. The sole remaining required blocker is real-provider attribution and pricing evidence; no Sprint 6 work may begin until that bounded validation actually passes.

## OpenAI provider preparation addendum — 25 September 2026

**Scope.** This is source and staging-harness preparation only. The persistent
P1 service remains `LLM_PROVIDER=echo` with `EMBEDDINGS_PROVIDER=fake`. No
OpenAI credential, external request, price insertion, service recreation, or
persistent provider activation occurred during this work.

This supersedes only the earlier **Gemini-specific proposed provider path** in
this historical report. The remaining requirement is provider-attributed,
source-priced evidence; the prepared future path is OpenAI, not Gemini.

| Preparation boundary | Status | Evidence |
| --- | --- | --- |
| OpenAI Responses adapter and server-only configuration | **PASS** | The reviewed source adds the adapter, validates an optional server key, maps only the temporary gate container to `openai`, and sends `store: false`. No browser configuration or image-layer secret is introduced. |
| Explicit Echo rollback / no implicit substitution | **PASS** | OpenAI is selected only when configured; cost/speed routing cannot silently select Echo while OpenAI is active. A failed OpenAI request remains a provider failure rather than a fabricated Echo Professor reply. Setting `LLM_PROVIDER=echo` remains the explicit rollback. |
| Usage normalization | **PASS — mocked provider boundary** | Four network-disabled adapter tests passed. Ordinary input excludes cached/cache-write units; output reasoning is not double priced; a positive unpriced cache-write count yields `UNKNOWN`, never `$0`. |
| Correlation, immutable ledger, and Cost Center mock | **PASS — PostgreSQL-backed mock boundary** | The deterministic OpenAI Responses flow passed in the real isolated P1 PostgreSQL topology (7/7 Sprint 4 cost tests): request correlation, user/subscription/plan/feature/resource/provider/model attribution, pricing snapshot, ledger amount, and Cost Center aggregation were retained. |
| Bounded real-provider harness | **PASS — readiness only** | The VPS-only script passed shell and client syntax checks. With no key, it stopped before image creation or a provider request and retained a sanitized `NOT_VERIFIED` evidence record. Its disposable API has no published port, disables Tutor retries, and caps output at 128 tokens (32 by default). |
| Secret boundary | **PASS — empty boundary verified** | The out-of-Git provider file and parent directory are owner-only (`0600` / `0700`). Its content was not read, printed, committed, copied into an image, or exposed to the Admin/User frontend. |
| Real OpenAI/provider pricing/cost | **NOT_VERIFIED** | No authorized credential, exact active price version, or external call exists yet. No measured provider cost is inferred. |
| Real OpenAI embeddings → Qdrant → retrieval | **NOT_VERIFIED** | Embeddings intentionally remain `fake`; this preparation adds no OpenAI embedding adapter or real embedding claim. |
| Professor user-interface flow with OpenAI | **NOT_VERIFIED** | The one-off future API path is prepared, but no user-interface call has been authorized or performed. |

### Reproducible non-provider regressions

- Linux source build with pnpm `11.13.1`, frozen lockfile, Shared build,
  Prisma generation, and API build: **PASS**.
- Network-disabled OpenAI adapter tests: **4/4 PASS**.
- Network-disabled standard API regression files, after mounting their
  read-only Admin/Mobile source inputs: **108/108 PASS**.
- Network-disabled Shared tests: **58/58 PASS**; Shared and API TypeScript
  checks also passed.
- The PostgreSQL cost/ledger suite above ran against the retained isolated P1
  services without any external provider connection. Existing P1 containers,
  database evidence, Qdrant evidence, and backups were not cleaned.

The no-key refusal evidence is retained at the run-specific P1 evidence path
`openai-provider-gate-20260925T171600Z-7caa75dc.json`. It contains only the
gate state and a safe failure code, never a credential, token, prompt, reply,
or provider request identifier.

### Required future authorization, not yet performed

After the user explicitly signals **« clé et modèle prêts »**, a new
staging-only key and the approved exact model must be entered directly in the
owner-only VPS file. An active exact-model USD price version with an official
source must also be created through the protected Finance MFA/step-up workflow.
Only then may the one bounded, no-retry Tutor request run. Persistent P1
activation requires a separate explicit authorization after that evidence has
passed; it must then be verified after restart through the active orchestrator
state. Echo remains the explicit rollback throughout.

## SPRINT 6 READINESS — OpenAI preparation update

# SPRINT 6 NOT READY

Preparation and deterministic instrumentation evidence do not replace a real
provider call with provider-returned usage and an immutable, source-backed
price snapshot. No Sprint 6 work has started.

## PRIVATE STAGING ACCESS ADDENDUM — 26 September 2026

**Scope.** This addendum records bounded, non-production private-staging
access hardening and fresh evidence. It preserves all earlier reports and
upgrades only the checks explicitly named below. No production service,
public Admin endpoint, real SMTP delivery, external provider request, or
Sprint 6 work was started.

**Source and deployment provenance.** The official staging source includes
`89552b4`, `633d0d7`, `ac8e5d0`, `c4d665f`, `fb3465c`, and `f754c0e`.
The P1 API was rebuilt from that source, is healthy, and retains a prior
image and an owner-only configuration backup for rollback. The User Web image
is healthy. Staging remains configured for non-billable Echo LLM and fake
embeddings.

**Human-account audit.** The intended personal Administrator identity is not
present. The designated learner identity exists as an active, unverified,
non-MFA account with no Admin role, private-beta grant, or temporary quota
cap. No fixture was converted and no duplicate human account was created.

### Verified bounded evidence

| Validation | Status | Exact boundary |
| --- | --- | --- |
| User Web to API origin | **PASS** | The deployed User gateway reached the current staging API through the private SSH tunnel. A browser probe using a non-existent technical identity received the expected `401`, proving a real API request rather than a landing-page-only check. The Web export completed with 949 modules and 17 assets. |
| User gateway Admin isolation | **PASS** | The User gateway returned `404` for Admin API paths. User, API, and Admin listeners remain loopback-only; no listener on public port `80` or `443` was found. |
| Private-beta HTTP lifecycle | **PASS — isolated technical scope** | A fresh internal PostgreSQL database received the 59 migrations. The retained run `private-beta-http-20260926104304-38af84f2` verified default-deny unlisted registration without side effects, verified-but-ungranted access denial, technical Admin MFA/step-up, audited grant, learner login/refresh, and revocation blocking an already-issued JWT, refresh, and subsequent login. |
| Individual staging quota cap | **PASS — isolated Echo-only scope** | A fresh internal PostgreSQL database in `staging-quota-cap-20260926110314-25b29fb7` verified the audited, expiring, AI_TEXT-only restrictive cap. Ten concurrent Tutor requests produced exactly 3 allowed and 7 blocked. No fallback, duplicate reservation/ledger, or provider attempt after blocking was observed. |
| Learner Admin denial | **PASS — isolated technical scope** | The technical learner received `403` from the Admin backend. |
| Cap-revocation HTTP contract | **PASS** | An initial isolated run found that a successful revoke returned `201`. The endpoint now explicitly returns `200`; the focused regression and fresh isolated gate passed. |
| Regression baseline | **PASS — scoped source regression** | Frozen pnpm `11.13.1` install passed. API unit tests passed 121/121, Shared tests passed 58/58, Mobile typecheck completed without an error, and the full Mobile Web export completed. |

The isolated gates used fresh internal-only Compose projects, fresh owner-only
ephemeral credentials, technical fixture identities only, and Echo/Fake
providers. Existing P1, Linux/PostgreSQL, Qdrant, and browser evidence was
retained and was not cleaned.

### Conditions explicitly still open

| Condition | Status | Reason |
| --- | --- | --- |
| Real SMTP delivery and human OTP completion | **NOT_VERIFIED** | Mail remains non-delivering pending private VPS SMTP configuration and a user-confirmed received message. |
| Personal Administrator registration, personal MFA, and audited SUPER_ADMIN assignment | **FAIL — browser-enrollment gap** | No human password, OTP, or TOTP material was used by automation. In addition, User Web has no screen that invokes the authenticated MFA enrollment endpoints (`/auth/2fa/setup` then enable), so a normal browser-only personal MFA enrollment cannot yet be performed. No API or fixture workaround was used. |
| Human learner verification and individual cap activation | **NOT_VERIFIED** | The technical cap proof does not select a human quota amount or expiry. |
| Public HTTPS User entry point | **NOT_VERIFIED** | ngrok is installed but no configuration or tunnel exists. Admin remains private. |
| Real OpenAI response, provider-returned usage, pricing, ledger, Cost Center, and real embedding to Qdrant retrieval | **NOT_VERIFIED** | No credential, price activation, or billable provider request was authorized. |
| Human assistive-technology review | **NOT_VERIFIED** | Existing automated browser-quality evidence remains bounded to its recorded scope. |
| Delete/re-register same-address policy | **BUSINESS_DECISION_REQUIRED** | No personal or fixture account was deleted. |

## SPRINT 6 READINESS — private staging access update

# SPRINT 6 NOT READY

The private technical access controls are validated within their stated
isolated boundaries. Human email/MFA onboarding, public User HTTPS, and the
real-provider attribution/pricing gate remain open. No Sprint 6 work started.
