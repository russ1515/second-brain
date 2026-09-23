# Learn + Universal Composer — Lot 5

## Scope

This lot changes the Learn entry point from an engine catalogue into an intention-led surface. It does not replace the Tutor, Lesson, Examiner, Library, Scan, Languages, Revision or Writing engines. It routes to them through their existing screens and APIs.

The page order is:

1. current intention and `UniversalComposer`;
2. up to three resumable `ExperienceSession` items;
3. lightweight specialised spaces;
4. collapsed advanced modes.

No AI request runs when Learn opens. The only automatic request is the user-scoped, cancellable `GET /experience-sessions/resumable?limit=3` read.

## Components and contracts

- `packages/shared/src/learn-orchestration.ts` is the runtime-independent contract. It defines the five intentions, four modalities, three research depths, deterministic decisions, concise explanation codes and responsive composition.
- `apps/mobile/components/learn/universal-composer.tsx` owns composition state, clarification, upload preview, voice recording, confirmation and draft lifecycle. Its props keep it reusable by later lots without integrating it elsewhere yet.
- `apps/mobile/components/context/context-bar.tsx` renders only real `ContextItem` references and lets the learner remove them before submission.
- `apps/mobile/lib/learn/composer-draft.ts` stores one versioned, user-scoped draft in AsyncStorage. It stores small reference metadata, never credentials or provider payloads.
- `apps/mobile/lib/learn/document-picker.ts` is the single native/web document-picker adapter and feeds the existing document endpoints.

The previous `UniversalStartBar`, `QuickCapture` and `DocumentDropZone` remain intact for compatibility and their existing callers/playground. Their local, clear-on-submit state was not nested inside the new composer because that would create a second source of truth and would lose the draft. The new composer reuses the same design primitives, recorder seam, Scan flow, document upload pipeline and session cards.

## Modalities

| Modality | Behaviour | Existing destination |
| --- | --- | --- |
| Write | Natural-language request, optional explicit intent | Deterministic route below |
| Speak | Start/stop real recorder, create Tutor session, upload one audio turn | `/tutor/sessions/:id/voice` then `/tutor/:id` |
| Capture | Opens an accessible bottom sheet, then the existing camera/gallery preview | `/scan` |
| Import | Opens the same bottom sheet and one file picker | `/documents/upload` or `/documents/scan`, then `/library/:id` |

PDF, plain text, Markdown and images are offered because those formats are supported by the current backend. An attachment is shown with name, MIME type/size metadata and a remove action before confirmation. Scan retains its existing multi-page preview and explicit upload action.

## Intentions and routing

The five visible intents are `understand`, `learn`, `practice`, `research` and `create`. Selecting one is optional. The router first honours an explicit choice, then uses small French/English verb patterns and active context. It never emits a confidence percentage.

Representative routes:

| Input/context | Decision |
| --- | --- |
| Natural question | create a Tutor session and send the question |
| Understand | Tutor explanation |
| Understand + active document | `/library/ask?documentId=…&q=…` |
| Understand + active concept | `/tutor?mode=explain&q=…&conceptId=…` |
| Learn | `/lesson/new?topic=…` |
| Guided session wording | `/daily-session?topic=…` |
| Learning-path wording | `/adaptive-path?topic=…` |
| Practise | `/examiner?type=exercise&topic=…` |
| Oral practice | `/tutor?mode=oral_exercise&q=…` |
| Language conversation | `/languages?q=…` |
| Quick research | concise Tutor turn |
| Standard research | `/library/ask?q=…`, optionally scoped to an active document |
| Deep research | confirmation, then `/tutor?mode=deepsearch&q=…` |
| Create quiz | `/examiner?type=mcq&topic=…` |
| Create course | `/lesson/new?topic=…` |
| Create academic work | `/writing?type=…&instructions=…` |
| Create/practise from document | the active `/library/:id` action |

