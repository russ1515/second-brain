'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const component = fs.readFileSync(path.resolve(__dirname, '../components/workspace/universal-capture.tsx'), 'utf8');
const screen = fs.readFileSync(path.resolve(__dirname, '../app/library/workspace/index.tsx'), 'utf8');
const scan = fs.readFileSync(path.resolve(__dirname, '../app/scan.tsx'), 'utf8');
const importer = fs.readFileSync(path.resolve(__dirname, '../lib/document-import.ts'), 'utf8');
const draft = fs.readFileSync(path.resolve(__dirname, '../lib/workspace-capture-draft.ts'), 'utf8');
const workspaceService = fs.readFileSync(path.resolve(__dirname, '../../api/src/workspaces/academic-workspace.service.ts'), 'utf8');

test('Universal Capture exposes exactly the five authorized entry modes', () => {
  assert.match(component, /\['photo', 'file', 'text', 'voice', 'library'\]/);
  for (const mode of ['text', 'file', 'photo', 'voice', 'library']) {
    assert.match(component, new RegExp(`workspace-capture-\\$\\{value\\}`));
    assert.match(component, new RegExp(`${mode}: '[^']+'`));
  }
});

test('free text becomes initial Workspace content without a parallel text uploader', () => {
  assert.match(component, /initialContent: initialContent\.trim\(\)/);
  assert.match(component, /mode === 'text' \|\| mode === 'voice'/);
  assert.doesNotMatch(component, /\/documents['"`]/);
});

test('file capture reuses the shared picker and document ingestion helper', () => {
  assert.match(component, /pickDocuments\(false, false\)/);
  assert.match(component, /uploadPickedDocument\(document, requestId\)/);
  assert.match(importer, /\/documents\/scan/);
  assert.match(importer, /\/documents\/upload/);
});

test('photo capture routes through the existing preview-and-confirm Scan screen', () => {
  assert.match(component, /pathname: '\/scan'/);
  assert.match(component, /source: 'workspace', captureType: 'photo'/);
  assert.match(scan, /testID="scan-return-to-workspace"/);
  assert.match(scan, /documentId: done\.id[\s\S]*captureStatus: done\.status/);
});

test('voice capture reuses Recorder and STT then leaves an editable transcript', () => {
  assert.match(component, /createRecorder\(\)/);
  assert.match(component, /apiUpload<TranscriptionResult>\('\/speech\/stt'/);
  assert.match(component, /setInitialContent\(transcript\.text\)/);
  assert.match(component, /testID="workspace-capture-text"[\s\S]*editable=\{hydrated && !busy && phase !== 'CAPTURING'\}/);
});

test('Library capture reuses owner-scoped documents and collections already loaded by the screen', () => {
  assert.match(screen, /api<LibraryPage>\(libraryPageUrl\(search\)/);
  assert.match(screen, /api<Collection\[]>\('\/library\/collections'\)/);
  assert.match(component, /kind = sourceMode === 'documents' \? 'document'/);
  assert.match(component, /'collection' as const/);
});

test('the backend remains authoritative for source ownership', () => {
  assert.match(workspaceService, /assertOwnedSources\(userId, sources, tx\)/);
  assert.match(workspaceService, /document\.count\(\{ where: \{ id: \{ in: documentIds \}, userId, deletedAt: null \} \}\)/);
  assert.match(workspaceService, /collection\.count\(\{ where: \{ id: \{ in: collectionIds \}, userId \} \}\)/);
});

test('single-flight guards prevent duplicate upload, attach and create actions', () => {
  assert.match(component, /if \(actionInFlight\.current\) return/);
  assert.match(component, /filePickerInFlight\.current \|\| actionInFlight\.current \|\| busy/);
  assert.match(component, /voiceTransitionInFlight\.current/);
  assert.ok((component.match(/actionInFlight\.current = true/g) ?? []).length >= 3);
  assert.ok((component.match(/actionInFlight\.current = false/g) ?? []).length >= 3);
  assert.match(component, /disabled=\{!hydrated \|\| busy \|\| phase === 'CAPTURING' \|\| documentPipelineBusy\}/);
});

test('file retry retains one logical request id and recovers an owned duplicate', () => {
  assert.match(component, /uploadRequestId\.current \?\? createClientRequestId\('workspace-upload'\)/);
  assert.match(component, /existingDocumentId/);
  assert.match(component, /\/retry-extraction/);
  assert.match(component, /workspace-capture-file-retry/);
  assert.match(importer, /requestId \? \{ requestId \} : undefined/);
});

test('an STT failure preserves the manual text fallback and reports ERROR', () => {
  const voiceBlock = component.slice(component.indexOf('const toggleVoice'), component.indexOf('const toggleSource'));
  assert.match(component, /catch \(caught\) \{[\s\S]*setPhase\('ERROR'\)[\s\S]*setError/);
  assert.match(component, /onChangeText=\{\(value\) => \{ setInitialContent\(value\)/);
  assert.doesNotMatch(voiceBlock, /setInitialContent\(''\)/);
});

test('capture intent, transcript and durable source ids resume per authenticated user', () => {
  assert.match(draft, /sb\.workspace\.capture\.v1/);
  assert.match(draft, /initialContent: draft\.initialContent\.slice\(0, 200_000\)/);
  assert.match(draft, /sources: normalizeSources\(draft\.sources\)/);
  assert.match(draft, /trackedDocumentId/);
  assert.match(draft, /attachmentId/);
  assert.match(draft, /createRequestId/);
  assert.match(draft, /createSignature/);
  assert.match(component, /loadWorkspaceCaptureDraft\(ownerUserId\)/);
  assert.match(component, /saveWorkspaceCaptureDraft\(ownerUserId/);
  assert.match(component, /clearWorkspaceCaptureDraft\(ownerUserId\)/);
});

test('the legacy administrative creation flow remains available but is not primary', () => {
  assert.match(screen, /testID="workspace-manual-toggle"/);
  assert.match(screen, /manualOpen \? <Card[\s\S]*testID="workspace-create"/);
  assert.match(screen, /testID="workspace-adaptive-fields"/);
});

test('minimal qualification keeps every one of the eight existing templates', () => {
  assert.match(component, /WORKSPACE_TEMPLATES\.map/);
  assert.match(component, /workspace-capture-template-\$\{value\}/);
  assert.match(component, /useState<WorkspaceTemplate>\('assignment'\)/);
  assert.doesNotMatch(component, /classif|orchestrat/i);
});

test('a durable document can attach to an existing dossier with revision protection', () => {
  assert.match(component, /api<PersistentWorkspace>\(`\/workspaces\/\$\{encodeURIComponent\(workspaceId\)\}`\)/);
  assert.match(component, /body: \{ sources: next, expectedRevision: current\.autosaveRevision \}/);
  assert.match(component, /mergeWorkspaceSources\(current\.sources, sources\)/);
});

test('text and voice captures can append idempotently to an existing dossier', () => {
  assert.match(component, /planWorkspaceCaptureAttachment\(current\.sources, next, current\.draft\.content, initialContent, attachmentId\)/);
  assert.match(component, /\/autosave/);
  assert.match(component, /draft: \{ format: current\.draft\.format, content: attachment\.content \}/);
  assert.doesNotMatch(component, /sources\.length && workspaces\.length/);
});

test('document polling follows the current capture rather than the first historical source', () => {
  assert.match(component, /const documentId = trackedDocumentId/);
  assert.match(component, /setTrackedDocumentId\(document\.id\)/);
  assert.doesNotMatch(component, /sources\.find\(\(source\) => source\.kind === 'document'\)/);
  assert.match(component, /setPollGeneration\(\(value\) => value \+ 1\)/);
});

test('leaving voice capture cancels the active recorder', () => {
  assert.match(component, /const cancelActiveRecording = \(\) =>/);
  assert.match(component, /if \(next !== 'voice'\) cancelActiveRecording\(\)/);
  assert.match(component, /cancelActiveRecording\(\);[\s\S]*setMode\('file'\)/);
  assert.match(component, /cancelActiveRecording\(\);[\s\S]*setMode\('photo'\)/);
  assert.match(component, /if \(next === 'voice' && recorder\.current\) return/);
  assert.match(component, /setMode\('file'\);[\s\S]*setPhase\(initialContent\.trim\(\) \|\| sources\.length \? 'READY' : 'IDLE'\)/);
});

test('capture uses honest named states without simulated progress percentages', () => {
  for (const phase of ['IDLE', 'CAPTURING', 'UPLOADING', 'PROCESSING', 'READY', 'ERROR']) {
    assert.match(component, new RegExp(`${phase}:`));
  }
  assert.doesNotMatch(component, /setInterval|fakeProgress|Math\.random/);
  assert.match(component, /const captureReady = phase === 'READY'/);
  assert.match(component, /setPollingExhausted\(true\)/);
  assert.match(component, /testID="workspace-capture-refresh-document"/);
  assert.match(component, /hydratedOwner\.current !== ownerUserId/);
  assert.match(component, /await saveWorkspaceCaptureDraft\(ownerUserId,[\s\S]*createRequestId: request\.requestId/);
  assert.match(component, /disabled=\{!hydrated \|\| !title\.trim\(\) \|\| busy \|\| !captureReady\}/);
});

test('existing workspace targets remain pageable instead of being truncated', () => {
  assert.match(screen, /\/workspaces\?limit=50&cursor=/);
  assert.match(component, /workspace-capture-load-more-workspaces/);
  assert.doesNotMatch(component, /workspaces\.slice\(/);
});

test('successful create or attach clears live state and cannot recreate the durable draft', () => {
  assert.match(component, /const resetCaptureAfterSuccess = async \(\) =>/);
  assert.match(component, /persistenceSuspended\.current = true;[\s\S]*await clearWorkspaceCaptureDraft\(ownerUserId\)[\s\S]*setInitialContent\(''\)[\s\S]*setSources\(\[\]\)/);
  assert.match(component, /captureCompleted\.current/);
  assert.match(component, /if \(persistenceSuspended\.current \|\| captureCompleted\.current/);
  assert.ok((component.match(/await resetCaptureAfterSuccess\(\)/g) ?? []).length >= 2);
});

test('the 50-source limit is explicit and preserves the pending capture', () => {
  assert.match(draft, /MAX_WORKSPACE_CAPTURE_SOURCES = 50/);
  assert.match(component, /const rejectedSources = sources\.filter/);
  assert.match(component, /if \(rejectedSources\.length\) \{[\s\S]*rejectSourceLimit\(\);[\s\S]*return;/);
  assert.match(component, /workspaceCapture\.sourceLimit/);
  assert.doesNotMatch(component, /rejectedSources\.length[\s\S]{0,200}clearWorkspaceCaptureDraft/);
});

test('older Library documents remain selectable through owner-reloaded search and pagination', () => {
  assert.match(screen, /libraryPageUrl\(search, cursor\)/);
  assert.match(screen, /onLoadMoreDocuments=\{\(\) => void loadMoreDocuments\(\)\}/);
  assert.match(component, /workspace-capture-document-search/);
  assert.match(component, /workspace-capture-load-more-documents/);
  assert.match(screen, /\[documentSearch, user\?\.id\]/);
  assert.match(screen, /\[user\?\.id\]/);
});

test('document state labels come from persisted status and stage without treating partial as completed', () => {
  assert.match(component, /resolveDocumentPipeline\(document\.status, document\.stage\)/);
  assert.match(component, /document\.pipeline\.partial/);
  assert.match(component, /documentStatusKey\(initialDocument\?\.status\)/);
  assert.doesNotMatch(component, /status === 'ready' \|\| initialDocument\?\.status === 'partial'/);
});

test('file extraction retry re-reads durable status before issuing a retry command', () => {
  assert.match(component, /const latest = await api<DocumentDetail>\(`\/documents\/\$\{encodeURIComponent\(failedDocumentId\)\}`\)/);
  assert.match(component, /if \(latest\.status !== 'failed'\)/);
  assert.match(component, /latest\.status === 'pending' \|\| latest\.status === 'processing'/);
});

test('paged results are ignored when owner, search, cursor or generation changes', () => {
  assert.match(screen, /workspaceListEpoch/);
  assert.match(screen, /documentListEpoch/);
  assert.match(screen, /listOwnerRef\.current !== ownerId/);
  assert.match(screen, /documentSearchRef\.current !== search/);
  assert.match(screen, /workspaceCursorRef\.current !== cursor/);
  assert.match(screen, /documentCursorRef\.current !== cursor/);
});

test('create idempotency persists a bounded fingerprint rather than truncated JSON', () => {
  assert.match(component, /workspaceCaptureSignature\(JSON\.stringify\(body\)\)/);
  assert.match(draft, /normalizeCreateSignature/);
  assert.doesNotMatch(draft, /createSignature: draft\.createSignature\?\.slice/);
});

test('an indeterminate polling error keeps the document locked and exposes refresh', () => {
  assert.match(component, /setDocumentUnsettled\(true\);[\s\S]*setPollingExhausted\(true\);[\s\S]*setPhase\('ERROR'\)/);
  assert.match(component, /documentUnsettled \|\| phase === 'UPLOADING' \|\| phase === 'PROCESSING'/);
  assert.match(component, /pollingExhausted && documentUnsettled && trackedDocumentId/);
  assert.match(component, /testID="workspace-capture-refresh-document"/);
  assert.match(component, /failedDocumentId \|\| \(pickedFile\.current && !trackedDocumentId\)/);
});
