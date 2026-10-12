'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '../../..');
const shared = fs.readFileSync(
  path.join(ROOT, 'packages/shared/src/real-life-language.ts'),
  'utf8',
);
const client = fs.readFileSync(
  path.join(ROOT, 'apps/mobile/lib/language-rll-client.ts'),
  'utf8',
);
const lesson = fs.readFileSync(
  path.join(ROOT, 'apps/mobile/app/languages/[id]/course/lesson.tsx'),
  'utf8',
);

test('server projection selects generated versus acoustic mastery explicitly', () => {
  assert.match(shared, /assessmentMode:\s*'generated'\s*\|\s*'acoustic'/);
  assert.match(lesson, /nextMasteryTarget\.assessmentMode !== 'acoustic'/);
  assert.match(lesson, /nextMasteryTarget\.assessmentMode === 'acoustic'/);
  assert.doesNotMatch(lesson, /RLLE_LANGUAGE_MASTERY_UNIT_MAP/);
});

test('acoustic client sends exactly two recordings and server-owned identifiers', () => {
  const start = client.indexOf('export async function submitRlleAcousticMastery');
  const end = client.indexOf('/** Records only an already-persisted', start);
  assert.ok(start >= 0 && end > start, 'acoustic multipart client must exist');
  const acoustic = client.slice(start, end);

  assert.match(acoustic, /form\.append\(\s*'scriptedAudio'/);
  assert.match(acoustic, /form\.append\(\s*'spontaneousAudio'/);
  assert.match(acoustic, /form\.append\('experienceSessionId'/);
  assert.match(acoustic, /form\.append\('lessonId'/);
  assert.match(acoustic, /form\.append\('targetId'/);
  assert.match(acoustic, /form\.append\('idempotencyKey'/);
  assert.match(acoustic, /form\.append\('exerciseIndex'/);
  assert.match(acoustic, /endpoint\(profileId, '\/course\/mastery\/acoustic'\)/);
  assert.doesNotMatch(acoustic, /durationMs/);
  assert.doesNotMatch(acoustic, /rawScore|awardedPoints|maximumPoints/);
});

test('capture UI requires scripted and spontaneous audio and keeps retry idempotent', () => {
  assert.match(lesson, /testID="language-acoustic-scripted-record"/);
  assert.match(lesson, /testID="language-acoustic-spontaneous-record"/);
  assert.match(lesson, /!acousticRecordings\.scripted/);
  assert.match(lesson, /!acousticRecordings\.spontaneous/);
  assert.match(lesson, /idempotencyKey: nextMasteryTarget\.operationKey/);
  assert.match(lesson, /setAcousticRetryPending\(true\)/);
  assert.match(lesson, /Keep both blobs and the stable operation key/);
});

test('the learner sees the actual versioned pronunciation exercise', () => {
  assert.match(client, /api<LessonView>\(`\/lessons\/\$\{encodeURIComponent\(lessonId\)\}`\)/);
  assert.match(client, /exercise\.languageFormat === 'voice-pronunciation'/);
  assert.match(client, /Boolean\(exercise\.audioText\?\.trim\(\)\)/);
  assert.match(lesson, /acousticPrompt\.referenceText/);
  assert.match(lesson, /acousticPrompt\.spontaneousPrompt/);
});
