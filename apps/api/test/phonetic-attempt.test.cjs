'use strict';

require('reflect-metadata');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PhoneticAttemptService } = require('../dist/languages/phonetic-attempt.service.js');
const { ExperienceSessionService } = require('../dist/experience-sessions/experience-session.service.js');
const { LearningResetService } = require('../dist/privacy/learning-reset.service.js');
const { LanguageService } = require('../dist/languages/language.service.js');
const { readPhoneticAttempt, loadPhoneticPassportSummary,
  comparePhoneticAttempts } = require('../dist/languages/phonetic-attempt-projection.js');
const { PronunciationFeedbackBuilder } = require('@second-brain/shared');

const FILE = { buffer: Buffer.from('technical-audio-fixture-not-a-grade'), mimetype: 'audio/wav' };
const INPUT = { lessonId: 'lesson-1', exerciseIndex: 0, idempotencyKey: 'attempt-key-1' };
const EXPECTED = 'She works every day.';
function result(overrides = {}) {
  return {
    status: 'NOT_EVALUABLE', language: 'en', locale: null,
    engineVersion: 'sb-phonetic-v1-disabled', expectedText: EXPECTED,
    overallAcousticScore: null, accuracyScore: null, completenessScore: null,
    fluencyScore: null, prosodyScore: null, words: [], phonemes: [],
    errors: [{ code: 'LOCAL_ENGINE_NOT_CONFIGURED' }], evidence: {}, confidence: null,
    calibrationStatus: 'UNCALIBRATED', masteryEligible: false, capability: 'PRACTICE_ONLY',
    ...overrides,
  };
}
function fixture(options = {}) {
  let profilePresent = true;
  let lessonPresent = true;
  const rows = new Map();
  const calls = [];
  const matches = (row, where) => Object.entries(where).every(([key, value]) => {
    if (value && typeof value === 'object' && 'startsWith' in value) return row[key]?.startsWith(value.startsWith);
    return row[key] === value;
  });
  const prisma = {
    $executeRaw: async () => 1,
    languageProfile: {
      findFirst: async ({ where }) => profilePresent && where.id === 'profile-1' && where.userId === 'user-1'
        ? { id: 'profile-1', language: 'English', normalizedLanguage: 'en', cefrLevel: 'A1',
          nativeLanguage: 'Lingala', teachingLanguageSource: options.teachingLanguageSource ?? 'interface' } : null,
    },
    onboardingProfile: { findUnique: async () => ({ extra: { interfaceLanguage: 'fr' } }) },
    profile: { findUnique: async () => ({ preferredLanguage: 'fr' }) },
    lesson: {
      findFirst: async ({ where }) => lessonPresent && where.id === 'lesson-1' && where.userId === 'user-1'
        && where.languageProfileId === 'profile-1' && (!where.contentVersion || where.contentVersion === 7)
        ? { id: 'lesson-1', contentVersion: 7, exercises: options.exercises ?? [{
          languageFormat: 'voice-pronunciation', audioText: EXPECTED,
        }] } : null,
    },
    experienceSession: {
      findUnique: async ({ where }) => [...rows.values()].find((row) => matches(row, where.userId_idempotencyKey)) ?? null,
      findFirst: async ({ where }) => [...rows.values()].find((row) => matches(row, where)) ?? null,
      findMany: async ({ where, take }) => [...rows.values()].filter((row) => matches(row, where))
        .sort((a, b) => b.startedAt - a.startedAt).slice(0, take ?? rows.size),
      count: async ({ where }) => [...rows.values()].filter((row) => matches(row, where)).length,
      create: async ({ data }) => {
        const row = { id: `attempt-${rows.size + 1}`, startedAt: new Date(1760000000000 + rows.size), ...data };
        rows.set(row.id, row); return row;
      },
      update: async ({ where, data }) => {
        const row = { ...rows.get(where.id), ...data };
        rows.set(row.id, row); return row;
      },
    },
  };
  prisma.$transaction = async (operation) => operation(prisma);
  const engine = { capabilities: async () => ({ enabled: true, available: true,
    capability: 'ACOUSTIC_UNCALIBRATED', diagnosticStatus: 'INSUFFICIENT_ACOUSTIC_CONFIDENCE' }), assess: async (input) => {
    calls.push(input); return options.assess ? options.assess(input) : result();
  } };
  return { prisma, rows, calls, service: new PhoneticAttemptService(prisma, engine),
    remove: () => { rows.clear(); profilePresent = false; lessonPresent = false; } };
}

