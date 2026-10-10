'use strict';

require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');
const { Prisma } = require('@prisma/client');
const shared = require('../../../packages/shared/dist/index.js');
const {
  LanguageMasteryAttemptService,
} = require('../dist/languages/language-mastery-attempt.service.js');

function uniqueConflict() {
  return new Prisma.PrismaClientKnownRequestError('simulated concurrent unique winner', {
    code: 'P2002',
    clientVersion: Prisma.prismaVersion.client,
  });
}

function memoryPrisma() {
  const rows = {
    profiles: [
      { id: 'profile-owner', userId: 'owner', normalizedLanguage: 'English' },
      { id: 'profile-owner-fr', userId: 'owner', normalizedLanguage: 'French' },
      { id: 'profile-other', userId: 'other', normalizedLanguage: 'English' },
    ],
    sessions: [
      { id: 'session-owner', userId: 'owner', languageProfileId: 'profile-owner' },
    ],
    lessons: [
      {
        id: 'lesson-owner',
        userId: 'owner',
        languageProfileId: 'profile-owner',
        contentVersion: 3,
        exercises: Array.from({ length: 24 }, (_, index) => ({
          languageFormat: shared.LANGUAGE_TRAINING_FORMATS[index % shared.LANGUAGE_TRAINING_FORMATS.length],
        })),
      },
      {
        id: 'lesson-owner-fr',
        userId: 'owner',
        languageProfileId: 'profile-owner-fr',
        contentVersion: 3,
        exercises: [{ languageFormat: shared.LANGUAGE_TRAINING_FORMATS[0] }],
      },
    ],
    assessments: [],
    submissions: [],
    attempts: [],
    remediation: [],
    completions: [],
    exercises: [],
  };

  const matches = (row, where) => Object.entries(where ?? {}).every(([key, value]) => {
    if (key === 'languageMasteryAttemptId' && value?.in) return value.in.includes(row[key]);
    if (key === 'status' && value?.in) return value.in.includes(row[key]);
    return row[key] === value;
  });
  const decorate = (row) => ({
    ...row,
    completion: rows.completions.find((item) => item.languageMasteryAttemptId === row.id) ?? null,
    remediationEvidence: rows.remediation
      .filter((item) => item.languageMasteryAttemptId === row.id)
      .sort((a, b) => a.recordedAt - b.recordedAt),
  });
  let attemptSequence = 0;
  let remediationSequence = 0;

  const prisma = {
    rows,
    $transaction: async (callback) => callback(prisma),
    languageProfile: {
      findFirst: async ({ where }) => rows.profiles.find((row) => matches(row, where)) ?? null,
    },
    experienceSession: {
      findFirst: async ({ where }) => rows.sessions.find((row) => matches(row, where)) ?? null,
    },
    lesson: {
      findFirst: async ({ where }) => rows.lessons.find((row) => matches(row, where)) ?? null,
    },
    assessment: {
      findFirst: async ({ where }) => rows.assessments.find((row) => matches(row, where)) ?? null,
    },
    assessmentSubmission: {
      findFirst: async ({ where }) => {
        const row = rows.submissions.find((item) => matches(item, where));
        if (!row) return null;
        return { ...row, assessment: rows.assessments.find((item) => item.id === row.assessmentId) };
      },
    },
    exerciseAttempt: {
      findFirst: async ({ where }) => rows.exercises.find((row) => matches(row, where)) ?? null,
    },
    languageMasteryAttempt: {
      findUnique: async ({ where }) => {
        if (where.id) return rows.attempts.find((row) => row.id === where.id) ?? null;
        if (where.userId_attemptId) {
          return rows.attempts.find((row) =>
            row.userId === where.userId_attemptId.userId
            && row.attemptId === where.userId_attemptId.attemptId) ?? null;
        }
        return null;
      },
      findUniqueOrThrow: async ({ where }) => {
        const row = rows.attempts.find((item) => item.id === where.id);
        if (!row) throw new Error('not found');
        return decorate(row);
      },
      findFirst: async ({ where }) => rows.attempts.find((row) => matches(row, where)) ?? null,
      findMany: async ({ where, select }) => {
        const found = rows.attempts.filter((row) => matches(row, where));
        return select ? found.map((row) => ({ id: row.id })) : found.map(decorate);
      },
      create: async ({ data }) => {
        const row = {
          id: `attempt-row-${++attemptSequence}`,
          assessmentId: null,
          assessmentSubmissionId: null,
          verdict: null,
          rawScore: null,
          decisionReason: null,
          helpUsed: false,
          decision: null,
          criteria: null,
          decisionHash: null,
          startedAt: new Date('2026-10-10T08:00:00.000Z'),
          evaluatedAt: null,
          createdAt: new Date('2026-10-10T08:00:00.000Z'),
          ...data,
        };
        rows.attempts.push(row);
        return row;
      },
      update: async ({ where, data }) => {
        const row = rows.attempts.find((item) => item.id === where.id);
        Object.assign(row, data);
        return row;
      },
      updateMany: async ({ where, data }) => {
        const candidates = rows.attempts.filter((row) => matches(row, where));
        candidates.forEach((row) => Object.assign(row, data));
        return { count: candidates.length };
      },
      deleteMany: async ({ where }) => {
        const ids = new Set(rows.attempts.filter((row) => matches(row, where)).map((row) => row.id));
        rows.attempts = rows.attempts.filter((row) => !ids.has(row.id));
        rows.remediation = rows.remediation.filter((row) => !ids.has(row.languageMasteryAttemptId));
        return { count: ids.size };
      },
    },
    languageMasteryRemediationEvidence: {
      findFirst: async ({ where }) => rows.remediation.find((row) => matches(row, where)) ?? null,
      create: async ({ data }) => {
        const row = { id: `repair-${++remediationSequence}`, createdAt: new Date(), ...data };
        rows.remediation.push(row);
        return row;
      },
    },
    learningCompletion: {
      findFirst: async ({ where }) => rows.completions.find((row) => matches(row, where)) ?? null,
      update: async ({ where, data }) => {
        const row = rows.completions.find((item) => item.id === where.id);
        Object.assign(row, data);
        return row;
      },
      deleteMany: async ({ where }) => {
        const deleted = rows.completions.filter((row) => matches(row, where));
        rows.completions = rows.completions.filter((row) => !matches(row, where));
        return { count: deleted.length };
      },
    },
  };
  return prisma;
}

