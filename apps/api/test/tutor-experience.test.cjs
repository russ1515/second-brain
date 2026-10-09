'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { tutorRetrievalScope } = require('../dist/tutor/tutor-context-policy.js');

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
  assert.match(tutor, /retrievalScope\.explicit/);
  assert.match(tutor, /\? await this\.retrieveContext\(userId, query, documentIds\)/);
});

test('a new philosophy request after Swahili has no implicit library scope, while explicit resume sources persist', () => {
  const afterLanguage = tutorRetrievalScope([
    { kind: 'language', referenceId: 'swahili-profile', label: 'Swahili' },
    { kind: 'concept', referenceId: 'philosophy', label: 'Philosophy' },
  ]);
  assert.deepEqual(afterLanguage, { explicit: false, documentIds: [], collectionIds: [] });

  const explicit = [
    { kind: 'document', referenceId: 'philosophy-notes' },
    { kind: 'document-collection', referenceId: 'ethics-course' },
  ];
  const firstTurn = tutorRetrievalScope(explicit);
  const resumedTurn = tutorRetrievalScope(explicit);
  assert.deepEqual(firstTurn, {
    explicit: true,
    documentIds: ['philosophy-notes'],
    collectionIds: ['ethics-course'],
  });
  assert.deepEqual(resumedTurn, firstTurn);
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
  assert.match(service, /orderBy: \[\{ createdAt: 'desc' \}, \{ id: 'desc' \}\]/);
  assert.match(service, /const assistantCreatedAt = new Date\(userCreatedAt\.getTime\(\) \+ 1\)/);
  assert.match(service, /const messages = \[\.\.\.session\.messages\]\.reverse\(\)/);
  assert.match(screen, /session\.messages\.map/);
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

test('Conversation uses structured blocks, real-only progress and a compact centered composer', () => {
  const screen = read('apps/mobile/app/tutor/[id].tsx');
  const components = read('apps/mobile/components/tutor/experience.tsx');
  const markdown = read('apps/mobile/components/markdown.tsx');
  assert.match(screen, /<ContextBar/);
  assert.match(screen, /<TutorMessage/);
  assert.match(screen, /<ProgressNarrative/);
  assert.match(screen, /<ResultActionBar/);
  assert.match(screen, /maxWidth: 820/);
  assert.match(screen, /testID="tutor-send"/);
  assert.match(screen, /testID="tutor-voice-toggle"/);
  assert.match(screen, /<KeyboardAvoidingView/);
  assert.match(screen, /style=\{\{ flex: 1, minHeight: 0/);
  assert.match(screen, /flexShrink: 0/);
  assert.match(screen, /width: '100%', minWidth: 0, flexDirection: 'row'/);
  assert.doesNotMatch(screen, /optionsOpen|secondaryActions|sendPace|STRATEGY_LABEL/);
  assert.doesNotMatch(screen, /TutorSidebar|conversationSidebar|historySidebar/);
  assert.match(components, /globalPath\.copy/);
  assert.match(components, /onSavePdf/);
  assert.match(read('apps/mobile/components/speak-button.tsx'), /<IconButton icon="🔊"/);
  assert.match(components, /progress\.percent !== undefined/);
  assert.match(components, /session\.twinImpact\?\.changes/);
  assert.doesNotMatch(components, /setInterval|Math\.random/);
  assert.match(markdown, /const FENCE =/);
  assert.match(markdown, /const HORIZONTAL_RULE =/);
  assert.match(markdown, /const TABLE_ROW =/);
  assert.match(markdown, /replace\(\/!\\\[/);
  assert.match(markdown, /textDecorationLine: 'line-through'/);
});

test('Opening a Library document in Professor waits for an explicit request and keeps a strict document scope', () => {
  const entry = read('apps/mobile/app/tutor/index.tsx');
  assert.match(entry, /if \(mode === 'teach'\)/);
  assert.match(entry, /contexts\.filter\(\(item\) => item\.kind === 'document'\)/);
  assert.match(entry, /<DocumentProfessor initialQuery=\{initialQuery\} documentContexts=\{documentContexts\}/);
  assert.match(entry, /initialContexts=\{documentContexts\}/);
  assert.match(entry, /mode="teach"/);
  assert.match(entry, /intent="learn-document"/);
  assert.match(entry, /initialContexts\.length > 0 \? <ContextBar items=\{initialContexts\}/);
  assert.match(entry, /const ask = async \(\) =>/);
  assert.doesNotMatch(entry, /useEffect\(\(\) => \{?\s*void ask\(/);
});

test('Tutor data access is user-scoped, including ExperienceSession lookup and source retrieval', () => {
  const experience = read('apps/api/src/experience-sessions/experience-session.service.ts');
  const tutor = read('apps/api/src/tutor/tutor.service.ts');
  assert.match(experience, /userId_idempotencyKey/);
  assert.match(experience, /row\.tutorSessionId === tutorSessionId/);
  assert.match(experience, /row\.type === 'tutor' \|\| row\.type === 'language'/);
  assert.match(tutor, /this\.retrieval\.search\(userId/);
  assert.match(tutor, /where: \{ userId, id: \{ in: documents \}, deletedAt: null \}/);
});