test('owned server reference and audio reach only the local engine; scores remain null and no raw audio persists', async () => {
  const f = fixture();
  const observed = await f.service.assess('user-1', 'profile-1', INPUT, FILE);
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].expectedText, EXPECTED);
  assert.equal(f.calls[0].targetLanguage, 'en');
  assert.equal(f.calls[0].locale, 'en');
  assert.equal(f.calls[0].learnerLevel, 'A1');
  assert.equal(f.calls[0].exerciseId, 'lesson-1:v7:0');
  assert.equal(observed.result.overallAcousticScore, null);
  assert.equal(observed.masteryStatus, 'MASTERY_NOT_VERIFIED');
  assert.equal(observed.masteryEligible, false);
  assert.equal(observed.audioRetained, false);
  const stored = JSON.stringify([...f.rows.values()]);
  assert.ok(!stored.includes(FILE.buffer.toString('base64')));
  assert.ok(!stored.includes(FILE.buffer.toString()));
  assert.ok(!stored.includes('attempt-key-1'));
  assert.ok(!stored.includes('LearningCompletion'));
});

test('capability is authenticated to an owned lesson and only exposes authored pronunciation references', async () => {
  const f = fixture({ exercises: [
    { languageFormat: 'voice-pronunciation', audioText: EXPECTED },
    { type: 'mcq', audioText: 'This is not a pronunciation reference', correctAnswer: 'secret answer' },
  ] });
  const capability = await f.service.capability('user-1', 'profile-1', 'lesson-1');
  assert.equal(capability.available, true);
  assert.equal(capability.diagnosticStatus, 'INSUFFICIENT_ACOUSTIC_CONFIDENCE');
  assert.deepEqual(capability.references, [{ lessonId: 'lesson-1', exerciseIndex: 0, referenceText: EXPECTED }]);
  assert.deepEqual(capability.bounds, { minDurationMs: 150, maxDurationMs: 30000, maxUploadBytes: 4194304 });
  await assert.rejects(f.service.capability('another-user', 'profile-1', 'lesson-1'), (e) => e.getStatus() === 404);
  assert.equal(f.calls.length, 0);
});

test('a targeted word retry derives reference from owned tentative evidence and preserves the full phrase', async () => {
  const f = fixture({ assess: async (input) => result({ expectedText: input.expectedText,
    status: 'EVIDENCE_AVAILABLE', capability: 'ACOUSTIC_UNCALIBRATED',
    errors: [{ code: 'POSSIBLE_OMITTED_WORD', wordIndex: 1, tentative: true }] }) });
  const parent = await f.service.assess('user-1', 'profile-1', INPUT, FILE);
  assert.deepEqual(parent.retryTargets, [{ wordIndex: 1, word: 'works', certainty: 'TENTATIVE', reason: 'POSSIBLE_OMITTED_WORD' }]);
  const child = await f.service.assess('user-1', 'profile-1', {
    ...INPUT, idempotencyKey: 'targeted-key-2', parentAttemptId: parent.id, targetWordIndex: 1,
  }, FILE);
  assert.equal(f.calls[1].expectedText, 'works');
  assert.equal(f.calls[1].exerciseId, 'lesson-1:v7:0:word:1');
  assert.equal(child.parentAttemptId, parent.id);
  assert.equal(child.targetWordIndex, 1);
  assert.deepEqual(child.retryTargets, []);
  assert.equal([...f.rows.values()][0].currentStep.metadata.phoneticAssessment.expectedText, EXPECTED);
  assert.equal(f.rows.size, 2);
  assert.equal(child.masteryEligible, false);
  const before = f.calls.length;
  for (const retry of [
    { parentAttemptId: parent.id, targetWordIndex: 0 },
    { parentAttemptId: 'other-owner-attempt', targetWordIndex: 1 },
    { parentAttemptId: child.id, targetWordIndex: 0 },
    { targetWordIndex: 1 },
  ]) {
    await assert.rejects(f.service.assess('user-1', 'profile-1', {
      ...INPUT, idempotencyKey: 'rejected-targeted', ...retry,
    }, FILE), (error) => error.getStatus() === 400);
  }
  assert.equal(f.calls.length, before);
});