function scope(overrides = {}) {
  return {
    languageProfileId: 'profile-owner',
    experienceSessionId: 'session-owner',
    lessonId: 'lesson-owner',
    idempotencyKey: 'attempt-key-1',
    scopeKind: 'milestone',
    scopeKey: `${shared.RLLE_LANGUAGE_MASTERY_MAPPING_VERSION}:en:B1:communication-situations:milestone-1`,
    targetId: 'milestone-1',
    mappingVersion: shared.RLLE_LANGUAGE_MASTERY_MAPPING_VERSION,
    policyVersion: shared.LANGUAGE_MASTERY_POLICY_VERSION,
    masteryContentVersion: null,
    contentDefinitionId: null,
    sourceContentVersion: 3,
    languageCode: 'en',
    cefrLevel: 'B1',
    pillar: 'communication-situations',
    ...overrides,
  };
}

function decision(verdict, rawScore, overrides = {}) {
  return {
    policyVersion: shared.LANGUAGE_MASTERY_POLICY_VERSION,
    verdict,
    reason: verdict === 'mastered'
      ? 'threshold-met'
      : verdict === 'not-mastered'
        ? 'below-threshold'
        : 'autonomy-item-not-evaluable',
    trainingComplete: true,
    missingTrainingFormats: [],
    rawScore,
    threshold: shared.LANGUAGE_MASTERY_THRESHOLD,
    helpUsed: false,
    ...overrides,
  };
}

function bindAssessment(prisma, attempt, id = 'assessment-1') {
  prisma.rows.assessments.push({
    id,
    userId: 'owner',
    lessonId: 'lesson-owner',
    contentVersion: 3,
  });
  return id;
}

function submission(prisma, assessmentId, id, awarded, maximum, displayScore) {
  prisma.rows.submissions.push({
    id,
    userId: 'owner',
    assessmentId,
    score: displayScore,
    results: [{ questionId: 'q1', awarded, max: maximum }],
    createdAt: new Date('2026-10-10T08:05:00.000Z'),
  });
  return id;
}

