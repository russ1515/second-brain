# ExperienceSession

## Role

An ExperienceSession is the cross-product continuity envelope for the sequence:

`intention → context → action/result → twin impact → next best action`.

It lets a learner resume one coherent activity across routes or devices while
existing engines keep owning their business data.

## Stored model

The model stores:

- owner, type and lifecycle status;
- title, intention and input modality;
- a bounded `ExperienceContext` snapshot;
- current step and real progress;
- references to productions and sources;
- measured twin impact when available;
- resume target and normalized Next Best Action;
- optional links to TutorSession, StudySession, Document, Lesson, Goal,
  LanguageProfile and a reserved Workspace reference;
- idempotency key, version and lifecycle timestamps.

Types are `learning`, `tutor`, `research`, `review`, `language`, `workspace` and
`document-processing`. Statuses are `active`, `paused`, `completed`, `abandoned`
and `failed`.

## Lifecycle

```text
create → active ⇄ paused → completed
             └───────→ abandoned
             └───────→ failed
```

Pause, resume and complete are idempotent when the session already has the
requested state. Completed, abandoned and failed sessions are terminal. A
terminal session cannot be reopened by an update; a new ExperienceSession must
be created if the user intentionally starts a new activity.

## API

All paths are under `/api/experience-sessions` and require JWT authentication.

- `POST /` — create; optional `idempotencyKey`;
- `GET /` — recent sessions, cursor-paginated;
- `GET /resumable` — active and paused sessions, cursor-paginated;
- `GET /:id` — owned session detail;
- `PATCH /:id` — bounded state update or terminal failure/abandonment;
- `POST /:id/pause`;
- `POST /:id/resume`;
- `POST /:id/complete`.

## Security

Every read, update and cursor is scoped by both `id` and authenticated `userId`.
A missing or foreign session returns the same not-found response. Direct links
to existing domain records are validated against their owner before creation.
The server always writes the context owner from the authenticated identity and
never trusts a client-supplied owner.

Context metadata rejects sensitive key names and remains scalar/bounded. Full
document content, access tokens, provider prompts and chain-of-thought must never
be persisted in an ExperienceSession.

## Relations with TutorSession and StudySession

TutorSession remains the source of truth for tutor messages, teaching strategy
and generated lessons. StudySession remains the source of truth for the guided
study loop and before/after mastery measurements. ExperienceSession only points
to those rows and stores navigation continuity or measured summaries required by
the cross-product experience.

The relation is intentionally many-to-one: a later flow may create a new
continuity envelope around an existing domain session without cloning it.

## Pause and resume

Pausing records `pausedAt`. Resuming clears it and preserves current step,
contexts, references and resume target. Completing records `completedAt` and
removes the session from the resumable list. Active and paused sessions are both
listed as resumable so an interrupted active device can be continued elsewhere.

## Multi-device strategy

The database row is authoritative. `updatedAt` and `version` provide the basis
for future optimistic concurrency and stale-client detection. Lot 0 increments
the version on each mutation; a future client mutation contract should send its
expected version and receive a conflict instead of overwriting a newer device.

Idempotency keys protect retried creation requests per user. Cursor pagination
keeps recent-session reads bounded. Real-time synchronization, push delivery and
Workspace draft conflict resolution are extension points and are not activated
in Lot 0.

## Migration safety

Migration `20260905090000_experience_sessions` only creates new enums, the new
table, indexes and foreign keys. It does not rewrite or delete existing rows.
Deployment must use `prisma migrate deploy`; never use `db push` or reset a
data-bearing database.
