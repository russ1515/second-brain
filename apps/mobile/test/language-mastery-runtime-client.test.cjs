'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '../../..');
const client = fs.readFileSync(
  path.join(ROOT, 'apps/mobile/lib/language-rll-client.ts'),
  'utf8',
);
const courseLesson = fs.readFileSync(
  path.join(ROOT, 'apps/mobile/app/languages/[id]/course/lesson.tsx'),
  'utf8',
);
const examiner = fs.readFileSync(
  path.join(ROOT, 'apps/mobile/app/examiner/[id].tsx'),
  'utf8',
);
const courseUi = fs.readFileSync(
  path.join(ROOT, 'apps/mobile/components/language/course-ui.tsx'),
  'utf8',
);
const lesson = fs.readFileSync(
  path.join(ROOT, 'apps/mobile/app/lesson/[id].tsx'),
  'utf8',
);

test('mobile uses the canonical scoped mastery API contracts', () => {
  assert.match(client, /endpoint\(profileId, '\/course\/mastery\/start'\)/);
  assert.match(client, /body: request/);
  assert.match(client, /endpoint\(profileId, '\/course\/mastery\/submit'\)/);

  assert.match(examiner, /params\.mastery === '1'/);
  assert.match(examiner, /params\.masteryScopeKind === 'milestone'/);
  assert.match(examiner, /params\.masteryScopeKind === 'pillar_exam'/);
  assert.match(examiner, /submitRlleScopedMastery\(params\.languageProfileId/);
  assert.match(examiner, /attemptId: params\.masteryAttemptId/);
  assert.match(examiner, /assessmentId: id/);
  assert.match(examiner, /answers,/);
  assert.match(examiner, /setMasteryCourse\(response\.course\)/);
  assert.match(examiner, /testID="language-mastery-continue"/);
  assert.match(examiner, /masteryCourse\.status === 'completed'/);
  assert.match(examiner, /\['active', 'paused'\]\.includes\(masteryCourse\.currentLesson\.status\)/);
  assert.match(examiner, /resumableLessonUnitId \?\? nextUnit\?\.id/);
  assert.match(examiner, /router\.replace\(destination as never\)/);
});

test('course and lesson surface the server bulletin capability lock without a client gate', () => {
  assert.match(
    courseUi,
    /bulletin\.notionGateUnlocked && bulletin\.strictCertification\.unlocked === false/,
  );
  assert.match(courseUi, /rlle\.ui\.capabilities\.blocked/);
  assert.match(courseUi, /rlle\.ui\.capabilities\.blockedDetail/);
  assert.match(courseLesson, /<LanguageMasteryBulletins/);
  assert.match(courseLesson, /bulletins=\{course\.masteryBulletins\}/);
});

test('remediation evidence is linked only from a persisted exercise attempt', () => {
  assert.match(client, /endpoint\(profileId, '\/course\/remediation\/evidence'\)/);
  assert.match(courseLesson, /remediation\?\.planId/);
  assert.match(courseLesson, /remediation\.lessonId === lessonId/);
  assert.match(courseLesson, /failedAttemptId=\$\{encodeURIComponent\(remediation\.sourceAttemptId\)\}/);

  assert.match(lesson, /const response = await api<SubmitAttemptResponse>/);
  assert.match(lesson, /exerciseAttemptId: response\.attempt\.id/);
  assert.match(lesson, /lessonId: response\.attempt\.lessonId/);
  assert.match(lesson, /exerciseIndex: response\.attempt\.exerciseIndex/);
  assert.match(lesson, /trainingFormat: exercise\.languageFormat/);
  assert.match(lesson, /setPendingEvidence\(evidenceRequest\)/);
  assert.match(lesson, /recordRemediationEvidence\(pendingEvidence\)/);
  assert.match(lesson, /writtenSubmissionInFlight\.current \|\| result/);
  assert.match(lesson, /busy=\{busy \|\| Boolean\(result\)\}/);
  assert.doesNotMatch(lesson, /state:\s*['"]completed['"]/);
});

test('client remains fail-closed and does not calculate mastery eligibility', () => {
  assert.match(courseLesson, /featureFlags\.languageMasteryV1/);
  assert.match(courseLesson, /course\?\.nextMasteryTarget \?\? null/);
  assert.match(courseLesson, /nextMasteryTarget\?\.eligible/);
  assert.match(courseLesson, /idempotencyKey: nextMasteryTarget\.operationKey/);
  assert.match(courseLesson, /nextMasteryTarget\?\.activeAttemptId/);
  assert.match(courseLesson, /nextMasteryTarget\.assessmentId/);
  assert.match(lesson, /featureFlags\.languageMasteryV1/);
  assert.doesNotMatch(courseLesson, /RLLE_LANGUAGE_MASTERY_UNIT_MAP/);
  assert.doesNotMatch(courseLesson, /getRlleLevelPillarPlans/);
  assert.doesNotMatch(courseLesson, /requiredMilestoneIds/);
  assert.doesNotMatch(courseLesson, /LANGUAGE_MASTERY_THRESHOLD/);
});

test('feature-off keeps legacy autonomy while feature-on never falls back to it', () => {
  assert.match(courseLesson, /startRlleAutonomy\(profile\.id/);
  assert.match(
    courseLesson,
    /!featureFlags\.languageMasteryV1[\s\S]*mastery\?\.status === 'autonomy-ready'[\s\S]*startLegacyAutonomyAssessment/,
  );
  assert.match(
    courseLesson,
    /featureFlags\.languageMasteryV1[\s\S]*course\?\.nextMasteryTarget \?\? null/,
  );
  assert.match(
    courseLesson,
    /nextMasteryTarget\?\.eligible[\s\S]*startScopedMasteryAssessment/,
  );
  assert.doesNotMatch(
    courseLesson,
    /nextMasteryTarget\?\.eligible\s*\?[^:]+:\s*startLegacyAutonomyAssessment/,
  );
});