test('start is owner-scoped and idempotent without duplicating an attempt', async () => {
  const prisma = memoryPrisma();
  const service = new LanguageMasteryAttemptService(prisma);
  const create = prisma.languageMasteryAttempt.create;
  prisma.languageMasteryAttempt.create = async (args) => {
    const concurrentWinner = await create(args);
    prisma.languageMasteryAttempt.create = create;
    assert.ok(concurrentWinner.id);
    throw uniqueConflict();
  };
  const first = await service.start('owner', scope());
  const replay = await service.start('owner', scope());
  assert.equal(first.attemptId, replay.attemptId);
  assert.equal((await service.get('owner', first.attemptId)).id, first.id);
  await assert.rejects(service.get('other', first.attemptId), /not found/);
  assert.equal(prisma.rows.attempts.length, 1);
  await assert.rejects(
    service.start('other', scope({ languageProfileId: 'profile-owner', idempotencyKey: 'foreign' })),
    /Language profile not found/,
  );
  await assert.rejects(
    service.start('owner', scope({ languageCode: 'fr', idempotencyKey: 'wrong-language' })),
    /does not match its profile/,
  );
});

test('89.9 stays 0.899 from rubric points although display score is rounded to 90', async () => {
  const prisma = memoryPrisma();
  const service = new LanguageMasteryAttemptService(prisma);
  const started = await service.start('owner', scope());
  const assessmentId = bindAssessment(prisma, started);
  await service.bindAssessment('owner', started.attemptId, assessmentId);
  const submissionId = submission(prisma, assessmentId, 'submission-899', 899, 1000, 90);
  await assert.rejects(
    service.appendOutcome('owner', {
      attemptId: started.attemptId,
      assessmentSubmissionId: submissionId,
      decision: decision('not-evaluable', null),
      criteria: [{ id: 'contradictory-credit', met: true, score: 0.899 }],
    }),
    /scoreless unmet criteria/,
  );
  const input = {
    attemptId: started.attemptId,
    assessmentSubmissionId: submissionId,
    decision: decision('not-mastered', 0.899),
    criteria: [{ id: 'criterion-1', met: false, score: 0.899 }],
  };
  const evaluated = await service.appendOutcome('owner', input);
  const replay = await service.appendOutcome('owner', input);
  assert.equal(evaluated.verdict, 'not-mastered');
  assert.equal(evaluated.rawScore, 0.899);
  assert.equal(replay.id, evaluated.id);
  assert.equal(prisma.rows.attempts.length, 1);
  await assert.rejects(
    service.linkPublishedCompletion('owner', started.attemptId, 'completion-1'),
    /BLOCKED_CAPABILITY/,
  );
});

