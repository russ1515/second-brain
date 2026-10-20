'use strict';

require('reflect-metadata');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { randomUUID } = require('node:crypto');
const { PrismaClient } = require('@prisma/client');
const { PhoneticAttemptService } = require('../dist/languages/phonetic-attempt.service.js');
const { PhoneticAssessmentEngine } = require('../dist/languages/phonetic-assessment.engine.js');
const { loadPhoneticPassportSummary } = require('../dist/languages/phonetic-attempt-projection.js');

// Opt-in application-service acceptance, NOT a bootstrap or fixture mutator.
// An operator must identify the existing authorized technical learner and
// authored exercise. No account, lesson, grade, token or schema is created here.
const enabled = process.env.SB_PHONETIC_PG_AUTHORIZED === 'true';
test('real PostgreSQL retains one technical acoustic attempt through independent application reads', {
  skip: !enabled,
}, async () => {
  const required = (key) => {
    assert.ok(process.env[key], `Required private/local setting ${key} is missing.`);
    return process.env[key];
  };
  const databaseUrl = new URL(required('DATABASE_URL'));
  assert.ok(['postgres:', 'postgresql:'].includes(databaseUrl.protocol));
  assert.equal(decodeURIComponent(databaseUrl.pathname.slice(1)), required('SB_PHONETIC_PG_DATABASE_NAME'));
  assert.ok(!/(?:^|[._/-])prod(?:uction)?(?:[._/?-]|$)/iu.test(databaseUrl.pathname), 'Production database is forbidden.');
  const userId = required('SB_PHONETIC_PG_USER_ID');
  const technicalEmail = required('SB_PHONETIC_PG_TECHNICAL_EMAIL');
  assert.ok(['p1-placement-retest-20261020@example.test', 'p1-browser-learner@example.test'].includes(technicalEmail),
    'Only the two explicitly authorized existing technical accounts are accepted.');
  const profileId = required('SB_PHONETIC_PG_PROFILE_ID');
  const lessonId = required('SB_PHONETIC_PG_LESSON_ID');
  const exerciseIndex = Number(required('SB_PHONETIC_PG_EXERCISE_INDEX'));
  assert.ok(Number.isInteger(exerciseIndex) && exerciseIndex >= 0);
  const audio = fs.readFileSync(required('SB_PHONETIC_TEST_WAV'));
  const first = new PrismaClient();
  const reloaded = new PrismaClient();
  try {
    await first.$connect();
    const owner = await first.user.findUnique({ where: { id: userId },
      select: { email: true, emailVerified: true } });
    assert.ok(owner && owner.email === technicalEmail && owner.emailVerified,
      'The existing verified technical identity must match exactly before any write.');
    const profile = await first.languageProfile.findFirst({ where: { id: profileId, userId },
      select: { id: true, normalizedLanguage: true } });
    assert.ok(profile && profile.normalizedLanguage === 'en');
    const lesson = await first.lesson.findFirst({ where: { id: lessonId, userId, languageProfileId: profileId },
      select: { id: true, exercises: true, contentVersion: true } });
    assert.ok(lesson && Array.isArray(lesson.exercises));
    assert.equal(lesson.exercises[exerciseIndex]?.languageFormat, 'voice-pronunciation');
    assert.equal(typeof lesson.exercises[exerciseIndex]?.audioText, 'string');
    const beforeCompletions = await first.learningCompletion.count({ where: { userId } });
    const engine = new PhoneticAssessmentEngine({ get: (key) => process.env[key] });
    const capabilities = await engine.capabilities();
    assert.ok(capabilities.enabled && capabilities.available, 'Local acoustic engine must be actually ready.');
    const service = new PhoneticAttemptService(first, engine);
    const attempt = await service.assess(userId, profileId, {
      lessonId, exerciseIndex, idempotencyKey: `phase-h-pg-${randomUUID()}`,
    }, { buffer: audio, mimetype: 'audio/wav' });
    assert.equal(attempt.state, 'complete');
    assert.equal(attempt.result?.status, 'EVIDENCE_AVAILABLE');
    assert.equal(attempt.masteryEligible, false);
    assert.equal(attempt.audioRetained, false);
    assert.equal(attempt.result?.overallAcousticScore, null);

    // A fresh DB connection/service models a server reload. This is deliberately
    // not called browser F5 or JWT relogin: those require the real UI separately.
    await first.$disconnect();
    await reloaded.$connect();
    const recoveredService = new PhoneticAttemptService(reloaded, engine);
    const restored = (await recoveredService.list(userId, profileId)).find((item) => item.id === attempt.id);
    assert.ok(restored);
    assert.equal(restored.exerciseId, `${lessonId}:v${lesson.contentVersion}:${exerciseIndex}`);
    assert.equal(restored.masteryStatus, 'MASTERY_NOT_VERIFIED');
    assert.equal(restored.result?.engineVersion, attempt.result?.engineVersion);
    const summary = await loadPhoneticPassportSummary(reloaded, userId, profileId);
    assert.equal(summary.latestAttemptId, attempt.id);
    assert.equal(summary.latestRelevantAttemptId, attempt.id);
    assert.equal(summary.latestAttempt.exerciseId, restored.exerciseId);
    assert.equal(summary.bestMasteryScore, null);
    assert.equal(summary.masteryEligible, false);
    const row = await reloaded.experienceSession.findUnique({ where: { id: attempt.id }, select: { currentStep: true } });
    const stored = JSON.stringify(row.currentStep);
    assert.ok(!stored.includes(audio.toString('base64')));
    assert.ok(!/audioBase64|observedWords|observedWord|transcript|password|token/i.test(stored));
    assert.equal(await reloaded.learningCompletion.count({ where: { userId } }), beforeCompletions);
    await assert.rejects(recoveredService.list('phase-h-other-owner-not-a-user', profileId), (error) => error.getStatus() === 404);
    // Keep this real technical observation as an acceptance proof. Removal must
    // use the existing authenticated profile/learning-data deletion workflow.
    console.log(JSON.stringify({ postgresPersistence: 'PASS', independentConnectionRead: 'PASS',
      passportProjection: 'PASS', audioRetained: false, masteryEligible: false,
      migrations: 0, paidCalls: 0 }));
  } finally {
    await first.$disconnect();
    await reloaded.$disconnect();
  }
});