test('raw HMM scores and non-tentative or out-of-range errors cannot invent a weak-word retry', async () => {
  const f = fixture({ assess: async () => result({ status: 'EVIDENCE_AVAILABLE', capability: 'ACOUSTIC_UNCALIBRATED',
    words: [{ word: 'works', rawAcousticScore: -999999 }],
    errors: [{ code: 'POSSIBLE_OMITTED_WORD', wordIndex: 1 },
      { code: 'POSSIBLE_OMITTED_WORD', wordIndex: 99, tentative: true }] }) });
  const attempt = await f.service.assess('user-1', 'profile-1', INPUT, FILE);
  assert.deepEqual(attempt.retryTargets, []);
});

test('explicit interrupted-job recovery never re-runs inference and cannot interrupt a fresh live attempt', async () => {
  const f = fixture();
  const attempt = await f.service.assess('user-1', 'profile-1', INPUT, FILE);
  const row = f.rows.get(attempt.id);
  row.currentStep.metadata.phoneticAssessment.state = 'processing';
  row.currentStep.metadata.phoneticAssessment.result = null;
  row.startedAt = new Date();
  await assert.rejects(f.service.recoverInterrupted('user-1', 'profile-1', attempt.id),
    (error) => error.getStatus() === 409 && error.getResponse().code === 'PHONETIC_ATTEMPT_IN_PROGRESS');
  row.startedAt = new Date(Date.now() - 121000);
  const recovered = await f.service.recoverInterrupted('user-1', 'profile-1', attempt.id);
  assert.equal(recovered.state, 'technical_error');
  assert.equal(recovered.failureCode, 'PROCESSING_INTERRUPTED');
  assert.equal(recovered.result, null);
  const replay = await f.service.assess('user-1', 'profile-1', INPUT, FILE);
  assert.equal(replay.id, attempt.id);
  assert.equal(replay.state, 'technical_error');
  assert.equal(f.calls.length, 1);
  await assert.rejects(f.service.recoverInterrupted('another-user', 'profile-1', attempt.id), (e) => e.getStatus() === 404);
});

test('second-attempt comparison reports observations only, exact same model/reference, never mastery', () => {
  const base = { id: 'one', lessonId: 'lesson-1', exerciseId: 'lesson-1:v7:0', targetWordIndex: null,
    result: result({ status: 'EVIDENCE_AVAILABLE', locale: 'en-US', capability: 'ACOUSTIC_UNCALIBRATED',
      evidence: { model: { modelArtifactSha256: 'a'.repeat(64), lexiconSha256: 'b'.repeat(64) },
        completeness: { status: 'EVIDENCE_AVAILABLE', method: 'SECONDARY_ASR_WORD_ALIGNMENT', expectedCount: 4, observedCount: 4, matchedCount: 3 },
        fluency: { status: 'EVIDENCE_AVAILABLE', method: 'FORCED_ALIGNMENT_TIMINGS', totalPauseMs: 1000 } } }) };
  const second = JSON.parse(JSON.stringify(base)); second.id = 'two';
  second.result.evidence.completeness.matchedCount = 4;
  const improved = comparePhoneticAttempts(second, base);
  assert.equal(improved.status, 'COMPLETENESS_OBSERVATION_INCREASED');
  assert.equal(improved.masteryEligible, false);
  assert.equal(improved.microphoneComparable, false);
  second.result.evidence.model.modelArtifactSha256 = 'c'.repeat(64);
  assert.equal(comparePhoneticAttempts(second, base).status, 'NOT_COMPARABLE');
  second.result.evidence.model.modelArtifactSha256 = 'a'.repeat(64);
  second.result.expectedText = 'works';
  assert.equal(comparePhoneticAttempts(second, base).status, 'NOT_COMPARABLE');
});