test('90 percent publishes only after every prerequisite and criterion passes', async () => {
  const prisma = memoryPrisma();
  const service = new LanguageMasteryAttemptService(prisma);
  const started = await service.start('owner', scope({ idempotencyKey: 'pass-key' }));
  const assessmentId = bindAssessment(prisma, started, 'assessment-pass');
  await service.bindAssessment('owner', started.attemptId, assessmentId);
  const submissionId = submission(prisma, assessmentId, 'submission-pass', 9, 10, 90);
  await assert.rejects(
    service.appendOutcome('owner', {
      attemptId: started.attemptId,
      assessmentSubmissionId: submissionId,
      decision: { ...decision('not-mastered', 0.9), verdict: 'unknown-runtime-verdict' },
      criteria: [{ id: 'criterion-1', met: false, score: 0.9 }],
    }),
    /Unsupported language mastery verdict/,
  );
  for (const invalidScore of [Number.NaN, Number.POSITIVE_INFINITY, -0.01, 1.01]) {
    await assert.rejects(
      service.appendOutcome('owner', {
        attemptId: started.attemptId,
        assessmentSubmissionId: submissionId,
        decision: decision('mastered', invalidScore),
        criteria: [{ id: 'criterion-1', met: true, score: 0.9 }],
      }),
      /finite normalised ratio/,
    );
  }
  const evaluated = await service.appendOutcome('owner', {
    attemptId: started.attemptId,
    assessmentSubmissionId: submissionId,
    decision: decision('mastered', 0.9),
    criteria: [{ id: 'criterion-1', met: true, score: 0.9 }],
  });
  prisma.rows.completions.push({
    id: 'completion-pass',
    userId: 'owner',
    status: 'verified',
    kind: 'language_unit',
    evidenceSource: 'assessment_submission',
    assessmentSubmissionId: submissionId,
    languageProfileId: 'profile-owner',
    experienceSessionId: 'session-owner',
    lessonId: 'lesson-owner',
    learningRefId: 'milestone-1',
    contentVersion: 3,
    languageMasteryAttemptId: null,
  });
  await assert.rejects(
    service.linkPublishedCompletion('owner', evaluated.attemptId, 'completion-pass'),
    /BLOCKED_CAPABILITY/,
  );
  assert.equal(prisma.rows.completions[0].languageMasteryAttemptId, null);

  const resumedService = new LanguageMasteryAttemptService(prisma);
  const [resumed] = await resumedService.projection('owner', 'profile-owner');
  assert.equal(resumed.decision.verdict, 'mastered');
  assert.deepEqual(resumed.criteria, [{ id: 'criterion-1', met: true, score: 0.9 }]);
  assert.equal(resumed.completionId, null);
  const retried = await resumedService.appendOutcome('owner', {
    attemptId: started.attemptId,
    assessmentSubmissionId: submissionId,
    decision: decision('mastered', 0.9),
    criteria: [{ id: 'criterion-1', met: true, score: 0.9 }],
  });
  await assert.rejects(
    resumedService.linkPublishedCompletion('owner', retried.attemptId, 'completion-pass'),
    /BLOCKED_CAPABILITY/,
  );
  assert.equal(prisma.rows.attempts.length, 1);
  assert.equal(prisma.rows.completions.length, 1);
  await assert.rejects(
    resumedService.appendOutcome('owner', {
      attemptId: started.attemptId,
      assessmentSubmissionId: submissionId,
      decision: decision('mastered', 0.9),
      criteria: [{ id: 'criterion-1', met: true, score: 0.91 }],
    }),
    /append-only and already differs/,
  );
});

test('aggregate unit autonomy is persisted but can never publish strict mastery credit', async () => {
  const prisma = memoryPrisma();
  const service = new LanguageMasteryAttemptService(prisma);
  const started = await service.start('owner', scope({
    idempotencyKey: 'unit-autonomy-key',
    scopeKind: 'unit_autonomy',
    scopeKey: `${shared.RLLE_LANGUAGE_MASTERY_MAPPING_VERSION}:en:B1:unit:unit-b1-1`,
    targetId: 'unit-b1-1',
    pillar: null,
  }));
  const assessmentId = bindAssessment(prisma, started, 'assessment-unit');
  await service.bindAssessment('owner', started.attemptId, assessmentId);
  const submissionId = submission(prisma, assessmentId, 'submission-unit', 10, 10, 100);
  const evaluated = await service.appendOutcome('owner', {
    attemptId: started.attemptId,
    assessmentSubmissionId: submissionId,
    decision: decision('mastered', 1),
    criteria: [{ id: 'unit-aggregate', met: true, score: 1 }],
  });
  prisma.rows.completions.push({
    id: 'completion-unit', userId: 'owner', status: 'verified',
    assessmentSubmissionId: submissionId, languageMasteryAttemptId: null,
  });
  assert.equal(evaluated.scopeKind, 'unit_autonomy');
  assert.equal(evaluated.pillar, null);
  await assert.rejects(
    service.linkPublishedCompletion('owner', evaluated.attemptId, 'completion-unit'),
    /BLOCKED_CAPABILITY/,
  );
  assert.equal(prisma.rows.completions[0].languageMasteryAttemptId, null);
});

