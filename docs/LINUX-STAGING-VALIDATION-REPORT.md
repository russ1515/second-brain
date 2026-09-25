# SECOND BRAIN — LINUX STAGING VALIDATION REPORT

**Date:** 18 September 2026
**Scope:** environment isolation before Sprint 6. This is not a production deployment and no Sprint 6 work was started.

## Executive result

The Linux isolation gate could be prepared and statically validated, but its real Node/PostgreSQL runner could not be built because Docker Hub access did not complete. No migration, PostgreSQL connection, concurrency run, API, Admin browser, provider, or production system was executed from this Linux topology.

# SPRINT 6 NOT READY

## Evidence collected

- A disposable `alpine:3.20` container ran `uname -s` and returned `Linux`; this proves that a cached Linux container can start in Docker Desktop.
- Docker reports `client=29.6.1 server=29.6.1`.
- WSL exposes only the `docker-desktop` distribution; no usable Ubuntu 24.04 staging distribution or external Linux host was available.
- `docker compose --env-file .env.linux-validation.example -f docker-compose.linux-validation.yml config --quiet` completed successfully after the final safety changes.
- `scripts/start-linux-pg-validation.ps1` passed PowerShell parser validation.
- Building the Node runner failed first with a Docker Hub TLS handshake timeout for `node:22-alpine`; two subsequent pulls started but stopped making progress after layer initialization and were interrupted. `node:22-alpine` was not available locally afterward.

## Validation environment prepared

The following artifacts establish a fail-closed, non-production Linux runner path:

- [Dockerfile.linux-validation](../Dockerfile.linux-validation) installs Linux-native Node 22/pnpm 11.13.1 dependencies and explicitly builds `@second-brain/shared`.
- [docker-compose.linux-validation.yml](../docker-compose.linux-validation.yml) defines a private bridge network, no published host ports, Postgres on `tmpfs`, and a runner that only reaches the internal `postgres` hostname.
- [.env.linux-validation.example](../.env.linux-validation.example) documents variable shape only; it is not the supported execution path.
- [start-linux-pg-validation.ps1](../scripts/start-linux-pg-validation.ps1) generates a unique Compose project, run id, database name, and URL-safe test-only password in memory; it uses `up --wait` and retains the project only for evidence review.
- [run-linux-pg-validation.sh](../scripts/run-linux-pg-validation.sh) refuses production-looking URLs, external hosts, mismatched run/database bindings, missing topology markers, and missing fresh-database confirmation before migration.

No production credential, provider key, mail/payment credential, host port, production database, or automatic cleanup/deployment was used.

## Required report items

| # | Validation | Result | Evidence / limitation |
| ---: | --- | --- | --- |
| 1 | Linux Environment | **PARTIAL** | Cached Alpine executed as Linux; no independent Ubuntu staging host available. |
| 2 | Docker Versions | **PASS** | Docker client/server `29.6.1`. |
| 3 | Node/pnpm Versions | **NOT VERIFIED** | Required Linux image `node:22-alpine` could not be obtained. |
| 4 | Service Health | **NOT VERIFIED** | The dedicated Postgres/runner services never reached startup. |
| 5 | PostgreSQL Connectivity | **NOT VERIFIED** | No Linux Prisma client was built or connected. |
| 6 | Migration Status | **NOT VERIFIED** | No isolated database was created or migrated. |
| 7 | Redis | **NOT VERIFIED** | Not needed for the direct P1001/concurrency gate and not started. |
| 8 | Qdrant | **NOT VERIFIED** | Not started; inherited Sprint 4 condition remains open. |
| 9 | API | **NOT VERIFIED** | API was not built or booted in Linux. |
| 10 | 20-Concurrent-Ingestion | **NOT VERIFIED** | Real PostgreSQL suite could not start. |
| 11 | Repeated Concurrency Runs | **NOT VERIFIED** | Three-run runner script is prepared but not executed. |
| 12 | Two-Fingerprint Test | **NOT VERIFIED** | Covered by the unexecuted PostgreSQL suite. |
| 13 | Correlation Safety | **NOT VERIFIED** | Route/window regressions exist, but no Linux database execution occurred. |
| 14 | Backpressure | **NOT VERIFIED** | No Linux ingestion transaction executed. |
| 15 | Redaction | **NOT VERIFIED** | No fresh Linux persisted-field inspection occurred. |
| 16 | User Report Correlation | **NOT VERIFIED** | No fresh Linux E2E run occurred. |
| 17 | Bug Workflow | **NOT VERIFIED** | No fresh Linux PostgreSQL run occurred. |
| 18 | Incident/Support | **NOT VERIFIED** | No fresh Linux PostgreSQL run occurred. |
| 19 | Qdrant E2E | **NOT VERIFIED** | Qdrant was not started. |
| 20 | Provider E2E | **NOT VERIFIED** | No dedicated provider credentials were supplied or used. |
| 21 | Admin Browser | **NOT VERIFIED** | No Linux API/Admin service or browser endpoint existed. |
| 22 | MFA | **NOT VERIFIED** | No isolated MFA fixtures/API/browser were run. |
| 23 | RBAC | **NOT VERIFIED** | No isolated HTTP/browser suite was run. |
| 24 | Cost Center Browser | **NOT VERIFIED** | No Linux Admin browser path was available. |
| 25 | API Tests | **NOT VERIFIED** | API runner image was unavailable. |
| 26 | Shared Tests | **NOT VERIFIED on Linux** | Windows Gate 5.5 result remains 58/58 PASS, but it is not substituted for Linux proof. |
| 27 | Integration Tests | **NOT VERIFIED** | Runner image unavailable. |
| 28 | Typecheck | **NOT VERIFIED on Linux** | Runner image unavailable. |
| 29 | Builds | **NOT VERIFIED on Linux** | API/Admin/Mobile Linux builds were not reached. |
| 30 | Windows vs Linux Comparison | **NOT POSSIBLE** | The Linux Node→Postgres path never ran, so the Windows/Docker diagnosis cannot be concluded. |
| 31 | Application Defects Found | **NONE CONFIRMED** | Linux did not reproduce or clear an application failure. |
| 32 | Environment Defects Found | **CONFIRMED BLOCKER** | Docker Hub TLS timeout/stalled pull for the required Node image; no usable Ubuntu staging host exposed. |
| 33 | Corrections Applied | **PASS** | Validation-only infrastructure hardened: Linux-native Shared build, internal hostname guard, unique run/database binding, `tmpfs` database, health wait, and no automatic teardown. |
| 34 | Remaining Conditions | **OPEN** | Linux image/host availability; real PostgreSQL gate; API/Admin/MFA/RBAC/browser; Sprint 4 providers, Qdrant E2E and Cost Center browser. |
| 35 | Sprint 6 Readiness | **NOT READY** | Critical evidence remains unavailable. |