test('invalid historical completeness counts cannot publish an increased or stable observation', () => {
  const previous = { id: 'one', lessonId: 'lesson-1', exerciseId: 'lesson-1:v7:0', targetWordIndex: null,
    result: result({ status: 'EVIDENCE_AVAILABLE', locale: 'en-US', capability: 'ACOUSTIC_UNCALIBRATED',
      evidence: { model: { modelArtifactSha256: 'a'.repeat(64), lexiconSha256: 'b'.repeat(64) },
        completeness: { status: 'EVIDENCE_AVAILABLE', method: 'SECONDARY_ASR_WORD_ALIGNMENT',
          expectedCount: 4, observedCount: 4, matchedCount: 3 } } }) };
  for (const patch of [{ matchedCount: 999 }, { matchedCount: -1 }, { matchedCount: 3.5 },
    { expectedCount: 3 }, { observedCount: -1 }, { observedCount: 2 }, { observedCount: 385 }]) {
    const current = JSON.parse(JSON.stringify(previous)); current.id = 'two';
    Object.assign(current.result.evidence.completeness, patch);
    assert.equal(comparePhoneticAttempts(current, previous).status, 'NOT_COMPARABLE');
    assert.equal(comparePhoneticAttempts(previous, current).status, 'NOT_COMPARABLE');
  }
});

test('the same owner/key/input replays the same attempt without inference; a different recording is rejected', async () => {
  const f = fixture();
  const a = await f.service.assess('user-1', 'profile-1', INPUT, FILE);
  const b = await f.service.assess('user-1', 'profile-1', INPUT, FILE);
  assert.equal(a.id, b.id); assert.equal(f.calls.length, 1);
  await assert.rejects(f.service.assess('user-1', 'profile-1', INPUT, { ...FILE, buffer: Buffer.from('different') }),
    (error) => error.getStatus() === 409);
  assert.equal(f.calls.length, 1);
});

test('independent attempts are preserved separately and Passport never computes a mastery score or fake weakness', async () => {
  const f = fixture();
  await f.service.assess('user-1', 'profile-1', INPUT, FILE);
  await f.service.assess('user-1', 'profile-1', { ...INPUT, idempotencyKey: 'attempt-key-2' }, FILE);
  const attempts = await f.service.list('user-1', 'profile-1');
  assert.equal(attempts.length, 2); assert.notEqual(attempts[0].id, attempts[1].id);
  const summary = await loadPhoneticPassportSummary(f.prisma, 'user-1', 'profile-1');
  assert.equal(summary.attemptCount, 2);
  assert.equal(summary.latestAttemptId, attempts[0].id);
  assert.equal(summary.bestMasteryScore, null);
  assert.equal(summary.masteryEligible, false);
  assert.deepEqual(summary.weakPhonemes, []);
});

