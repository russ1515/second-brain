# Tutor Experience (Lot 6)

## Product boundary

The AI Professor remains the existing Tutor engine. Lot 6 does not introduce a
second chatbot or replace lesson, oral, research, mastery, retrieval, language,
or Learning DNA engines. It makes their existing signals coherent inside one
resumable learning experience.

## Entry and continuity

`/tutor` is the Professor lobby. Its visual order is deliberate:

1. resume the most recently updated active or paused Tutor experience;
2. formulate one new request;
3. show a bounded set of recent and completed sessions;
4. expose existing specialist modes as secondary actions.

Creating a Tutor session also creates an `ExperienceSession` with type `tutor`.
The wrapper persists the learner intention, objective (the current-step label),
input modality, active contexts, requested mode, direct domain links, and exact
resume target. Existing Tutor sessions are wrapped lazily when opened. The
server-backed wrapper allows the objective, context, history and state to resume
on another device. The unfinished composer draft is additionally stored locally
per user and Tutor session so a refresh on the same device never erases it.

## Context and grounding

Learn, Tutor modes, a concept, a document, a goal, and a language profile pass
small reference-only `ContextItem` values. Direct domain references are checked
against the authenticated user. The conversation shows the reusable
`ContextBar`; removing an item updates the `ExperienceSession`.

When one or more document contexts are active, Tutor retrieval is restricted to
those exact owned documents. Without a document context, the existing
user-isolated library retrieval remains available. Citations are represented by
interactive source components rather than by a plain comma-separated string.

## Pedagogy and message presentation

The existing deterministic Teaching Strategy Engine remains authoritative. The
API exposes a stable reason code so English and French clients do not display a
reason in the wrong language. Declared Professor settings, observed learner
profile signals, Learning DNA maturity, concept mastery, the learning locale,
and language profile shape the system prompt only when real data exists.

Assistant Markdown is conservatively split into the following presentation
vocabulary: `TEXT`, `TEACHING_BLOCK`, `EXAMPLE`, `QUESTION`, `EXERCISE`, `QUIZ`,
`SUMMARY`, `SOURCE`, `ACTION`, and `PROGRESS`. Only explicit headings are
classified; unlabelled prose remains `TEXT`, and the original message content is
always preserved. No second model call is made to classify a response.

`ProgressNarrative` renders only persisted progress and measured twin impact.
It does not synthesize percentages or mastery changes. `ResultActionBar` shows
at most three actions when a session is complete: the persisted Next Best Action
when one exists (otherwise a continuation), consolidation, and a return to the
first real origin context.

## Voice, failures, and quotas

Voice uses the existing recorder, STT, Tutor response, optional TTS, and written
lesson pipeline. The UI state vocabulary is `READY`, `LISTENING`,
`TRANSCRIPTION`, `THINKING`, `RESPONSE`, and `ERROR`; indeterminate work never
shows a fabricated percentage.

A successfully recognised transcript is persisted even if the response provider
or quota gate fails. The error response also returns that transcript so the
composer can offer an immediate text retry. Retrying an identical unanswered
turn reuses the persisted user message instead of duplicating it.

Quota errors keep the draft and session visible, show the real reset timestamp
when the backend supplies one, link to Usage, and keep non-AI Library access.
They never start a payment or plan change automatically.

## Performance and accessibility

The lobby requests only the bounded Tutor history endpoint. The API returns at
most 20 Tutor sessions, restores at most 100 recent messages, and sends at most
12 recent messages to the LLM. Reads are not polled. Source retrieval remains
bounded to five passages. Mobile keeps one content column and moves secondary
session actions into a sheet; wide layouts add only a light strategy/action rail.
All controls use the existing accessible design-system primitives, semantic live
regions, readable text labels, and the project-wide reduced-motion behavior.

## Verification focus

Automated coverage checks the lobby hierarchy, Learn-to-Tutor context transfer,
ExperienceSession continuity, local draft preservation, structured message
blocks, transcript recovery, quota fallback, bounded reads, real-only progress,
responsive actions, and user isolation. Lot 0 tests continue to cover create,
update, pause, resume, complete, idempotency, and cross-user rejection for the
shared ExperienceSession service.