## Failure classification

The observed failure is an **ENVIRONMENT FAILURE** in the staging bootstrap path, not a test failure or application failure:

```text
Docker Hub → node:22-alpine metadata/layer retrieval
  ├─ initial TLS handshake timeout
  └─ later pulls stalled before an image was available
```

It does not prove the earlier Windows `P1001` is a Windows/Docker transport issue, because the Linux Node-to-PostgreSQL path has not yet executed. It also does not justify a change to application concurrency, Prisma pooling, quota behavior, fingerprint logic, or Docker resource limits.

## Remaining conditions and safe next step

Provide either a reachable Ubuntu 24.04 staging host with Docker Engine and registry access, or restore reliable Docker Hub/network access on this host. Then run the supported launcher once against its newly generated project and inspect the resulting evidence before expanding to Redis/Qdrant/API/Admin browser validation.

The staging project is intentionally not cleaned up automatically. Any cleanup must target only its generated project and occur after evidence review with explicit authorization.

## Stop

No Sprint 6 work has started. No production deployment occurred. This gate stops here pending an environment change and explicit follow-up.

## OVH P1 ADDENDUM — 25 September 2026

**Supersession notice.** The preceding Docker-Hub/bootstrap failure describes the earlier Windows topology only. The results below are from a later dedicated non-production Ubuntu OVH staging runner and supersede that earlier `NOT VERIFIED` outcome only where expressly listed.

| Linux staging validation | Status | Verified evidence |
| --- | --- | --- |
| Runner build and dependency install | **PASS** | The Linux runner build completed with the frozen lockfile; the native Argon2 install completed. |
| PostgreSQL isolation and health | **PASS** | Isolated PostgreSQL and runner were healthy; no production database was used. |
| Migration status | **PASS** | All 59 migrations were found and Prisma reported the isolated schema up to date. |
| Sprint 5 PostgreSQL gate | **PASS** | Three real PostgreSQL executions were retained; the final execution `20260923144224-423eb555` was 10/10, including the 20-concurrent-ingestion assertion and the Bug/Incident/Support/Diagnostics workflow. |
| API/Shared regression | **PASS** | `final-api-shared-regression-r3-20260925.json` records Shared build/tests (58/58), API build/tests (108/108), and relevant typechecks in retained Linux evidence. |
| Admin build validation | **PASS** | The staging Admin image build completed its Web export; the evaluated image also passed `pnpm --filter @second-brain/admin typecheck` with network disabled. |
| Qdrant document/vector lifecycle | **PASS — bounded scope** | Real Qdrant vector persistence, owner retrieval, cross-user isolation, and purge were exercised using the staging fake embedding provider. |
| External provider/instrumentation | **NOT_VERIFIED** | No real external provider credential or billable/provider-attributed call was used. |