test('technical failure is append-only NOT_EVALUABLE without score, completion or remediation', async () => {
  const prisma = memoryPrisma();
  const service = new LanguageMasteryAttemptService(prisma);
  const started = await service.start('owner', scope({ idempotencyKey: 'technical-key' }));
  const input = {
    attemptId: started.attemptId,
    decision: decision('not-evaluable', null),
  };
  await assert.rejects(
    service.appendNotEvaluable('owner', {
      ...input,
      criteria: [{ id: 'contradictory-credit', met: true, score: 0.8 }],
    }),
    /scoreless unmet criteria/,
  );
  const updateMany = prisma.languageMasteryAttempt.updateMany;
  prisma.languageMasteryAttempt.updateMany = async () => {
    throw new Error('simulated journal write failure');
  };
  await assert.rejects(
    service.appendNotEvaluable('owner', input),
    /simulated journal write failure/,
  );
  assert.equal(prisma.rows.attempts[0].status, 'started');
  prisma.languageMasteryAttempt.updateMany = updateMany;
  const neutral = await service.appendNotEvaluable('owner', input);
  const firstEvaluatedAt = neutral.evaluatedAt;
  await new Promise((resolve) => setTimeout(resolve, 2));
  const replay = await service.appendNotEvaluable('owner', input);
  assert.equal(neutral.verdict, 'not-evaluable');
  assert.equal(neutral.rawScore, null);
  assert.equal(neutral.completionId, null);
  assert.equal(neutral.remediation, null);
  assert.equal(replay.id, neutral.id);
  assert.equal(replay.evaluatedAt, firstEvaluatedAt);
  await assert.rejects(
    service.projection('other', 'profile-owner'),
    /Language profile not found/,
  );
});

test('pillar remediation preserves neutral evidence but counts only ten new completed sources', async () => {
  const prisma = memoryPrisma();
  const service = new LanguageMasteryAttemptService(prisma);
  const started = await service.start('owner', scope({
    idempotencyKey: 'pillar-fail',
    scopeKind: 'pillar_exam',
    targetId: 'pillar-exam-b1-1',
    scopeKey: `${shared.RLLE_LANGUAGE_MASTERY_MAPPING_VERSION}:en:B1:communication-situations:pillar-exam-b1-1`,
  }));
  const assessmentId = bindAssessment(prisma, started, 'assessment-pillar');
  await service.bindAssessment('owner', started.attemptId, assessmentId);
  const submissionId = submission(prisma, assessmentId, 'submission-pillar', 8, 10, 80);
  await service.appendOutcome('owner', {
    attemptId: started.attemptId,
    assessmentSubmissionId: submissionId,
    decision: decision('not-mastered', 0.8),
    criteria: [{ id: 'pillar-criterion', met: false, score: 0.8 }],
  });

  prisma.rows.exercises.push({
    id: 'exercise-too-old', userId: 'owner', lessonId: 'lesson-owner',
    contentVersion: 3, exerciseIndex: 11, createdAt: new Date('2026-10-10T08:04:59.000Z'),
  });
  await assert.rejects(
    service.appendRemediationEvidence('owner', {
      attemptId: started.attemptId,
      evidenceId: 'repair-too-old',
      trainingFormat: shared.LANGUAGE_TRAINING_FORMATS[1],
      state: 'completed',
      lessonId: 'lesson-owner',
      sourceContentVersion: 3,
      exerciseIndex: 11,
      sourceKind: 'exercise-attempt',
      sourceRefId: 'exercise-too-old',
    }),
    /genuinely new exercise/,
  );

  prisma.rows.exercises.push({
    id: 'exercise-cross-language', userId: 'owner', lessonId: 'lesson-owner-fr',
    contentVersion: 3, exerciseIndex: 0, createdAt: new Date('2026-10-10T09:00:00.000Z'),
  });
  await assert.rejects(
    service.appendRemediationEvidence('owner', {
      attemptId: started.attemptId,
      evidenceId: 'repair-cross-language',
      trainingFormat: shared.LANGUAGE_TRAINING_FORMATS[0],
      state: 'completed',
      lessonId: 'lesson-owner-fr',
      sourceContentVersion: 3,
      exerciseIndex: 0,
      sourceKind: 'exercise-attempt',
      sourceRefId: 'exercise-cross-language',
    }),
    /Versioned remediation lesson not found/,
  );

  prisma.rows.exercises.push({
    id: 'exercise-format-mismatch', userId: 'owner', lessonId: 'lesson-owner',
    contentVersion: 3, exerciseIndex: 12, createdAt: new Date('2026-10-10T09:00:00.000Z'),
  });
  await assert.rejects(
    service.appendRemediationEvidence('owner', {
      attemptId: started.attemptId,
      evidenceId: 'repair-format-mismatch',
      trainingFormat: shared.LANGUAGE_TRAINING_FORMATS[3],
      state: 'completed',
      lessonId: 'lesson-owner',
      sourceContentVersion: 3,
      exerciseIndex: 12,
      sourceKind: 'exercise-attempt',
      sourceRefId: 'exercise-format-mismatch',
    }),
    /format does not match/,
  );

  const createEvidence = prisma.languageMasteryRemediationEvidence.create;
  prisma.languageMasteryRemediationEvidence.create = async (args) => {
    const concurrentWinner = await createEvidence(args);
    prisma.languageMasteryRemediationEvidence.create = createEvidence;
    assert.ok(concurrentWinner.id);
    throw uniqueConflict();
  };
  for (let index = 0; index < 11; index += 1) {
    const sourceRefId = `exercise-${index}`;
    prisma.rows.exercises.push({
      id: sourceRefId,
      userId: 'owner',
      lessonId: 'lesson-owner',
      contentVersion: 3,
      exerciseIndex: index,
      createdAt: new Date(`2026-10-10T09:${String(index).padStart(2, '0')}:00.000Z`),
    });
    await service.appendRemediationEvidence('owner', {
      attemptId: started.attemptId,
      evidenceId: `repair-evidence-${index}`,
      trainingFormat: shared.LANGUAGE_TRAINING_FORMATS[index % shared.LANGUAGE_TRAINING_FORMATS.length],
      state: index === 9 ? 'not-evaluable' : 'completed',
      lessonId: 'lesson-owner',
      sourceContentVersion: 3,
      exerciseIndex: index,
      sourceKind: 'exercise-attempt',
      sourceRefId,
    });
  }
  const [projected] = await service.projection('owner', 'profile-owner');
  assert.equal(projected.remediation.evidenceCount, 11);
  assert.equal(projected.remediation.completedExerciseCount, 10);
  assert.equal(projected.remediation.requiredExerciseCount, 10);

  prisma.rows.exercises.push({
    id: 'exercise-duplicate-index', userId: 'owner', lessonId: 'lesson-owner',
    contentVersion: 3, exerciseIndex: 0, createdAt: new Date('2026-10-10T10:00:00.000Z'),
  });
  await assert.rejects(
    service.appendRemediationEvidence('owner', {
      attemptId: started.attemptId,
      evidenceId: 'repair-duplicate-index',
      trainingFormat: shared.LANGUAGE_TRAINING_FORMATS[0],
      state: 'completed',
      lessonId: 'lesson-owner',
      sourceContentVersion: 3,
      exerciseIndex: 0,
      sourceKind: 'exercise-attempt',
      sourceRefId: 'exercise-duplicate-index',
    }),
    /already recorded/,
  );
});

