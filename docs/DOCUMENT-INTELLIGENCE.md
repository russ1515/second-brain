# Document Intelligence — Lot 7

## Product boundary

- **Library** is the unique inventory of user-owned sources.
- **Document Intelligence** exposes what the existing engines actually understood.
- **My Brain** receives document concepts and links; Lot 7 only shows a measured summary and a contextual transition.
- **Academic Workspace** remains the production space; Lot 7 only passes the source document to the existing workspace route.

No schema migration or new document engine is introduced by this lot.

## Library

`/library` uses `GET /library/paged` for a bounded cursor page (24 by default, 50 maximum). The legacy `GET /library` array remains available to existing consumers. Search, shelves, subject/language facets, collections and sorting are server-side. Files are rendered as a one-column list on mobile and as a filters-plus-list composition on desktop.

The first successful page is cached per authenticated user and per query. When the API is unavailable, the last matching page remains visible with an explicit stale/offline notice. Cached identity contains only the safe `AuthUser` projection and exists to prevent one user's cache from being shown to another.

The empty state is demonstrative but static. Its Import → Read → Understand → Connect → Ready sequence explains future value and never pretends that an analysis is running.

## One import capability

`apps/mobile/lib/document-import.ts` is the shared capture seam used by Library and Learn. PDF/text/Markdown files go to the existing `/documents/upload` service. Images go to the existing `/documents/scan` service and then enter the same ingestion pipeline. The scan screen also uses the common multipart helper.

Text and URL ingestion remain available through their existing endpoints. The UI has one open import panel rather than concurrent upload zones.

## Honest pipeline

The backend persists only `pending | processing | ready | failed` plus the technical current stage. `resolveDocumentPipeline` maps those facts to readable phases:

| Persisted state | Product phase |
| --- | --- |
| pending / no stage | queued |
| cleaning | reading |
| segmenting | extracting |
| embedding or indexing | indexing |
| graphing | connecting |
| ready | completed |
| failed | failed |

Processing is indeterminate because the backend does not expose real percentages. `100%` is shown only for `ready`. Retry calls the existing idempotent reindex endpoint.

## Document Intelligence View

`/library/[id]` gives the extracted document the central reading surface and places intelligence in context. On desktop the two panes coexist without a rigid 50/50 split. On mobile the composition becomes Document / Understand / Ask segments.

The primary action is **Ask this document**. Summarize, Explain and Learn are secondary. Quiz, flashcards, comparison, Workspace, re-analysis and organization live under advanced actions. Metadata unavailable from the backend (for example page numbers) is not synthesized.

Concepts, prerequisites, mastery, known/new concepts, links and generated resources come from the existing understanding, integration and resource endpoints. A Brain impact sentence is rendered only when an integration report exists. Generated resources retain `documentId` and their source title is visible in the UI.

Document content is capped in the screen preview to avoid loading an unbounded text tree. The source record remains intact.

## Grounded questions and citations

Ask Document always sends one `documentId`. Ask Library supports the whole Library, one collection or an explicit set of at most 20 documents. `RetrievalService.resolveScope` rechecks ownership and soft-delete state before vector search. Qdrant still receives the mandatory authenticated `userId` filter.

No matching passage means the LLM is not called and the existing `usedContext: false` response is displayed as an honest absence of answer.

`SourceCitation` opens `SourcePreview`. The preview displays the document title, the real chunk/passage number and the returned excerpt. Desktop uses a light side panel; mobile uses a dismissible bottom sheet. Opening the document or closing the preview returns naturally to the answer.

## Multiple documents

The batch experience orchestrates the existing single-document endpoints with two concurrent uploads. Every item owns its state, error, retry and destination. Stopping a batch prevents waiting items from starting; already-started requests and successful documents are preserved. A processing failure retries by reindexing that document rather than duplicating it.

Global progress is derived from real settled item counts (`ready + failed`) and never from elapsed time. This lot does not persist a batch entity because no backend batch model exists; it does not claim themes or collection suggestions that the backend cannot provide.

## Context transitions

- **Tutor:** `documentId`, title, teaching mode and learning intent are passed to the Lot 6 lobby; Tutor creates/preserves the linked `ExperienceSession`.
- **Brain:** `documentId` is passed as route context; Lot 7 does not refactor Brain.
- **Workspace:** the existing document workspace route receives `id`, title and Library source marker; Lot 7 does not refactor Workspace.
- **Revision:** persisted flashcard resources keep their source document and the existing resource screen remains responsible for the review transition.

The Document screen's next actions are derived from real facts only: newly integrated concepts, absence of a flashcard resource, existing Brain links, or the ability to ask the source. At most three are shown.

## Quotas and errors

Structured quota payloads remain intact in `ApiError`. Document question and Library import surfaces distinguish quota errors, expose the reset when supplied, and link to Usage without automatic payment redirection. Network, provider, format, size and extraction errors keep successful uploads and user input visible. Trash stays recoverable; no destructive operation runs automatically.

## Accessibility and performance

- controls use explicit roles, selected/checked/busy states and 44-point targets;
- pipeline status has a screen-reader progress value;
- reduced-motion replaces processing animation with a static state and disables bottom-sheet animation;
- document selection and citations are keyboard-operable Pressables;
- cursor pagination, a 50-document Ask selector cap, a 20-document RAG scope, two upload workers, lazy citation preview and bounded text rendering prevent mass re-fetch/render work;
- polling occurs only while known documents are processing and stops offline.

## Validation

Pure shared tests cover pipeline mapping and partial batch progress. API tests cover pagination, user isolation, selected RAG scope, mandatory vector ownership filtering, context transitions, responsive source preview, quota and i18n presence. Full API/shared tests, typechecks, Expo web export and `git diff --check` are the Lot 7 regression gates.