test('cross-user profile, lesson and list requests are rejected before any inference', async () => {
  const f = fixture();
  await assert.rejects(f.service.assess('another-user', 'profile-1', INPUT, FILE), (error) => error.getStatus() === 404);
  await assert.rejects(f.service.assess('user-1', 'another-profile', INPUT, FILE), (error) => error.getStatus() === 404);
  await assert.rejects(f.service.assess('user-1', 'profile-1', { ...INPUT, lessonId: 'another-lesson' }, FILE),
    (error) => error.getStatus() === 404);
  await assert.rejects(f.service.list('another-user', 'profile-1'), (error) => error.getStatus() === 404);
  assert.equal(f.calls.length, 0);
});

test('missing authored audio reference, non-pronunciation exercise, wrong locale and invalid audio fail closed', async () => {
  for (const exercises of [[{ languageFormat: 'voice-pronunciation' }], [{ type: 'mcq', audioText: EXPECTED }]]) {
    const f = fixture({ exercises });
    await assert.rejects(f.service.assess('user-1', 'profile-1', INPUT, FILE), (error) => error.getStatus() === 400);
    assert.equal(f.calls.length, 0);
  }
  const f = fixture();
  await assert.rejects(f.service.assess('user-1', 'profile-1', { ...INPUT, locale: 'fr-FR' }, FILE),
    (error) => error.getStatus() === 400);
  await assert.rejects(f.service.assess('user-1', 'profile-1', INPUT, { ...FILE, buffer: Buffer.alloc(0) }),
    (error) => error.getStatus() === 400);
  assert.equal(f.calls.length, 0);
});

test('an in-progress repeated request does not start another inference', async () => {
  let begin; let release;
  const started = new Promise((resolve) => { begin = resolve; });
  const pending = new Promise((resolve) => { release = resolve; });
  const f = fixture({ assess: async () => { begin(); return pending; } });
  const first = f.service.assess('user-1', 'profile-1', INPUT, FILE);
  await started;
  assert.equal([...f.rows.values()][0].status, 'active');
  await assert.rejects(f.service.assess('user-1', 'profile-1', INPUT, FILE),
    (error) => error.getStatus() === 409 && error.getResponse().code === 'PHONETIC_ATTEMPT_IN_PROGRESS');
  release(result()); await first; assert.equal(f.calls.length, 1);
  assert.equal([...f.rows.values()][0].status, 'completed');
});

test('a deletion/reset during inference wins and cannot resurrect acoustic evidence', async () => {
  let begin; let release;
  const started = new Promise((resolve) => { begin = resolve; });
  const pending = new Promise((resolve) => { release = resolve; });
  const f = fixture({ assess: async () => { begin(); return pending; } });
  const first = f.service.assess('user-1', 'profile-1', INPUT, FILE);
  await started; f.remove(); release(result());
  await assert.rejects(first, (error) => error.getStatus() === 404);
  assert.equal(f.rows.size, 0);
});

test('hostile mastery/calibration or numeric-score output is retained only as technical error, never mastery', async () => {
  for (const overrides of [{ masteryEligible: true }, { calibrationStatus: 'CALIBRATED' }, { accuracyScore: 100 }]) {
    const f = fixture({ assess: async () => result(overrides) });
    const attempt = await f.service.assess('user-1', 'profile-1', INPUT, FILE);
    assert.equal(attempt.state, 'technical_error'); assert.equal(attempt.result, null);
    assert.equal([...f.rows.values()][0].status, 'failed');
    assert.equal(attempt.masteryEligible, false);
    const replay = await f.service.assess('user-1', 'profile-1', INPUT, FILE);
    assert.equal(replay.id, attempt.id); assert.equal(f.calls.length, 1);
  }
});