test('profile reset removes linked proof before owner-scoped attempts', async () => {
  const prisma = memoryPrisma();
  const service = new LanguageMasteryAttemptService(prisma);
  const started = await service.start('owner', scope({ idempotencyKey: 'reset-key' }));
  prisma.rows.completions.push({
    id: 'completion-reset', userId: 'owner', status: 'verified',
    assessmentSubmissionId: null, languageMasteryAttemptId: started.id,
  });
  const removed = await service.purgeOwned('owner', 'profile-owner');
  assert.deepEqual(removed, { attempts: 1, completions: 1 });
  assert.equal(prisma.rows.attempts.length, 0);
  assert.equal(prisma.rows.completions.length, 0);
  await assert.rejects(service.purgeOwned('other', 'profile-owner'), /Language profile not found/);
});

test('migration and HTTP surface stay additive and read-only', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const root = path.resolve(__dirname, '..');
  const migration = fs.readFileSync(path.join(
    root,
    'prisma/migrations/20261010120000_language_mastery_attempt_journal/migration.sql',
  ), 'utf8');
  const controller = fs.readFileSync(path.join(
    root,
    'src/languages/language-mastery-attempt.controller.ts',
  ), 'utf8');
  assert.match(migration, /CREATE TABLE "language_mastery_attempts"/);
  assert.match(migration, /ON DELETE SET NULL/);
  assert.match(migration, /userId_scopeKey_idempotencyKey_key/);
  assert.doesNotMatch(migration, /DROP TABLE|TRUNCATE|DELETE FROM/i);
  assert.match(controller, /@Get\(\)/);
  assert.doesNotMatch(controller, /@Post|@Patch|@Delete/);
});
