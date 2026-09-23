'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../../..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

test('Learn is composer-first and only loads the lightweight resumable-session source', () => {
  const screen = read('apps/mobile/app/(tabs)/learn.tsx');
  assert.match(screen, /<UniversalComposer/);
  assert.match(screen, /experience-sessions\/resumable\?limit=3/);
  assert.doesNotMatch(screen, /\/onboarding/);
  assert.doesNotMatch(screen, /\/home\/overview/);
  assert.ok(screen.indexOf('<UniversalComposer') < screen.indexOf('learn5.spaces.title'));
});

test('Universal Composer preserves drafts and exposes all four modalities', () => {
  const composer = read('apps/mobile/components/learn/universal-composer.tsx');
  const draft = read('apps/mobile/lib/learn/composer-draft.ts');
  for (const modality of ['write', 'speak', 'capture', 'import']) {
    assert.match(composer, new RegExp(`learn5\\.modality\\.${modality}`));
  }
  assert.match(draft, /AsyncStorage/);
  assert.match(composer, /shouldClearLearnDraft/);
  assert.match(composer, /ContextBar/);
  assert.match(composer, /Sheet/);
});

test('advanced engines stay secondary and destination screens accept composer prefill', () => {
  const learn = read('apps/mobile/app/(tabs)/learn.tsx');
  assert.match(learn, /useState\(false\)/);
  assert.match(learn, /advancedOpen \?/);
  assert.match(read('apps/mobile/app/tutor/index.tsx'), /initialQuery/);
  assert.match(read('apps/mobile/app/library/ask.tsx'), /params\.q/);
  assert.match(read('apps/mobile/app/examiner/index.tsx'), /params\.topic/);
  assert.match(read('apps/mobile/app/writing/index.tsx'), /params\.instructions/);
});

test('Resume keeps exact session, lesson, document and workspace destinations', () => {
  const learn = read('apps/mobile/app/(tabs)/learn.tsx');
  for (const link of ['tutorSessionId', 'studySessionId', 'lessonId', 'documentId', 'languageProfileId', 'workspaceRef']) {
    assert.match(learn, new RegExp(`session\\.links\\.${link}`));
  }
  assert.match(learn, /slice\(0, 3\)/);
  assert.match(learn, /<ResumeSection/);
});

test('Lot 5 introduces no client analytics system or automatic AI fan-out', () => {
  const learn = read('apps/mobile/app/(tabs)/learn.tsx');
  const composer = read('apps/mobile/components/learn/universal-composer.tsx');
  assert.doesNotMatch(`${learn}\n${composer}`, /telemetry|analytics|trackEvent|Promise\.all/);
});