Tutor, Ask Library, Examiner and Writing accept prefilled route parameters added by this lot. Those screens were not redesigned.

Route-prefill text is capped at 2,000 characters to keep URLs bounded; the complete draft remains in user-scoped local storage.

Every ready decision carries a stable explanation code translated by the client. The explanation describes the chosen experience, not internal reasoning.

## Clarification

A short ambiguous subject such as “JavaScript” produces one question: what the learner wants to do with it. The answer is one of the five public intentions and immediately resolves through the same deterministic router. There is no generic extra chatbot and no fake certainty.

Deep research has a separate confirmation because the existing flow can be slower and quota-consuming. This confirmation does not claim that external web search is connected; the existing research implementation remains authoritative.

## Active context

Learn can receive real document, concept, goal and language-profile identifiers through route parameters. They become `active-object` context items with safe labels. Restored draft contexts are merged by kind/id. The bar shows at most five items, is horizontally scrollable on narrow screens, and exposes a 44-point remove target with a screen-reader label.

Only references and small display metadata are persisted. Prompt text is not placed in route telemetry, and no client analytics system was added.

## Draft lifecycle and failure recovery

The draft contains:

- text;
- selected intent;
- research depth;
- active context references;
- attachment URI and safe metadata;
- version and update timestamp.

It is saved after a short debounce under a key scoped by authenticated user id. It is cleared only when a server-backed Tutor/voice/upload action completes. Navigation, quota errors, unavailable routes, failed uploads and other errors preserve it. The UI explicitly tells the learner when a draft is restored or preserved.

On web, a restored browser object URL can expire after a full browser restart; the UI then asks for the file to be selected again without removing the rest of the draft. Native cache URIs remain the platform-owned source.

## Resume and existing engines

Learn reads at most three active/paused `ExperienceSession` records and adapts them to the existing `SessionResumeCard`. Their stored `resumeTarget`, linked Tutor session, study session, lesson, document, language profile or workspace determines the exact destination. Titles, progress, contexts and productions come from stored session data; no synthetic session is shown.

Advanced modes are collapsed by default and retain direct access to Explain, Teach, Guided Session, Oral Practice, Oral Exam and Deep Research. Free Question and Discuss are no longer competing top-level modes because they are natural composer behaviours.

Languages, Library and Academic Workspace remain secondary links and are not redesigned in this lot.

## Responsive and accessibility

- Phone/tablet: one content column; the composer comes first, Resume immediately follows, attachments use the bottom sheet, intents wrap compactly and advanced modes stay collapsed.
- Wide desktop (1,000 px and above): a controlled central composer and a 340 px Resume rail when resumable sessions exist. The rest stays secondary; this is not a dashboard grid.
- Every interactive control uses a semantic role/label and at least the design-system touch target. Errors use text and icon, not colour alone.
- The shared `Sheet` respects the design system's reduced-motion setting. No decorative or fake AI delay was added.
- Keyboard order follows source order: input, examples/intents, depth, modalities, submit, then secondary content.

## Internationalisation

All Lot 5 interface strings exist in the English source catalogue and the complete French catalogue. The other registered languages retain the existing English fallback behaviour. User-authored text is never translated or prefixed on the client; the existing backend teacher/profile logic remains responsible for learning-language behaviour.

## Performance and privacy

- no automatic AI invocation;
- no Home aggregation fan-out;
- one cached/cancellable resumable-session read;
- no eagerly mounted legacy engine grids;
- no new telemetry or analytics dependency;
- no prompt content logged;
- attachment bytes are sent only after explicit selection and confirmation.

## Test coverage

`packages/shared/test/learn-orchestration.test.cjs` covers the five intentions, four modalities, exact destinations, document context, the one-question clarification, deep confirmation, draft preservation and responsive composition.

`apps/api/test/learn.test.cjs` is a structural non-regression test for composer-first ordering, the single lightweight read, draft/context wiring, secondary advanced modes, route prefill and absence of new telemetry/AI fan-out.