test('generic session endpoints cannot forge or edit phonetic evidence and projections reject other-owner metadata', async () => {
  const generic = new ExperienceSessionService({});
  assert.throws(() => generic.createFromClient('user-1', {
    type: 'learning', intent: 'language-phonetic-attempt',
  }), (error) => error.getStatus() === 400);
  generic.requireOwned = async () => ({ intent: 'language-phonetic-attempt' });
  await assert.rejects(generic.updateFromClient('user-1', 'attempt-1', { currentStep: { metadata: {} } }),
    (error) => error.getStatus() === 400);
  const f = fixture(); await f.service.assess('user-1', 'profile-1', INPUT, FILE);
  const row = [...f.rows.values()][0];
  assert.equal(readPhoneticAttempt(row, 'another-user', 'profile-1'), null);
  assert.equal(readPhoneticAttempt({ ...row, idempotencyKey: 'client-forged' }, 'user-1', 'profile-1'), null);
});

test('existing profile/lesson deletion and strong reset cover the actual JSON carrier without new schema', () => {
  const source = (file) => fs.readFileSync(path.join(__dirname, '..', 'src', file), 'utf8');
  assert.match(source('languages/language.service.ts'), /experienceSession\.findMany\(\{\s*where: \{ userId, languageProfileId: id \}/);
  assert.match(source('languages/language.service.ts'), /learningDeletions\.deleteSession\(userId, session\.id\)/);
  assert.match(source('experience-sessions/learning-data-deletion.service.ts'), /sessionWhere\.push\(\{ lessonId: \{ in: existingLessonIds \} \}\)/);
  assert.match(source('privacy/learning-reset.service.ts'), /experienceSession\.deleteMany\(\{ where: \{ userId \} \}\)/);
});

test('canonical reset purge removes persisted acoustic JSON for the owner only, with no detached mastery evidence', async () => {
  const f = fixture();
  await f.service.assess('user-1', 'profile-1', INPUT, FILE);
  const original = [...f.rows.values()][0];
  f.rows.set('other-owner-attempt', { ...original, id: 'other-owner-attempt', userId: 'user-2' });
  const tx = new Proxy({}, { get: (_target, model) => ({
    deleteMany: async ({ where }) => {
      assert.equal(where.userId ?? where.concept?.userId, 'user-1');
      if (model !== 'experienceSession') return { count: 0 };
      let count = 0;
      for (const [id, row] of f.rows) if (row.userId === where.userId) { f.rows.delete(id); count += 1; }
      return { count };
    },
  }) });
  // Exercise the existing internal purge, not a new reset endpoint. Existing
  // reset tests independently verify password/MFA/confirmation requirements.
  const reset = new LearningResetService({}, {}, {}, {}, {});
  await reset.purgePedagogicalData(tx, 'user-1');
  assert.equal(await loadPhoneticPassportSummary(f.prisma, 'user-1', 'profile-1'), null);
  assert.equal(f.rows.size, 1);
  assert.equal(f.rows.get('other-owner-attempt').userId, 'user-2');
});

test('Passport counts only validated recent observations and marks the history window explicitly', async () => {
  const f = fixture();
  await f.service.assess('user-1', 'profile-1', INPUT, FILE);
  const row = [...f.rows.values()][0];
  const corrupted = JSON.parse(JSON.stringify(row));
  corrupted.startedAt = row.startedAt;
  corrupted.id = 'invalid-server-history';
  corrupted.currentStep.metadata.phoneticAssessment.result.accuracyScore = 100;
  f.rows.set(corrupted.id, corrupted);
  const summary = await loadPhoneticPassportSummary(f.prisma, 'user-1', 'profile-1');
  assert.equal(summary.attemptCount, 1);
  assert.equal(summary.historyWindowLimit, 30);
  assert.equal(summary.historyTruncated, false);
});

test('pending phonetic claims do not pollute the existing resumable lesson list', async () => {
  const service = new ExperienceSessionService({});
  service.list = async () => ({ items: [
    { id: 'pending-acoustic', intent: 'language-phonetic-attempt', type: 'language', links: {} },
    { id: 'actual-course', intent: 'language-learning-core', type: 'language', links: {} },
  ], nextCursor: null });
  const activities = await service.resumable('user-1', 10);
  assert.deepEqual(activities.items.map((item) => item.id), ['actual-course']);
});

test('existing language-profile removal delegates the new acoustic carrier to the canonical session purge', async () => {
  const f = fixture();
  await f.service.assess('user-1', 'profile-1', INPUT, FILE);
  const row = [...f.rows.values()][0];
  f.rows.set('other-owner-attempt', { ...row, id: 'other-owner-attempt', userId: 'user-2' });
  f.prisma.languageProfile.findUnique = async () => ({ id: 'profile-1', userId: 'user-1' });
  f.prisma.languageProfile.delete = async () => ({ id: 'profile-1' });
  f.prisma.lesson.findMany = async () => [{ id: 'lesson-1' }];
  f.prisma.lesson.count = async () => 0;
  f.prisma.tutorSession = { findMany: async () => [], count: async () => 0 };
  for (const model of ['learningCompletion', 'assessment', 'reviewable', 'dailyPlanItem']) {
    f.prisma[model] = { deleteMany: async () => ({ count: 0 }) };
  }
  const purged = [];
  const language = new LanguageService(f.prisma, {
    deleteLesson: async () => {}, deleteTutorSession: async () => {},
    deleteSession: async (userId, id) => {
      assert.equal(userId, 'user-1'); assert.equal(f.rows.get(id).userId, userId);
      purged.push(id); f.rows.delete(id);
    },
  }, { purgeOwned: async () => ({ attempts: 0, completions: 0 }) });
  await language.remove('user-1', 'profile-1');
  assert.deepEqual(purged, [row.id]);
  assert.equal(f.rows.size, 1);
  assert.equal(f.rows.get('other-owner-attempt').userId, 'user-2');
});

test('French interface support is snapshotted independently from English target and readable feedback survives replay', async () => {
  const f = fixture();
  const first = await f.service.assess('user-1', 'profile-1', INPUT, FILE);
  assert.equal(first.language, 'en');
  assert.equal(first.supportLanguageCode, 'fr');
  assert.equal(first.result.supportLanguageCode, 'fr');
  assert.ok(first.result.feedback.every((item) => typeof item.message === 'string' && item.message.length > 10));
  const english = new PronunciationFeedbackBuilder().build(result(), { supportLanguageCode: 'en', targetLanguage: 'en' });
  assert.notEqual(first.result.feedback[0].message, english[0].message);
  const replay = await f.service.assess('user-1', 'profile-1', INPUT, FILE);
  assert.deepEqual(replay.result.feedback, first.result.feedback);
  assert.equal(f.calls.length, 1);
  assert.equal([...f.rows.values()][0].currentStep.metadata.phoneticAssessment.supportLanguageCode, 'fr');
});

test('persisted native Lingala support overrides French UI while the English remediation word remains unchanged', async () => {
  const observation = result({ status: 'EVIDENCE_AVAILABLE', locale: 'en-US',
    capability: 'ACOUSTIC_UNCALIBRATED', errors: [{ code: 'POSSIBLE_OMITTED_WORD', wordIndex: 1, tentative: true }] });
  const f = fixture({ teachingLanguageSource: 'native', assess: async () => observation });
  const attempt = await f.service.assess('user-1', 'profile-1', INPUT, FILE);
  assert.equal(attempt.language, 'en');
  assert.equal(attempt.supportLanguageCode, 'ln');
  assert.equal(attempt.result.supportLanguageCode, 'ln');
  const feedback = attempt.result.feedback.find((item) => item.kind === 'CHECK_MISSING_WORD');
  assert.equal(feedback.word, 'works');
  assert.ok(feedback.message.includes('works'));
  const french = new PronunciationFeedbackBuilder().build(observation, { supportLanguageCode: 'fr', targetLanguage: 'en' });
  assert.notEqual(attempt.result.feedback[0].message, french[0].message);
  assert.equal(attempt.masteryEligible, false);
  assert.equal(attempt.result.overallAcousticScore, null);
});
