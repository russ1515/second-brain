# UX architecture contracts — UX-2 Lot 0

This document describes the technical contracts introduced before any visual
redesign. Existing URLs, screens and domain models remain compatible.

## RouteMetadata

`packages/shared/src/route-metadata.ts` is the central inventory of the current
Expo routes. Each entry declares its parent space, experience type, shell mode,
immersive mode, permissions, authentication, accepted contexts, composer mode,
resume capability and category (`USER`, `ADMIN`, `TECH`, `DEMO`, `LEGACY`).

The five primary spaces remain `/`, `/learn`, `/brain`, `/study` and `/profile`.
Secondary routes keep their current URLs. Metadata describes future placement;
it does not alter Expo Router or current navigation. `/` intentionally has
optional authentication because it serves both the public Landing and the
authenticated Home.

## Context model

`ExperienceContext` is a bounded, serializable snapshot owned by one user. It
contains references and small display metadata, never full domain records or
credentials. The precedence order is:

1. current turn;
2. active object;
3. ExperienceSession;
4. space;
5. permanent profile.

Pure shared helpers create, add/replace, remove, validate, serialize and restore
contexts. Restoration validates the owner and removes expired items. Sensitive
metadata keys (tokens, passwords, credentials, API keys, cookies and secrets)
are rejected. A display selector returns only the highest-value visible items
for the future ContextBar.

## ExperienceSession

`ExperienceSession` is a persistent continuity envelope. It stores intention,
small context snapshots, progress, production/source references, measured twin
impact, resume destination and optional Next Best Action. Direct foreign keys
link existing TutorSession, StudySession, Document, Lesson, Goal and
LanguageProfile rows. It does not replace them.

The API is authenticated and owner-scoped. Creation supports a per-user
idempotency key. Lists are cursor-paginated and capped at 50 rows. JSON payloads
and collection sizes are bounded. See `docs/EXPERIENCE-SESSION.md` for lifecycle
and multi-device rules.

## NextBestAction and RecommendationReason

`NextBestAction` normalizes a primary destination, plain-language reason,
measured/forecast impact when available, duration when known, alternatives,
validity, confidence and source. `RecommendationReason` exposes stable signals
and verifiable product evidence. It must never expose model chain-of-thought.

`NextBestActionAdapter` converts the existing persisted recommendation feed. A
recommendation without an actionable target is skipped; an empty actionable
feed returns `null`. Unknown duration, impact, validity and confidence remain
`null` instead of being invented.

## UX and AI work states

The shared semantic states are `idle`, `loading`, `processing`, `partial`,
`success`, `error`, `stale`, `offline` and `quota-limited`.

`AIWorkState` carries operation, stage, localization key, retryability and real
timestamps. Progress is a discriminated union:

- `determinate` requires real completed and total values; percentage is derived;
- `indeterminate` carries no fabricated percentage.

## Quota errors

Quota failures retain the legacy `error: quota_exceeded` and `metric` fields and
add quota type, used, limit, remaining, reset time when known, affected feature,
still-available functions, retry delay, management destination, upgrade
availability and a localization code.

Counter quotas expose the next monthly reset. Live gauges such as document count
or storage have no artificial reset. Upgrade availability is `null` until the
backend has real commercial data. No prices or plan limits are hard-coded here.

## ResearchProvider

The provider seam defines `availability`, `capabilities`, `search` and
`fetchSourceMetadata`, plus provider-neutral external source and citation types.
Lot 0 registers no external provider and performs no extra network call. The
disabled implementation exists only for deterministic contract tests and fails
closed if search is invoked.

## Academic Workspace persistence target

The current Academic Workspace is stateless server-side: its screen holds the
analysis and conversation in React state and sends recent messages back on each
assistant request; the API caps replay at 16 messages. There is no workspace,
draft or autosave database model today.

`PersistentWorkspace`, `WorkspaceDraft`, `WorkspaceSourceReference`, assistant
history, progress, optimistic autosave revision and resume target now define the
future backend boundary. No Workspace database migration is included in Lot 0;
that belongs to the later Workspace implementation after storage and conflict
policy are validated.

## Languages

The current registry of 27 generic languages is unchanged. `LanguageIdentifier`
keeps each existing generic code and adds optional BCP 47 tag/region fields, so
regional variants can be introduced later without changing existing codes or
using flags as identity.

## Performance guardrails

`PERFORMANCE_BUDGETS` defines the initial targets: visible local interaction
under 100 ms when reasonable, cached actionable screen under 1 s p75, cold
actionable screen under 2.5 s p75, list pages capped at 50, contexts capped at 32
items/32 KiB and session JSON bounded. ExperienceSession endpoints use bounded
queries and cursor pagination. Future clients must pass cancellation signals for
obsolete requests and must not fan out unbounded calls.

## Feature flags and rollback

One shared catalog defines these operational flags, all disabled by default:

- `newAppShell`;
- `experienceSessions`;
- `universalComposer`;
- `newHomeNBA`;
- `newBrain`;
- `documentIntelligence`;
- `newTutorExperience`;
- `newLanding`.

The API reads `FEATURE_*`; Expo reads the corresponding
`EXPO_PUBLIC_FEATURE_*` value at build time. These switches are distinct from
subscription entitlements in `Plan.features`: rollout controls code exposure,
while entitlements control user access. Disabling a UX flag rolls back future UI
wiring without dropping data or disabling the additive backend API.

For Lot 2, `EXPO_PUBLIC_NEW_APP_SHELL_ROUTES` optionally narrows the client
rollout to registered route-metadata paths. This provides a route-by-route
rollback to the former Stack/Tabs chrome while keeping URLs and screen content
unchanged. See `docs/APP-SHELL.md`.

## Compatibility rules

- Do not rename or remove current routes in a later lot without an explicit
  compatibility redirect.
- Do not replace TutorSession, StudySession or current domain artifacts with an
  ExperienceSession.
- Store references and measured summaries, not duplicated domain payloads.
- Treat nullable/unknown product facts as unknown; do not synthesize values.
- Keep every rollout flag false until its implementation lot is validated.
- Database changes use additive Prisma migrations only: never `db push` or
  `migrate reset` on a data-bearing environment.
