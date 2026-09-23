# Bug, Support & Diagnostics Control Center

## Purpose and safety boundary

Sprint 5 introduces an evidence-first control center. Its flow is:

`problem → safe telemetry or voluntary report → ErrorEvent / Report → correlation → BugGroup → impact → diagnostic → human review → development, test, deployment process, monitoring → resolution`

The control center records and presents evidence. It has no production repair, deployment, provider-routing, quota, plan, account-status, database, or infrastructure restart action.

## Error events and correlation

`ErrorEvent` is the immutable technical-event source of truth. It carries bounded attribution when available: environment, source, severity, request ID, trusted operation ID, user/session, route, feature, provider/model, version/platform, latency, retry and quota state. `ProviderUsageAttempt` can be linked when the server has a trusted provider-operation context.

The request-context middleware supplies the request ID across API work. An operation ID is accepted only from a trusted server-side context; a public client cannot assign one. A `Report.requestId` is the report-submission idempotency key. `Report.observedRequestId` is deliberately separate and can correlate only a previous same-user, same-context failure.

## Redaction and privacy

`SafeRedactionService` runs before ErrorEvent persistence and before administrative views. It removes known secret classes (passwords, authorization/cookie values, JWT/refresh tokens, OTP/TOTP values, API/provider/SMTP/payment keys), direct email/IP values, unsafe URLs/paths, and sensitive metadata keys. Backend and provider exceptions retain only structural stack fingerprints and a generic source summary; opaque prose and stack detail are not persisted.

The public telemetry endpoint is rate-limited, size-limited and allowlisted. It rejects client-selected identity, plan, role and operation fields. Mobile reporting keeps only short-lived safe telemetry correlation in memory. User reports are untrusted data and are not used as system instructions. The support listing deliberately returns redacted report content, not original text.

Screenshots, attachments, private documents, conversations, audio, and Learner Profile capture are not implemented in Sprint 5 (`NOT_INSTRUMENTED`), including when a report grants additional-diagnostics consent. No arbitrary upload surface is created.

## Fingerprints, groups, and impact

The stable fingerprint is derived from structural characteristics such as source, code/type, route, feature, provider/model and structural stack signature, not user ID or timestamps. A unique `(environment, fingerprintVersion, fingerprint)` key and serializable transaction make ingestion safe under concurrent duplicates.

`BugGroup` is an aggregate for fast triage while `ErrorEvent` remains authoritative. It tracks first/last seen, occurrences, severity, incident/assignment and exact affected-user membership. `BugAffectedUser` has a compound key to make each user count once per group and retain their individual occurrence count.

The service applies a small, bounded in-process transaction gate before the database operation. This is backpressure for Prisma’s finite connection pool during an error spike, not a replacement for PostgreSQL concurrency control: queued callers still execute the same serializable transaction and database uniqueness checks. Retryable serialization and pool-wait errors use bounded exponential backoff with jitter.

Expected `QUOTA_BLOCKED` remains an expected quota-engine terminal result rather than a BugGroup. `PROVIDER_USAGE_AFTER_QUOTA_BLOCK` remains a technical anomaly that can be diagnosed.

## Workflows

Bug workflow states are `NEW`, `TRIAGED`, `INVESTIGATING`, `FIX_IN_PROGRESS`, `FIXED`, `MONITORING`, `RESOLVED`, `REOPENED`, `WONT_FIX`, and `DUPLICATE`. Transitions are constrained; `WONT_FIX` requires a reason, `FIXED` requires a fix reference or target release, and duplicate marking keeps the original historical group.

Support cases link a user, optional report and optional BugGroup. Notes, assignment and status changes are stored and audited. Incidents have human-created timelines and statuses `INVESTIGATING`, `IDENTIFIED`, `MONITORING`, and `RESOLVED`; multiple BugGroups may reference one Incident.

## Diagnostics

Rule-based diagnostics use persisted, sanitized evidence and return separate `OBSERVED`, `CORRELATED`, `HYPOTHESIS`, confidence, evidence IDs and next checks. They do not claim `CONFIRMED` causality.

The manual AI-assisted action is intentionally recorded as `NOT_AVAILABLE` until an approved, metered `ADMIN_DIAGNOSTIC` provider route exists. No model call is silently made, no user-report prose is promoted to an instruction, and no cost is invented. Release correlation, regression detection, alerting and AI cost metering therefore remain `PARTIAL` or `NOT_INSTRUMENTED` rather than simulated.

## Access control and audit

The Admin routes require the existing JWT/Admin/MFA/RBAC foundation. Capability boundaries include `bugs.read/manage/diagnose`, `support.read/manage`, `incidents.read/manage`, `error_events.read/sensitive`, and `diagnostics.read/run`. Sensitive event detail requires its specific capability. State-changing triage, assignment, status, duplicate, diagnosis, support and incident actions require step-up and create audit records. Read endpoints use `Cache-Control: no-store`.

## Performance, retention, and operations

The migration adds indexes for fingerprint/time, group/time, request/operation/user, source, provider/model, version, BugGroup state, assignment, incident and support lookups. Lists are server-paginated.

No automatic retention deletion, sampling job, alert sender, release feed, or operational repair job is enabled. Retention and sampling need an approved policy before any data deletion is introduced; until then they are explicitly `NOT_INSTRUMENTED`. This preserves diagnostic history and avoids an unreviewed destructive task.

## Validation boundary

The dedicated PostgreSQL test database is the only database used for Sprint 5 migration and integration checks. Real-provider and Qdrant E2E evidence, and full browser validation, remain separate environment-dependent conditions and must not be treated as passing without recorded proof.