The P1 HTTP/Admin validations use the same non-production OVH staging environment and have separate retained evidence: HTTP/security 3/3, Cost Center HTTP 1/1, role-specific browser MFA/RBAC/step-up flows, and `admin-browser-quality-full-20260925-quality-full-r5.json`. These are not substituted for a real-provider validation.

### Remaining condition

# SPRINT 6 NOT READY

The Linux/PostgreSQL gate is closed. A real external-provider/instrumentation run with new staging-only credentials and attributable ledger/cost evidence remains required. The Qdrant result above is real for Qdrant transport and lifecycle, but not for a real embedding provider.

### Browser-quality evidence supersession — 25 September 2026

The earlier five-route browser-quality reference is superseded by `admin-browser-quality-full-20260925-quality-all-r4.json`: all 15 protected navigation sections passed at four viewports with 90 layout samples, 60 keyboard-focus samples, EN/FR persistence, and zero automated WCAG A/AA violations. Dynamic User and Bug details retain their role-specific evidence. Manual screen-reader/assistive-technology validation remains `NOT_VERIFIED`.

## Official source provenance and remaining provider gate — 25 September 2026

The dedicated OVH checkout was fast-forwarded cleanly to `d013b70c8f47db1bb57e84a8df64a1c4c6f1a2b4`, preserving the named Admin accessibility/report commits, their prerequisite fixes, and the separate staging mobile correction. The checkout remained clean and still represented 59 migrations. A no-cache Admin image rebuild from that exact checkout passed the frozen install/build path and a network-isolated Admin typecheck; only the Admin service was recreated and reached healthy status. Its prior image is retained as a rollback tag.

`20260925-source-d013-r3` is the valid post-transfer browser evidence: all role-specific Admin flows, Cost Center literal states, EN/FR, and the all-route quality audit passed. The consumable Support transition fixture was regenerated through its existing controlled P1 fixture process; `admin-browser-support-stepup-20260925-source-d013-support-r4.json` passed. An earlier `r2` browser runner is retained but excluded from evaluation because it omitted `/api` in a direct harness endpoint. A fresh Linux proof container completed frozen Mobile installation, Shared build, Mobile typecheck, and Mobile Web export with exit code `0`.

The remaining provider condition is **NOT_VERIFIED**. Staging currently uses `echo` for LLM and `fake` for embeddings; no real Gemini credential is installed and no active, source-referenced Gemini pricing entry exists. The prepared secret location is outside Git and owner-only, but it is intentionally empty. Therefore no real provider call, provider token measurement, priced cost, or external embedding result is claimed. This report continues to require a human-provisioned staging credential and Finance/MFA-approved exact-model pricing before the bounded provider and optional real-embedding Qdrant runs can begin.

# SPRINT 6 NOT READY

The Linux/PostgreSQL and reconciled HTTP/Admin source validations are PASS within their explicit evidence scope. Real-provider/instrumentation attribution remains the required final blocker.

## OpenAI provider preparation evidence — 25 September 2026

This later source-preparation run did not use an OpenAI key or external network
provider. The persistent P1 API was left on `echo`/`fake` and was not recreated.
The following Linux checks were performed against the reviewed preparation
source:

This supersedes only the earlier Gemini-specific proposed provider wording;
the remaining evidence requirement is unchanged and the prepared path is
OpenAI.

| Check | Status | Boundary |
| --- | --- | --- |
| Frozen source build | **PASS** | pnpm 11.13.1, Shared build, Prisma generation, and API build completed in Linux. |
| OpenAI adapter tests | **PASS — mock** | 4/4 network-disabled tests verify safe Responses serialization, normalization, explicit routing, and the one-attempt cap. |
| API regression | **PASS** | 108/108 standard API tests passed in a network-disabled Linux container with the required Admin/Mobile source inputs mounted read-only. |
| Shared regression | **PASS** | 58/58 network-disabled Shared tests passed; Shared/API TypeScript checks passed. |
| PostgreSQL ledger/Cost Center mock | **PASS — mock provider only** | 7/7 deterministic pricing tests passed against P1 PostgreSQL, including immutable attribution and `UNKNOWN` for unpriced cache-write units. |
| No-key harness refusal | **PASS** | The future VPS harness stopped before build or provider access and wrote a sanitized `NOT_VERIFIED` evidence record with owner-only permissions. |
| Real provider / real embedding | **NOT_VERIFIED** | Neither a key nor a billable call was authorized; embeddings remain fake. |

The harness is deliberately disposable: it uses a container without a published
port, a no-retry Tutor policy, and a bounded output. It cannot change the
long-running Echo API. A future real call still requires explicit user
authorization, a VPS-only staging credential, and an active exact-model price
version created via the Finance MFA/step-up workflow.

# SPRINT 6 NOT READY

The real provider/instrumentation condition remains open. No Sprint 6 work has
started.
