import assert from 'node:assert/strict';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const flow = await import(pathToFileURL(path.resolve(import.meta.dirname, '../lib/workspace-capture-flow.ts')));

test('capture attachment appends text once and preserves the existing draft', () => {
  const plan = flow.planWorkspaceCaptureAttachment([], [], 'Existing paragraph.', 'Captured instruction.', 'capture-1');
  assert.equal(plan.contentChanged, true);
  assert.equal(plan.content, `Existing paragraph.\n\nCaptured instruction.${flow.workspaceCaptureMarker('capture-1')}`);
});

test('replaying the same captured text is idempotent', () => {
  const content = `Existing paragraph.\n\nCaptured instruction.${flow.workspaceCaptureMarker('capture-1')}`;
  const plan = flow.planWorkspaceCaptureAttachment([], [], content, 'Captured instruction.', 'capture-1');
  assert.equal(plan.contentChanged, false);
  assert.equal(plan.content, content);
});

test('a lost autosave response remains idempotent after a concurrent edit', () => {
  const saved = flow.planWorkspaceCaptureAttachment([], [], 'Existing paragraph.', 'Captured instruction.', 'capture-1').content;
  const concurrentlyEdited = `${saved}\n\nConcurrent paragraph.`;
  const replay = flow.planWorkspaceCaptureAttachment([], [], concurrentlyEdited, 'Captured instruction.', 'capture-1');
  assert.equal(replay.contentChanged, false);
  assert.equal(replay.content, concurrentlyEdited);
  assert.equal(replay.content.match(/Captured instruction\./g)?.length, 1);
});

test('attachment markers are deterministic, compact and distinguish capture ids', () => {
  const marker = flow.workspaceCaptureMarker('capture-1'.repeat(40));
  assert.equal([...marker].length, 66);
  assert.equal(marker, flow.workspaceCaptureMarker('capture-1'.repeat(40)));
  assert.notEqual(marker, flow.workspaceCaptureMarker('capture-2'.repeat(40)));
  assert.doesNotMatch(marker, /[A-Za-z0-9]/);
});

test('create signatures stay bounded for maximally escaped large content', () => {
  const body = JSON.stringify({ initialContent: '\u0000"\\'.repeat(70_000), title: 'Large capture' });
  const signature = flow.workspaceCaptureSignature(body);
  assert.ok(body.length > 400_000);
  assert.ok(signature.length < 80);
  assert.equal(signature, flow.workspaceCaptureSignature(body));
  assert.notEqual(signature, flow.workspaceCaptureSignature(`${body}x`));
});

test('source attachment changes only when the ordered durable references change', () => {
  const owned = [{ kind: 'document', id: 'document-1', title: 'Owned document' }];
  assert.equal(flow.planWorkspaceCaptureAttachment([], owned, '', '', 'capture-1').sourcesChanged, true);
  assert.equal(flow.planWorkspaceCaptureAttachment(owned, owned, '', '', 'capture-1').sourcesChanged, false);
});

test('blank capture text never erases or rewrites a dossier', () => {
  const plan = flow.planWorkspaceCaptureAttachment([], [], 'Keep me', '   ', 'capture-1');
  assert.equal(plan.contentChanged, false);
  assert.equal(plan.content, 'Keep me');
});
