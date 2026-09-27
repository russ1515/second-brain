'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { TutorService } = require('../dist/tutor/tutor.service.js');
const { resolveTeacherPolicy } = require('@second-brain/shared');

const root = path.resolve(__dirname, '../../..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

test('Tutor snapshots trusted teacher policy in ExperienceSession metadata', () => {
  const source = read('apps/api/src/tutor/tutor.service.ts');
  assert.match(source, /metadata: \{[\s\S]*?teacherPolicy,[\s\S]*?teacherPolicySource: TEACHER_POLICY_METADATA_SOURCE/);
  assert.match(source, /isTeacherPolicySnapshot\(stored\)/);
  assert.match(source, /teacherPolicyDirective\(teacherPolicy\)/);
  assert.match(source, /findByTutorSession\(userId, session\.id\)/);
});

test('live Profile changes do not replace the running Tutor policy', () => {
  const source = read('apps/api/src/tutor/tutor.service.ts');
  const ensureStart = source.indexOf('private async ensureTeacherPolicy');
  const ensureEnd = source.indexOf('private firstContextReference', ensureStart);
  const ensure = source.slice(ensureStart, ensureEnd);
  assert.ok(ensureStart > 0 && ensureEnd > ensureStart);
  assert.ok(ensure.indexOf('isTeacherPolicySnapshot(stored)') < ensure.indexOf('loadTeacherPreferences'));
});

test('Examiner persists a versioned immutable policy beside private rubrics', () => {
  const source = read('apps/api/src/examiner/examiner.service.ts');
  assert.match(source, /interface StoredAssessmentPayload/);
  assert.match(source, /version: 2,/);
  assert.match(source, /teacherPolicy,/);
  assert.match(source, /assessment: true/);
  assert.match(source, /teacherPolicyDirective\(teacherPolicy\)/);
  assert.match(source, /questions: payload\.questions\.map/);
  assert.doesNotMatch(read('packages/shared/src/assessment.ts'), /answerKey/);
});

test('language practice and written lessons reuse the same trusted policy engine', () => {
  const conversation = read('apps/api/src/languages/conversation.service.ts');
  const lesson = read('apps/api/src/lessons/lesson.service.ts');
  const exercise = read('apps/api/src/lessons/assessment.service.ts');
  assert.match(conversation, /teacherPolicy,/);
  assert.match(conversation, /teacherPolicyDirective\(teacherPolicy\)/);
  assert.match(lesson, /resolveTeacherPolicy\(teacherPreferences/);
  assert.match(lesson, /teacherPolicyDirective\(teacherPolicy\)/);
  assert.match(exercise, /\{ mode: 'exercise', intent: 'practice' \}/);
  assert.match(exercise, /teacherPolicyDirective\(policy\)/);
});

test('lesson adaptation obeys the toggle and corrections reuse a server snapshot', () => {
  const lesson = read('apps/api/src/lessons/lesson.service.ts');
  const assessment = read('apps/api/src/lessons/assessment.service.ts');
  const sessions = read('apps/api/src/experience-sessions/experience-session.service.ts');
  assert.match(lesson, /teacherPreferences\?\.automaticAdaptation === false/);
  assert.match(lesson, /ensureLessonSession\(userId/);
  assert.match(assessment, /teacherPolicyForLesson\(userId, lesson\)/);
  assert.match(assessment, /findByLesson\(userId, lesson\.id\)/);
  assert.match(sessions, /request\.links\?\.lessonId/);
});

test('Tutor prompt omits mastery, strategy and Learning DNA when adaptation is off', () => {
  const service = new TutorService({}, {}, {}, {}, {}, {}, {});
  const policy = resolveTeacherPolicy(
    { automaticAdaptation: false },
    { mode: 'conversation', intent: 'learn' },
  );
  const prompt = service.systemPrompt(
    { name: 'Fractions', mastery: 0.2, level: 'fragile' },
    undefined,
    undefined,
    undefined,
    'worked_example',
    'en',
    ' Adapt your delivery using Learning DNA maturity=90%.',
    policy,
  );
  assert.match(prompt, /explicitly selected concept "Fractions"/);
  assert.doesNotMatch(prompt, /20%|fragile|Learning DNA|worked example/i);
  assert.match(prompt, /do not auto-adjust pace or difficulty/i);
});

test('teacher Profile JSON is allow-listed before it becomes trusted policy', () => {
  const onboarding = read('apps/api/src/onboarding/onboarding.service.ts');
  assert.match(onboarding, /sanitizeTeacherPatch\(answers\.teacher\)/);
  assert.match(onboarding, /sanitizeTeacherPreferences\(current\?\.teacher\)/);
  assert.match(onboarding, /sanitizeTeacherPreferences\(value\)/);
});

test('public ExperienceSession writes strip server teacher-policy metadata', () => {
  const controller = read('apps/api/src/experience-sessions/experience-session.controller.ts');
  const service = read('apps/api/src/experience-sessions/experience-session.service.ts');
  const tutor = read('apps/api/src/tutor/tutor.service.ts');
  const language = read('apps/api/src/languages/conversation.service.ts');
  assert.match(controller, /createFromClient\(user\.userId, dto\)/);
  assert.match(controller, /updateFromClient\(user\.userId, id, dto\)/);
  assert.match(service, /delete metadata\.teacherPolicy/);
  assert.match(service, /delete metadata\.teacherPolicySource/);
  assert.match(service, /preservePolicy/);
  assert.match(tutor, /source === TEACHER_POLICY_METADATA_SOURCE/);
  assert.match(service, /SERVER_IDEMPOTENCY_PREFIX = 'server:v2:'/);
  assert.match(service, /RESERVED_CLIENT_IDEMPOTENCY_PREFIXES/);
  assert.match(language, /ensureLanguageSession\(userId/);
  assert.doesNotMatch(language, /language-conversation:\$\{session\.id\}/);
});
