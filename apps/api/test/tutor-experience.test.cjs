'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../../..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

test('Tutor lobby prioritizes exact resume, then a new request and bounded history', () => {
  const screen = read('apps/mobile/app/tutor/index.tsx');
  assert.match(screen, /testID="tutor-lobby"/);
  assert.ok(screen.indexOf('tutor6.lobby.continueTitle') < screen.indexOf('tutor6.lobby.newTitle'));
  assert.ok(screen.indexOf('tutor6.lobby.newTitle') < screen.indexOf('tutor6.lobby.recent'));
  assert.match(screen, /slice\(0, 3\)/);
  assert.match(screen, /experienceSession\?\.status/);
  assert.doesNotMatch(screen, /\/twin\/next|\/coach\/today/);
});

test('Tutor creation carries Learn intent, modality and exact domain contexts', () => {
  const learn = read('apps/mobile/app/(tabs)/learn.tsx');
  const tutor = read('apps/api/src/tutor/tutor.service.ts');
  for (const field of ['objective', 'intent', 'mode', 'inputModality', 'activeContexts']) {
    assert.match(learn, new RegExp(field));
  }
  assert.match(tutor, /ensureTutorSession/);
  assert.match(tutor, /resumeTarget: \{ kind: 'route', path: `\/tutor\/\$\{session\.id\}` \}/);
  assert.match(tutor, /hasDocumentScope \? documentIds : undefined/);
});

test('Tutor resume restores server state and local drafts without unbounded reads', () => {
  const screen = read('apps/mobile/app/tutor/[id].tsx');
  const drafts = read('apps/mobile/lib/tutor/session-draft.ts');
  const service = read('apps/api/src/tutor/tutor.service.ts');
  assert.match(screen, /experienceSession\?\.status === 'paused'/);
  assert.match(screen, /experience-sessions\/\$\{detail\.experienceSession\.id\}\/resume/);
  assert.match(drafts, /AsyncStorage/);
  assert.match(drafts, /userId, sessionId/);
  assert.match(service, /SESSION_LIST_LIMIT = 20/);
  assert.match(service, /SESSION_MESSAGE_LIMIT = 100/);
  assert.match(service, /orderBy: \{ createdAt: 'desc' \}/);
});

test('Provider and quota failures preserve work and keep non-AI navigation available', () => {
  const screen = read('apps/mobile/app/tutor/[id].tsx');
  const voice = read('apps/api/src/tutor/voice.service.ts');
  assert.match(screen, /isQuotaError/);
  assert.match(screen, /router\.push\('\/usage'\)/);
  assert.match(screen, /router\.push\('\/library'\)/);
  assert.match(screen, /tutor6\.error\.preserved/);
  assert.match(voice, /preserveVoiceTranscript/);
  assert.match(voice, /transcript: transcript\.text/);
});

test('Conversation uses structured blocks, real-only progress and responsive secondary actions', () => {
  const screen = read('apps/mobile/app/tutor/[id].tsx');
  const components = read('apps/mobile/components/tutor/experience.tsx');
  assert.match(screen, /<ContextBar/);
  assert.match(screen, /<TutorMessage/);
  assert.match(screen, /<ProgressNarrative/);
  assert.match(screen, /<ResultActionBar/);
  assert.match(screen, /<Sheet visible=\{optionsOpen\}/);
  assert.match(components, /progress\.percent !== undefined/);
  assert.match(components, /session\.twinImpact\?\.changes/);
  assert.doesNotMatch(components, /setInterval|Math\.random/);
});

test('Tutor data access is user-scoped, including ExperienceSession lookup and source retrieval', () => {
  const experience = read('apps/api/src/experience-sessions/experience-session.service.ts');
  const tutor = read('apps/api/src/tutor/tutor.service.ts');
  assert.match(experience, /where: \{ userId, tutorSessionId, type: \{ in: \['tutor', 'language'\] \} \}/);
  assert.match(tutor, /this\.retrieval\.search\(userId/);
  assert.match(tutor, /where: \{ userId, id: \{ in: documents \}, deletedAt: null \}/);
});
