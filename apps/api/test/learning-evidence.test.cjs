'use strict';

require('reflect-metadata');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { EvidenceProgressService } = require('../dist/learning-evidence/evidence-progress.service.js');
const { LearningCompletionService } = require('../dist/learning-evidence/learning-completion.service.js');

const root = path.resolve(__dirname, '../../..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const AT = new Date('2026-10-08T10:00:00.000Z');

test('evidence progression averages explicit observations and leaves every absent dimension null', async () => {
  const prisma = {
    learningCompletion: {
      findMany: async ({ where }) => {
        assert.equal(where.userId, 'owner-1');
        assert.equal(where.status, 'verified');
        return [
          { id: 'c1', finalizedAt: AT, dimensionScores: { knowledge: { score: 0.5 } } },
          { id: 'c2', finalizedAt: new Date(AT.getTime() + 1000), dimensionScores: { knowledge: { score: 1 }, reasoning: { score: 0.25 } } },
          { id: 'c3', finalizedAt: new Date(AT.getTime() + 2000), dimensionScores: { knowledge: { score: null }, application: { score: 4 } } },
        ];
      },
    },
  };
  const view = await new EvidenceProgressService(prisma).progress('owner-1');
  assert.equal(view.completedCount, 3);
  assert.equal(view.dimensions.find((item) => item.dimension === 'knowledge').percent, 75);
  assert.equal(view.dimensions.find((item) => item.dimension === 'knowledge').evaluatedEvidenceCount, 2);
  assert.equal(view.dimensions.find((item) => item.dimension === 'reasoning').percent, 25);
  assert.equal(view.dimensions.find((item) => item.dimension === 'application').percent, null);
  assert.equal(view.dimensions.find((item) => item.dimension === 'critical_reflection').percent, null);
});

test('lesson finalization verifies owner/evidence, is versioned, and publishes revision only after proof', async () => {
  const calls = [];
  const completion = {
    id: 'completion-1',
    userId: 'owner-1',
    kind: 'lesson',
    learningRefId: 'lesson-1',
    contentVersion: 3,
    status: 'verified',
    criteria: [{ id: 'exercise:0', label: 'Question', met: true, score: 0.8 }],
    result: { outcome: 'demonstrated', score: 0.8, passed: true, feedback: 'Good' },
    provenance: { schemaVersion: 1, contentVersion: 3, evidenceSource: 'exercise_attempt', evidenceRefIds: ['attempt-1'], experienceSessionId: null, evaluatedAt: AT.toISOString() },
    dimensionScores: {
      knowledge: { dimension: 'knowledge', score: null, criterionIds: [], evidenceRefIds: [] },
      understanding: { dimension: 'understanding', score: null, criterionIds: [], evidenceRefIds: [] },
      application: { dimension: 'application', score: null, criterionIds: [], evidenceRefIds: [] },
      reasoning: { dimension: 'reasoning', score: null, criterionIds: [], evidenceRefIds: [] },
      critical_reflection: { dimension: 'critical_reflection', score: null, criterionIds: [], evidenceRefIds: [] },
      perspective: { dimension: 'perspective', score: null, criterionIds: [], evidenceRefIds: [] },
    },
    startedAt: null,
    finalizedAt: AT,
    goals: [],
    lesson: { topic: 'Networks' },
    languageProfile: null,
  };
  const prisma = {
    lesson: { findFirst: async ({ where }) => {
      assert.deepEqual(where, { id: 'lesson-1', userId: 'owner-1' });
      return { id: 'lesson-1', topic: 'Networks', contentVersion: 3, sourceDocumentId: null, conceptId: null };
    } },
    exerciseAttempt: { findFirst: async ({ where }) => {
      assert.equal(where.userId, 'owner-1');
      assert.equal(where.lessonId, 'lesson-1');
      assert.equal(where.contentVersion, 3);
      return { id: 'attempt-1', contentVersion: 3, exerciseIndex: 0, question: 'Question', correct: true, score: 0.8, feedback: 'Good', correction: '', createdAt: AT };
    } },
    learningCompletion: {
      upsert: async (args) => { calls.push(['completion', args.create]); return completion; },
      findUniqueOrThrow: async () => completion,
    },
    reviewable: { upsert: async (args) => { calls.push(['reviewable', args]); return { id: 'reviewable-1' }; } },
    learningCompletionReviewable: { upsert: async (args) => { calls.push(['link', args]); return {}; } },
    $transaction: async (callback) => callback(prisma),
  };
  const cards = { generateFromDocument: async () => assert.fail('no document means no card generation') };
  const result = await new LearningCompletionService(prisma, cards).finalizeLesson('owner-1', {
    lessonId: 'lesson-1', evidence: { kind: 'exercise_attempt', id: 'attempt-1' },
  });
  assert.equal(result.id, 'completion-1');
  assert.equal(calls[0][0], 'completion');
  assert.equal(calls[0][1].contentVersion, 3);
  assert.equal(Object.hasOwn(calls[0][1], 'finalizedAt'), false);
  assert.equal(calls[0][1].provenance.evaluatedAt, AT.toISOString());
  assert.equal(calls[1][0], 'reviewable');
  assert.equal(calls[2][0], 'link');
  assert.equal(result.dimensions.knowledge.score, null);
});

const LANGUAGE_FORMATS = [
  'recognition-mcq',
  'contextual-discrimination',
  'fill-blank-no-hint',
  'sentence-reconstruction',
  'register-matching',
  'error-correction',
  'listening-discrimination',
  'guided-writing',
  'voice-pronunciation',
  'mini-dialogue',
];

function languageMasteryFixture(options = {}) {
  const profileId = options.profileId ?? 'profile-de';
  const language = options.language ?? 'German';
  const sessionId = `session-${profileId}`;
  const lessonId = `lesson-${profileId}`;
  const assessmentId = `assessment-${profileId}`;
  const submissionId = `submission-${profileId}`;
  const attemptId = `attempt-${profileId}`;
  const lessonContentVersion = options.lessonContentVersion ?? 3;
  const awarded = options.awarded ?? 900;
  const maximum = 1000;
  const rawScore = awarded / maximum;
  const lessonExercises = LANGUAGE_FORMATS.map((languageFormat, index) => ({
    question: `Training ${index + 1}`,
    answer: `Answer ${index + 1}`,
    type: 'open',
    languageFormat,
  }));
  const trainingEvidence = LANGUAGE_FORMATS
    .filter((format) => format !== options.omitTrainingFormat)
    .map((format) => {
      const exerciseIndex = LANGUAGE_FORMATS.indexOf(format);
      const voice = format === 'voice-pronunciation';
      return {
        id: `training-${exerciseIndex}`,
        format,
        state: 'completed',
        helpUsed: false,
        lessonId: options.trainingLessonId ?? lessonId,
        contentVersion: options.trainingContentVersion ?? lessonContentVersion,
        exerciseIndex,
        source: voice ? 'audio-native-coaching' : 'exercise-attempt',
        sourceId: voice
          ? `lesson:${lessonId}:voice:${exerciseIndex}`
          : `training-attempt-${exerciseIndex}`,
      };
    });
  let persisted;
  let created;
  const metadata = {
    policyVersion: options.policyVersion ?? 'language-mastery-v1',
    profileId,
    courseSessionId: sessionId,
    unitId: 'a1-first-contact',
    lessonId,
    attemptId,
    helpUsed: options.helpUsed ?? false,
    answerLeak: options.answerLeak ?? false,
    sealedAt: options.sealedAt === false ? null : AT.toISOString(),
    createdAt: AT.toISOString(),
  };
  const questions = [{
    id: 'question-1', prompt: 'Présente-toi librement.', format: 'open', points: maximum,
    answerKey: 'A contextual introduction.', rubric: 'Identity and interaction.',
  }];
  const results = options.results ?? [{
    questionId: 'question-1', prompt: questions[0].prompt, learnerAnswer: 'Réponse autonome.',
    awarded, max: maximum, verdict: awarded === maximum ? 'correct' : 'partial',
    why: 'Observed.', how: 'Continue.', errorMade: null, howToAvoid: null,
  }];
  const milestoneMastery = options.includeMastery === false ? {} : {
    'a1-first-contact': {
      unitId: 'a1-first-contact',
      status: 'mastered',
      trainingEvidence,
      attempts: [{
        id: attemptId,
        assessmentId,
        status: 'evaluated',
        helpUsed: false,
        answerLeak: false,
        decision: {
          policyVersion: 'language-mastery-v1',
          verdict: 'mastered',
          reason: 'threshold-met',
          trainingComplete: true,
          missingTrainingFormats: [],
          rawScore,
          threshold: 0.9,
          helpUsed: false,
        },
        startedAt: AT.toISOString(),
        completedAt: AT.toISOString(),
      }],
      activeAttemptId: null,
      remediation: null,
      masteredAt: AT.toISOString(),
    },
  };
  const assessment = {
    id: assessmentId,
    userId: 'owner-1',
    type: options.assessmentType ?? 'open',
    title: 'Autonomie A1',
    lessonId: options.assessmentLessonId ?? lessonId,
    contentVersion: options.assessmentContentVersion ?? lessonContentVersion,
    questions: { version: 2, teacherPolicy: {}, questions, languageMastery: metadata },
  };
  const submission = {
    id: submissionId,
    assessmentId,
    userId: 'owner-1',
    answers: options.answers ?? ['Réponse autonome.'],
    score: options.displayScore ?? Math.round(rawScore * 100),
    results,
    summary: 'Évaluation terminée.',
    advice: 'Consolide les points faibles.',
    createdAt: AT,
    assessment,
  };
  const prisma = {
    languageProfile: { findFirst: async () => ({ id: profileId, language }) },
    experienceSession: {
      findFirst: async () => ({
        id: sessionId, userId: 'owner-1', languageProfileId: profileId, lessonId: null,
        startedAt: AT,
        currentStep: { metadata: { rlleCourse: {
          completedUnitIds: [],
          currentLesson: { unitId: 'a1-first-contact', lessonId },
          milestoneMastery,
        } } },
      }),
      findUnique: async () => ({ goalId: null }),
    },
    lesson: { findFirst: async () => ({
      id: lessonId,
      contentVersion: lessonContentVersion,
      exercises: lessonExercises,
    }) },
    exerciseAttempt: {
      findMany: async ({ where }) => trainingEvidence
        .filter((item) => item.source === 'exercise-attempt')
        .filter((item) => where.id.in.includes(item.sourceId))
        .filter((item) => item.lessonId === where.lessonId && item.contentVersion === where.contentVersion)
        .map((item) => ({ id: item.sourceId, exerciseIndex: item.exerciseIndex })),
    },
    assessmentSubmission: {
      findFirst: async () => options.submissionOwned === false ? null : submission,
    },
    learningGoalLink: { findMany: async () => [] },
    learningCompletion: {
      upsert: async (args) => {
        created = args.create;
        persisted = {
          id: `completion-${profileId}`, ...args.create, status: 'verified',
          startedAt: AT, finalizedAt: new Date(AT.getTime() + 1000), goals: [],
          lesson: null, languageProfile: { language },
        };
        return persisted;
      },
      findUniqueOrThrow: async () => persisted,
    },
    reviewable: { upsert: async () => ({ id: `reviewable-${profileId}` }) },
    learningCompletionReviewable: { upsert: async () => ({}) },
    $transaction: async (callback) => callback(prisma),
  };
  return {
    service: new LearningCompletionService(prisma, {}),
    input: {
      languageProfileId: profileId,
      unitId: 'a1-first-contact',
      experienceSessionId: sessionId,
      lessonId,
      lessonContentVersion: options.inputLessonContentVersion ?? lessonContentVersion,
      assessmentSubmissionId: submissionId,
      policyVersion: 'language-mastery-v1',
      mastery: milestoneMastery['a1-first-contact'],
    },
    created: () => created,
  };
}

test('language mastery completion is profile-scoped, v2 and backed by the owned assessment submission', async () => {
  const germanFixture = languageMasteryFixture();
  const japaneseFixture = languageMasteryFixture({ profileId: 'profile-ja', language: 'Japanese' });
  const german = await germanFixture.service.finalizeLanguageUnit('owner-1', germanFixture.input);
  const japanese = await japaneseFixture.service.finalizeLanguageUnit('owner-1', japaneseFixture.input);
  assert.notEqual(german.learningRefId, japanese.learningRefId);
  assert.match(german.learningRefId, /profile-de/);
  assert.match(japanese.learningRefId, /profile-ja/);
  assert.match(german.title, /German/);
  assert.match(japanese.title, /Japanese/);
  assert.equal(german.contentVersion, 2);
  assert.equal(german.result.score, 0.9);
  assert.equal(german.result.passed, true);
  assert.equal(german.provenance.evidenceSource, 'assessment_submission');
  assert.equal(germanFixture.created().assessmentSubmissionId, 'submission-profile-de');
  assert.equal(germanFixture.created().evidenceSource, 'assessment_submission');
});

test('the feature-off language finalizer preserves the legacy capability-evidence contract', async () => {
  const evidenceId = 'legacy-evidence-1';
  let created;
  let persisted;
  const prisma = {
    languageProfile: {
      findFirst: async () => ({ id: 'profile-legacy', language: 'German' }),
    },
    experienceSession: {
      findFirst: async () => ({
        id: 'session-legacy',
        userId: 'owner-1',
        languageProfileId: 'profile-legacy',
        lessonId: null,
        startedAt: AT,
        currentStep: {
          metadata: {
            rlleCourse: {
              completedUnitIds: ['a1-first-contact'],
              evidence: [{
                id: evidenceId,
                canDoId: 'social-introduce',
                source: 'controlled-activity',
                sourceId: 'attempt-legacy',
                result: 'demonstrated',
                observedAt: AT.toISOString(),
                observation: 'Observed and evaluated.',
              }],
            },
          },
        },
      }),
      findUnique: async () => ({ goalId: null }),
    },
    learningGoalLink: { findMany: async () => [] },
    learningCompletion: {
      upsert: async (args) => {
        created = args.create;
        persisted = {
          id: 'completion-legacy',
          ...args.create,
          status: 'verified',
          startedAt: AT,
          finalizedAt: new Date(AT.getTime() + 1_000),
          goals: [],
          lesson: null,
          languageProfile: { language: 'German' },
        };
        return persisted;
      },
      findUniqueOrThrow: async () => persisted,
    },
    reviewable: { upsert: async () => ({ id: 'reviewable-legacy' }) },
    learningCompletionReviewable: { upsert: async () => ({}) },
    $transaction: async (callback) => callback(prisma),
  };
  const result = await new LearningCompletionService(prisma, {})
    .finalizeLanguageUnit('owner-1', {
      languageProfileId: 'profile-legacy',
      unitId: 'a1-first-contact',
      experienceSessionId: 'session-legacy',
      evidenceIds: [evidenceId],
    });
  assert.equal(result.contentVersion, 1);
  assert.equal(result.provenance.evidenceSource, 'language_capability');
  assert.equal(created.evidenceSource, 'language_capability');
  assert.equal(created.assessmentSubmissionId, undefined);
});

test('language mastery recomputes raw rubric points and rejects 89.9 even when display score is 90', async () => {
  const fixture = languageMasteryFixture({ awarded: 899, displayScore: 90 });
  await assert.rejects(
    fixture.service.finalizeLanguageUnit('owner-1', fixture.input),
    /mastery threshold was not met/,
  );
});

test('language mastery rejects assisted, incomplete, stale and unowned evidence', async (t) => {
  await t.test('help used', async () => {
    const fixture = languageMasteryFixture({ helpUsed: true });
    await assert.rejects(
      fixture.service.finalizeLanguageUnit('owner-1', fixture.input),
      /Assisted autonomy evidence/,
    );
  });
  await t.test('answer exposed', async () => {
    const fixture = languageMasteryFixture({ answerLeak: true });
    await assert.rejects(
      fixture.service.finalizeLanguageUnit('owner-1', fixture.input),
      /Assisted autonomy evidence/,
    );
  });
  await t.test('submission not sealed', async () => {
    const fixture = languageMasteryFixture({ sealedAt: false });
    await assert.rejects(
      fixture.service.finalizeLanguageUnit('owner-1', fixture.input),
      /assessment metadata is incomplete/,
    );
  });
  await t.test('wrong policy metadata', async () => {
    const fixture = languageMasteryFixture({ policyVersion: 'language-mastery-v0' });
    await assert.rejects(
      fixture.service.finalizeLanguageUnit('owner-1', fixture.input),
      /assessment provenance is invalid/,
    );
  });
  await t.test('training incomplete', async () => {
    const fixture = languageMasteryFixture({ omitTrainingFormat: 'voice-pronunciation' });
    await assert.rejects(
      fixture.service.finalizeLanguageUnit('owner-1', fixture.input),
      /Required language training is incomplete/,
    );
  });
  await t.test('training from a stale lesson content version', async () => {
    const fixture = languageMasteryFixture({ trainingContentVersion: 2 });
    await assert.rejects(
      fixture.service.finalizeLanguageUnit('owner-1', fixture.input),
      /training provenance is incomplete or invalid/,
    );
  });
  await t.test('training from another lesson', async () => {
    const fixture = languageMasteryFixture({ trainingLessonId: 'lesson-other' });
    await assert.rejects(
      fixture.service.finalizeLanguageUnit('owner-1', fixture.input),
      /training provenance is incomplete or invalid/,
    );
  });
  await t.test('incomplete rubric', async () => {
    const fixture = languageMasteryFixture({
      results: [{ questionId: 'question-1', awarded: 900, max: 999 }],
    });
    await assert.rejects(
      fixture.service.finalizeLanguageUnit('owner-1', fixture.input),
      /grading rubric is incomplete/,
    );
  });
  await t.test('stale lesson assessment', async () => {
    const fixture = languageMasteryFixture({ assessmentContentVersion: 2 });
    await assert.rejects(
      fixture.service.finalizeLanguageUnit('owner-1', fixture.input),
      /Versioned language assessment submission not found/,
    );
  });
  await t.test('stale requested lesson content version', async () => {
    const fixture = languageMasteryFixture({ inputLessonContentVersion: 2 });
    await assert.rejects(
      fixture.service.finalizeLanguageUnit('owner-1', fixture.input),
      /lesson content version is stale/,
    );
  });
  await t.test('submission not owned', async () => {
    const fixture = languageMasteryFixture({ submissionOwned: false });
    await assert.rejects(
      fixture.service.finalizeLanguageUnit('owner-1', fixture.input),
      /Versioned language assessment submission not found/,
    );
  });
  await t.test('legacy course state is not promoted', async () => {
    const fixture = languageMasteryFixture({ includeMastery: false });
    await assert.rejects(
      fixture.service.finalizeLanguageUnit('owner-1', fixture.input),
      /language milestone is not mastered/,
    );
  });
});

test('review/calendar queues are hard-filtered by verified canonical completion links', () => {
  for (const file of [
    'apps/api/src/revision/revision-engine.service.ts',
    'apps/api/src/flashcards/session.service.ts',
    'apps/api/src/flashcards/review.service.ts',
    'apps/api/src/flashcards/review-experience.service.ts',
    'apps/api/src/calendar/calendar.service.ts',
  ]) {
    const source = read(file);
    assert.match(source, /completionLinks/);
    assert.match(source, /status:\s*'verified'/);
  }
});

test('migration preserves compatible goal links without fabricating legacy completion evidence', () => {
  const migration = read('apps/api/prisma/migrations/20261008120000_learning_completion_evidence/migration.sql');
  assert.match(migration, /CREATE TABLE "learning_completions"/);
  assert.match(migration, /CREATE TABLE "learning_goal_links"/);
  assert.doesNotMatch(migration, /INSERT INTO "learning_completions"/i);
  assert.match(migration, /INSERT INTO "learning_goal_links"/i);
  assert.match(migration, /es\."type" IN \('learning', 'language'\)/);
  assert.match(migration, /learning_goal_links_one_primary_per_session/);
  assert.match(migration, /WHERE "isPrimary" = true/);
  assert.match(migration, /ALTER TABLE "exercise_attempts"[\s\S]*"contentVersion" INTEGER NOT NULL DEFAULT 1/);
  assert.match(migration, /assessments_lessonId_fkey"[\s\S]*ON DELETE CASCADE/);
  assert.match(
    read('apps/api/src/lessons/assessment.service.ts'),
    /contentVersion:\s*lesson\.contentVersion/,
  );
  const lessonService = read('apps/api/src/lessons/lesson.service.ts');
  assert.match(
    lessonService,
    /exerciseAttempt\.findFirst\([\s\S]*?contentVersion:\s*lesson\.contentVersion/,
  );
  assert.match(
    lessonService,
    /exerciseAttempt\.findMany\([\s\S]*?contentVersion:\s*lesson\.contentVersion/,
  );
});
