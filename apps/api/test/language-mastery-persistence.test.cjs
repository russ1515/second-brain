'use strict';

require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');
const { Prisma } = require('@prisma/client');
const shared = require('../../../packages/shared/dist/index.js');
const {
  LanguageMasteryAttemptService,
} = require('../dist/languages/language-mastery-attempt.service.js');
const {
  RealLifeLanguageService,
} = require('../dist/languages/real-life-language.service.js');

const CANONICAL_UNIT = shared.RLLE_LANGUAGE_MASTERY_UNIT_MAP.find((unit) => unit.milestones.length > 0);
const CANONICAL_MILESTONE = CANONICAL_UNIT.milestones[0];
const CANONICAL_PLAN = shared.getRlleLevelPillarPlans(CANONICAL_UNIT.level)
  .find((plan) => plan.contentReady);

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
    remediationPlans: [],
    remediation: [],
    completions: [],
    exercises: [],
  };

  const matches = (row, where) => Object.entries(where ?? {}).every(([key, value]) => {
    if (key === 'OR' && Array.isArray(value)) return value.some((candidate) => matches(row, candidate));
    if (value && typeof value === 'object' && Array.isArray(value.in)) {
      return value.in.includes(row[key]);
    }
    return row[key] === value;
  });
  const decorate = (row) => ({
    ...row,
    completion: rows.completions.find((item) => item.languageMasteryAttemptId === row.id) ?? null,
    remediationEvidence: rows.remediation
      .filter((item) => item.languageMasteryAttemptId === row.id)
      .sort((a, b) => a.recordedAt - b.recordedAt),
    failedRemediationPlan: rows.remediationPlans.find((item) => item.failedAttemptId === row.id) ?? null,
  });
  const decoratePlan = (row) => ({
    ...row,
    failedAttempt: rows.attempts.find((item) => item.id === row.failedAttemptId) ?? null,
    evidence: rows.remediation
      .filter((item) => item.remediationPlanId === row.id)
      .sort((a, b) => a.recordedAt - b.recordedAt),
  });
  let attemptSequence = 0;
  let remediationPlanSequence = 0;
  let remediationSequence = 0;

  const prisma = {
    rows,
    $transaction: async (callback) => callback(prisma),
    $executeRaw: async () => 1,
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
      findMany: async ({ where }) => rows.exercises
        .filter((row) => row.userId === where.userId
          && row.lessonId === where.lessonId
          && row.contentVersion === where.contentVersion
          && row.createdAt > where.createdAt.gt)
        .sort((left, right) => left.createdAt - right.createdAt || left.id.localeCompare(right.id))
        .map((row) => ({ id: row.id, exerciseIndex: row.exerciseIndex })),
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
      findFirst: async ({ where, include }) => {
        const row = rows.attempts.find((item) => matches(item, where));
        if (!row) return null;
        return include?.failedRemediationPlan ? decorate(row) : row;
      },
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
        const planIds = new Set(rows.remediationPlans
          .filter((row) => ids.has(row.failedAttemptId))
          .map((row) => row.id));
        rows.remediationPlans = rows.remediationPlans.filter((row) => !planIds.has(row.id));
        rows.remediation = rows.remediation.filter((row) => !ids.has(row.languageMasteryAttemptId));
        return { count: ids.size };
      },
    },
    languageMasteryRemediationPlan: {
      findFirst: async ({ where }) => {
        const row = rows.remediationPlans.find((item) => matches(item, where));
        return row ? decoratePlan(row) : null;
      },
      findUniqueOrThrow: async ({ where }) => {
        const row = rows.remediationPlans.find((item) => item.id === where.id);
        if (!row) throw new Error('not found');
        return decoratePlan(row);
      },
      create: async ({ data }) => {
        const row = {
          id: `remediation-plan-${++remediationPlanSequence}`,
          remediationLessonId: null,
          readyAt: null,
          lessonBoundAt: null,
          completedAt: null,
          startedAt: new Date('2026-10-10T08:06:00.000Z'),
          ...data,
        };
        rows.remediationPlans.push(row);
        return decoratePlan(row);
      },
      updateMany: async ({ where, data }) => {
        const candidates = rows.remediationPlans.filter((row) => matches(row, where));
        candidates.forEach((row) => Object.assign(row, data));
        return { count: candidates.length };
      },
    },
    languageMasteryRemediationEvidence: {
      findFirst: async ({ where }) => rows.remediation.find((row) => matches(row, where)) ?? null,
      count: async ({ where }) => rows.remediation.filter((row) => matches(row, where)).length,
      create: async ({ data }) => {
        const row = { id: `repair-${++remediationSequence}`, createdAt: new Date(), ...data };
        rows.remediation.push(row);
        return row;
      },
    },
    learningCompletion: {
      findFirst: async ({ where }) => rows.completions.find((row) => matches(row, where)) ?? null,
      findMany: async ({ where }) => rows.completions.filter((row) => matches(row, where)),
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
    learningCompletionReviewable: {
      findMany: async () => [],
    },
    reviewable: {
      deleteMany: async () => ({ count: 0 }),
    },
  };
  return prisma;
}

function scope(overrides = {}) {
  const scopeKind = overrides.scopeKind ?? 'milestone';
  const languageCode = overrides.languageCode ?? 'en';
  const canonical = scopeKind === 'pillar_exam'
    ? {
        targetId: CANONICAL_PLAN.examId,
        scopeKey: [
          shared.RLLE_LANGUAGE_MASTERY_MAPPING_VERSION,
          languageCode,
          CANONICAL_UNIT.level,
          CANONICAL_PLAN.pillar,
          CANONICAL_PLAN.examId,
          'pillar-exam',
        ].join(':'),
        masteryContentVersion: null,
        contentDefinitionId: null,
        pillar: CANONICAL_PLAN.pillar,
      }
    : scopeKind === 'milestone'
      ? {
          targetId: CANONICAL_MILESTONE.id,
          scopeKey: shared.rlleMilestoneEvidenceScopeKey({
            languageCode,
            milestone: CANONICAL_MILESTONE,
          }),
          masteryContentVersion: CANONICAL_MILESTONE.contentVersion,
          contentDefinitionId: CANONICAL_MILESTONE.contentDefinitionId,
          pillar: CANONICAL_MILESTONE.pillar,
        }
      : {
          targetId: 'unit-b1-1',
          scopeKey: `${shared.RLLE_LANGUAGE_MASTERY_MAPPING_VERSION}:${languageCode}:${CANONICAL_UNIT.level}:unit:unit-b1-1`,
          masteryContentVersion: null,
          contentDefinitionId: null,
          pillar: null,
        };
  return {
    languageProfileId: 'profile-owner',
    experienceSessionId: 'session-owner',
    lessonId: 'lesson-owner',
    idempotencyKey: 'attempt-key-1',
    scopeKind,
    scopeKey: canonical.scopeKey,
    targetId: canonical.targetId,
    mappingVersion: shared.RLLE_LANGUAGE_MASTERY_MAPPING_VERSION,
    policyVersion: shared.LANGUAGE_MASTERY_POLICY_VERSION,
    masteryContentVersion: canonical.masteryContentVersion,
    contentDefinitionId: canonical.contentDefinitionId,
    sourceContentVersion: 3,
    languageCode,
    cefrLevel: CANONICAL_UNIT.level,
    pillar: canonical.pillar,
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
    masteryCreationKey: attempt.attemptId,
    masteryGenerationStatus: 'ready',
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
    masteryGenerationStatus: 'ready',
    createdAt: new Date('2026-10-10T08:05:00.000Z'),
  });
  return id;
}

function masteryService(prisma) {
  return new LanguageMasteryAttemptService(prisma, {
    finalizeLanguageMastery: async () => {
      throw new Error('BLOCKED_CAPABILITY');
    },
  });
}

test('start is owner-scoped and idempotent without duplicating an attempt', async () => {
  const prisma = memoryPrisma();
  const service = masteryService(prisma);
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

test('publish wrapper and reload projection reuse canonical mastery credit across lesson versions', async () => {
  const prisma = memoryPrisma();
  prisma.rows.lessons.push({
    id: 'lesson-owner-v4',
    userId: 'owner',
    languageProfileId: 'profile-owner',
    contentVersion: 4,
    exercises: Array.from({ length: 24 }, (_, index) => ({
      languageFormat: shared.LANGUAGE_TRAINING_FORMATS[index % shared.LANGUAGE_TRAINING_FORMATS.length],
    })),
  });
  let finalizeCalls = 0;
  const completionService = {
    finalizeLanguageMastery: async (userId, input) => {
      finalizeCalls += 1;
      const attempt = prisma.rows.attempts.find((item) => (
        item.userId === userId && item.attemptId === input.attemptId
      ));
      assert.ok(attempt);
      const learningRefId = shared.languageMasteryLearningRef({
        languageProfileId: attempt.languageProfileId,
        scopeKind: 'milestone',
        scopeKey: attempt.scopeKey,
        policyVersion: attempt.policyVersion,
        masteryContentVersion: attempt.masteryContentVersion,
        contentDefinitionId: attempt.contentDefinitionId,
      });
      let completion = prisma.rows.completions.find((item) => (
        item.userId === userId
        && item.kind === 'language_milestone'
        && item.learningRefId === learningRefId
      ));
      if (!completion) {
        completion = {
          id: 'canonical-milestone-completion',
          userId,
          status: 'verified',
          kind: 'language_milestone',
          learningRefId,
          contentVersion: 1,
          languageProfileId: attempt.languageProfileId,
          languageMasteryAttemptId: attempt.id,
        };
        prisma.rows.completions.push(completion);
      }
      return { id: completion.id };
    },
  };
  const service = new LanguageMasteryAttemptService(prisma, completionService);

  async function evaluateAttempt({ suffix, lessonId, sourceContentVersion }) {
    const started = await service.start('owner', scope({
      idempotencyKey: `canonical-${suffix}`,
      lessonId,
      sourceContentVersion,
    }));
    const assessmentId = `assessment-canonical-${suffix}`;
    prisma.rows.assessments.push({
      id: assessmentId,
      userId: 'owner',
      lessonId,
      contentVersion: sourceContentVersion,
      masteryCreationKey: started.attemptId,
      masteryGenerationStatus: 'ready',
    });
    await service.bindAssessment('owner', started.attemptId, assessmentId);
    const submissionId = submission(
      prisma,
      assessmentId,
      `submission-canonical-${suffix}`,
      9,
      10,
      90,
    );
    await service.appendOutcome('owner', {
      attemptId: started.attemptId,
      assessmentSubmissionId: submissionId,
      decision: decision('mastered', 0.9),
      criteria: [{ id: CANONICAL_MILESTONE.criterionId, met: true, score: 0.9 }],
    });
    return service.publishCompletion('owner', started.attemptId);
  }

  const first = await evaluateAttempt({
    suffix: 'v3',
    lessonId: 'lesson-owner',
    sourceContentVersion: 3,
  });
  const regenerated = await evaluateAttempt({
    suffix: 'v4',
    lessonId: 'lesson-owner-v4',
    sourceContentVersion: 4,
  });

  assert.equal(first.completionId, 'canonical-milestone-completion');
  assert.equal(regenerated.completionId, first.completionId);
  assert.equal(prisma.rows.completions.length, 1);
  assert.equal(finalizeCalls, 2);

  const reloadedService = new LanguageMasteryAttemptService(prisma, completionService);
  const projected = await reloadedService.projection('owner', 'profile-owner');
  assert.equal(projected.length, 2);
  assert.deepEqual(projected.map((item) => item.completionId), [
    'canonical-milestone-completion',
    'canonical-milestone-completion',
  ]);
  assert.equal(
    (await reloadedService.get('owner', regenerated.attemptId)).completionId,
    'canonical-milestone-completion',
  );
  assert.equal(finalizeCalls, 2);
});

test('89.9 stays 0.899 from rubric points although display score is rounded to 90', async () => {
  const prisma = memoryPrisma();
  const service = masteryService(prisma);
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
    criteria: [{ id: CANONICAL_MILESTONE.criterionId, met: false, score: 0.899 }],
  };
  const evaluated = await service.appendOutcome('owner', input);
  const replay = await service.appendOutcome('owner', input);
  assert.equal(evaluated.verdict, 'not-mastered');
  assert.equal(evaluated.rawScore, 0.899);
  assert.equal(replay.id, evaluated.id);
  assert.equal(prisma.rows.attempts.length, 1);
  await assert.rejects(
    service.publishCompletion('owner', started.attemptId),
    /BLOCKED_CAPABILITY/,
  );
});

test('90 percent publishes only after every prerequisite and criterion passes', async () => {
  const prisma = memoryPrisma();
  const service = masteryService(prisma);
  const started = await service.start('owner', scope({ idempotencyKey: 'pass-key' }));
  const assessmentId = bindAssessment(prisma, started, 'assessment-pass');
  await service.bindAssessment('owner', started.attemptId, assessmentId);
  const submissionId = submission(prisma, assessmentId, 'submission-pass', 9, 10, 90);
  await assert.rejects(
    service.appendOutcome('owner', {
      attemptId: started.attemptId,
      assessmentSubmissionId: submissionId,
      decision: { ...decision('not-mastered', 0.9), verdict: 'unknown-runtime-verdict' },
      criteria: [{ id: CANONICAL_MILESTONE.criterionId, met: false, score: 0.9 }],
    }),
    /Unsupported language mastery verdict/,
  );
  for (const invalidScore of [Number.NaN, Number.POSITIVE_INFINITY, -0.01, 1.01]) {
    await assert.rejects(
      service.appendOutcome('owner', {
        attemptId: started.attemptId,
        assessmentSubmissionId: submissionId,
        decision: decision('mastered', invalidScore),
        criteria: [{ id: CANONICAL_MILESTONE.criterionId, met: true, score: 0.9 }],
      }),
      /finite normalised ratio/,
    );
  }
  const evaluated = await service.appendOutcome('owner', {
    attemptId: started.attemptId,
    assessmentSubmissionId: submissionId,
    decision: decision('mastered', 0.9),
    criteria: [{ id: CANONICAL_MILESTONE.criterionId, met: true, score: 0.9 }],
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
    learningRefId: CANONICAL_MILESTONE.id,
    contentVersion: 3,
    languageMasteryAttemptId: null,
  });
  await assert.rejects(
    service.publishCompletion('owner', evaluated.attemptId),
    /BLOCKED_CAPABILITY/,
  );
  assert.equal(prisma.rows.completions[0].languageMasteryAttemptId, null);

  const resumedService = masteryService(prisma);
  const [resumed] = await resumedService.projection('owner', 'profile-owner');
  assert.equal(resumed.decision.verdict, 'mastered');
  assert.deepEqual(resumed.criteria, [{ id: CANONICAL_MILESTONE.criterionId, met: true, score: 0.9 }]);
  assert.equal(resumed.completionId, null);
  const retried = await resumedService.appendOutcome('owner', {
    attemptId: started.attemptId,
    assessmentSubmissionId: submissionId,
    decision: decision('mastered', 0.9),
    criteria: [{ id: CANONICAL_MILESTONE.criterionId, met: true, score: 0.9 }],
  });
  await assert.rejects(
    resumedService.publishCompletion('owner', retried.attemptId),
    /BLOCKED_CAPABILITY/,
  );
  assert.equal(prisma.rows.attempts.length, 1);
  assert.equal(prisma.rows.completions.length, 1);
  await assert.rejects(
    resumedService.appendOutcome('owner', {
      attemptId: started.attemptId,
      assessmentSubmissionId: submissionId,
      decision: decision('mastered', 0.9),
      criteria: [{ id: CANONICAL_MILESTONE.criterionId, met: true, score: 0.91 }],
    }),
    /append-only and already differs/,
  );
});

test('aggregate unit autonomy is persisted but can never publish strict mastery credit', async () => {
  const prisma = memoryPrisma();
  const service = masteryService(prisma);
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
    service.publishCompletion('owner', evaluated.attemptId),
    /BLOCKED_CAPABILITY/,
  );
  assert.equal(prisma.rows.completions[0].languageMasteryAttemptId, null);
});

test('technical failure is append-only NOT_EVALUABLE without score, completion or remediation', async () => {
  const prisma = memoryPrisma();
  const service = masteryService(prisma);
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

test('milestone remediation plan survives a service reload and remains target-scoped', async () => {
  const prisma = memoryPrisma();
  const service = masteryService(prisma);
  const started = await service.start('owner', scope({ idempotencyKey: 'milestone-fail' }));
  const assessmentId = bindAssessment(prisma, started, 'assessment-milestone-fail');
  await service.bindAssessment('owner', started.attemptId, assessmentId);
  const submissionId = submission(
    prisma,
    assessmentId,
    'submission-milestone-fail',
    8,
    10,
    80,
  );
  await service.appendOutcome('owner', {
    attemptId: started.attemptId,
    assessmentSubmissionId: submissionId,
    decision: decision('not-mastered', 0.8),
    criteria: [{ id: CANONICAL_MILESTONE.criterionId, met: false, score: 0.8 }],
  });
  const plan = await service.startRemediationPlan('owner', {
    failedAttemptId: started.attemptId,
    idempotencyKey: 'milestone-remediation',
  });
  const reloaded = masteryService(prisma);
  const projection = await reloaded.projection('owner', 'profile-owner');
  const failed = projection.find((item) => item.attemptId === started.attemptId);
  assert.equal(failed.scopeKind, 'milestone');
  assert.equal(failed.targetId, CANONICAL_MILESTONE.id);
  assert.equal(failed.remediation.planId, plan.id);
  assert.equal(failed.remediation.status, 'preparing');
});

test('pillar remediation preserves neutral evidence but counts only ten new completed sources', async () => {
  const prisma = memoryPrisma();
  const service = masteryService(prisma);
  const started = await service.start('owner', scope({
    idempotencyKey: 'pillar-fail',
    scopeKind: 'pillar_exam',
  }));
  const assessmentId = bindAssessment(prisma, started, 'assessment-pillar');
  await service.bindAssessment('owner', started.attemptId, assessmentId);
  const submissionId = submission(prisma, assessmentId, 'submission-pillar', 8, 10, 80);
  await service.appendOutcome('owner', {
    attemptId: started.attemptId,
    assessmentSubmissionId: submissionId,
    decision: decision('not-mastered', 0.8),
    criteria: [{ id: CANONICAL_PLAN.mandatoryCompetencies[0].competencyId, met: false, score: 0.8 }],
  });

  const remediationPlan = await service.startRemediationPlan('owner', {
    failedAttemptId: started.attemptId,
    idempotencyKey: 'pillar-fail-remediation',
  });
  const automaticThenUserReplay = await service.startRemediationPlan('owner', {
    failedAttemptId: started.attemptId,
    idempotencyKey: 'different-mobile-command-key',
  });
  assert.equal(automaticThenUserReplay.id, remediationPlan.id);
  assert.equal(automaticThenUserReplay.generationKey, remediationPlan.generationKey);
  await assert.rejects(
    service.bindRemediationLesson('owner', {
      remediationPlanId: remediationPlan.id,
      lessonId: 'lesson-owner-fr',
    }),
    /New owner-scoped remediation lesson not found/,
  );
  prisma.rows.lessons.push({
    id: 'lesson-remediation-owner',
    userId: 'owner',
    languageProfileId: 'profile-owner',
    contentVersion: 4,
    createdAt: new Date('2026-10-10T08:10:00.000Z'),
    masteryRemediationGenerationKey: remediationPlan.generationKey,
    exercises: Array.from({ length: 24 }, (_, index) => ({
      languageFormat: shared.LANGUAGE_TRAINING_FORMATS[index % shared.LANGUAGE_TRAINING_FORMATS.length],
    })),
  });
  const activePlan = await service.bindRemediationLesson('owner', {
    remediationPlanId: remediationPlan.id,
    lessonId: 'lesson-remediation-owner',
  });
  assert.equal(activePlan.status, 'active');
  assert.equal(activePlan.remediationLessonId, 'lesson-remediation-owner');

  prisma.rows.exercises.push({
    id: 'exercise-too-old', userId: 'owner', lessonId: 'lesson-remediation-owner',
    contentVersion: 4, exerciseIndex: 11, createdAt: new Date('2026-10-10T08:04:59.000Z'),
  });
  await assert.rejects(
    service.appendRemediationEvidence('owner', {
      attemptId: started.attemptId,
      remediationPlanId: remediationPlan.id,
      evidenceId: 'repair-too-old',
      trainingFormat: shared.LANGUAGE_TRAINING_FORMATS[1],
      state: 'completed',
      lessonId: 'lesson-remediation-owner',
      sourceContentVersion: 4,
      exerciseIndex: 11,
      sourceKind: 'exercise-attempt',
      sourceRefId: 'exercise-too-old',
    }),
    /genuinely new exercise/,
  );

  prisma.rows.exercises.push({
    id: 'exercise-format-mismatch', userId: 'owner', lessonId: 'lesson-remediation-owner',
    contentVersion: 4, exerciseIndex: 12, createdAt: new Date('2026-10-10T09:00:00.000Z'),
  });
  await assert.rejects(
    service.appendRemediationEvidence('owner', {
      attemptId: started.attemptId,
      remediationPlanId: remediationPlan.id,
      evidenceId: 'repair-format-mismatch',
      trainingFormat: shared.LANGUAGE_TRAINING_FORMATS[3],
      state: 'completed',
      lessonId: 'lesson-remediation-owner',
      sourceContentVersion: 4,
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
    const audio = shared.LANGUAGE_TRAINING_FORMATS[index] === 'voice-pronunciation';
    const evidenceId = audio
      ? `audio-training:repair-evidence-${index}`
      : `repair-evidence-${index}`;
    const sourceRefId = audio ? evidenceId : `exercise-${index}`;
    if (!audio) {
      prisma.rows.exercises.push({
        id: sourceRefId,
        userId: 'owner',
        lessonId: 'lesson-remediation-owner',
        contentVersion: 4,
        exerciseIndex: index,
        createdAt: new Date(`2026-10-10T09:${String(index).padStart(2, '0')}:00.000Z`),
      });
    }
    await service.appendRemediationEvidence('owner', {
      attemptId: started.attemptId,
      remediationPlanId: remediationPlan.id,
      evidenceId,
      trainingFormat: shared.LANGUAGE_TRAINING_FORMATS[index % shared.LANGUAGE_TRAINING_FORMATS.length],
      state: index === 9 ? 'not-evaluable' : 'completed',
      lessonId: 'lesson-remediation-owner',
      sourceContentVersion: 4,
      exerciseIndex: index,
      sourceKind: audio ? 'audio-native-coaching' : 'exercise-attempt',
      sourceRefId,
    });
  }
  const [projected] = await service.projection('owner', 'profile-owner');
  assert.equal(projected.remediation.evidenceCount, 11);
  assert.equal(projected.remediation.completedExerciseCount, 10);
  assert.equal(projected.remediation.requiredExerciseCount, 10);
  assert.equal(projected.remediation.planId, remediationPlan.id);
  assert.equal(projected.remediation.status, 'ready_for_retest');

  prisma.rows.exercises.push({
    id: 'exercise-duplicate-index', userId: 'owner', lessonId: 'lesson-remediation-owner',
    contentVersion: 4, exerciseIndex: 0, createdAt: new Date('2026-10-10T10:00:00.000Z'),
  });
  await assert.rejects(
    service.appendRemediationEvidence('owner', {
      attemptId: started.attemptId,
      remediationPlanId: remediationPlan.id,
      evidenceId: 'repair-duplicate-index',
      trainingFormat: shared.LANGUAGE_TRAINING_FORMATS[0],
      state: 'completed',
      lessonId: 'lesson-remediation-owner',
      sourceContentVersion: 4,
      exerciseIndex: 0,
      sourceKind: 'exercise-attempt',
      sourceRefId: 'exercise-duplicate-index',
    }),
    /already recorded/,
  );
});

test('reconnect recovers ten distinct post-failure ExerciseAttempts and exposes one eligible retest', async () => {
  const prisma = memoryPrisma();
  const journal = masteryService(prisma);
  const failed = await journal.start('owner', scope({
    idempotencyKey: 'pillar-reconnect-failure',
    scopeKind: 'pillar_exam',
  }));
  const assessmentId = bindAssessment(prisma, failed, 'assessment-reconnect-failure');
  await journal.bindAssessment('owner', failed.attemptId, assessmentId);
  const submissionId = submission(
    prisma,
    assessmentId,
    'submission-reconnect-failure',
    8,
    10,
    80,
  );
  await journal.appendOutcome('owner', {
    attemptId: failed.attemptId,
    assessmentSubmissionId: submissionId,
    decision: decision('not-mastered', 0.8),
    criteria: [{
      id: CANONICAL_PLAN.mandatoryCompetencies[0].competencyId,
      met: false,
      score: 0.8,
    }],
  });
  const plan = await journal.startRemediationPlan('owner', {
    failedAttemptId: failed.attemptId,
    idempotencyKey: 'pillar-reconnect-plan',
  });
  prisma.rows.lessons.push({
    id: 'lesson-reconnect-remediation',
    userId: 'owner',
    languageProfileId: 'profile-owner',
    contentVersion: 5,
    createdAt: new Date('2026-10-10T08:10:00.000Z'),
    masteryRemediationGenerationKey: plan.generationKey,
    exercises: Array.from({ length: 10 }, (_, index) => ({
      languageFormat: shared.LANGUAGE_TRAINING_FORMATS[index],
    })),
  });
  await journal.bindRemediationLesson('owner', {
    remediationPlanId: plan.id,
    lessonId: 'lesson-reconnect-remediation',
  });
  for (let index = 0; index < 10; index += 1) {
    prisma.rows.exercises.push({
      id: `exercise-reconnect-${index}`,
      userId: 'owner',
      lessonId: 'lesson-reconnect-remediation',
      contentVersion: 5,
      exerciseIndex: index,
      correct: true,
      score: 1,
      createdAt: new Date(`2026-10-10T09:${String(index).padStart(2, '0')}:00.000Z`),
    });
  }

  const a1Units = shared.RLLE_LANGUAGE_MASTERY_UNIT_MAP
    .filter((unit) => unit.level === 'A1');
  const publishedMilestones = a1Units.flatMap((unit) => unit.milestones)
    .map((milestone, index) => ({
      id: `published-row-${index}`,
      attemptId: `published-attempt-${index}`,
      idempotencyKey: `published-operation-${index}`,
      scopeKind: 'milestone',
      scopeKey: shared.rlleMilestoneEvidenceScopeKey({ languageCode: 'en', milestone }),
      targetId: milestone.id,
      mappingVersion: shared.RLLE_LANGUAGE_MASTERY_MAPPING_VERSION,
      policyVersion: shared.LANGUAGE_MASTERY_POLICY_VERSION,
      masteryContentVersion: milestone.contentVersion,
      contentDefinitionId: milestone.contentDefinitionId,
      sourceContentVersion: 3,
      lessonId: 'lesson-owner',
      languageCode: 'en',
      cefrLevel: milestone.level,
      pillar: milestone.pillar,
      status: 'evaluated',
      verdict: 'mastered',
      rawScore: 1,
      threshold: 0.9,
      decisionReason: 'threshold-met',
      helpUsed: false,
      decision: decision('mastered', 1),
      criteria: [{ id: milestone.criterionId, met: true, score: 1 }],
      assessmentId: `published-assessment-${index}`,
      assessmentSubmissionId: `published-submission-${index}`,
      completionId: `published-completion-${index}`,
      remediation: null,
      startedAt: '2026-10-10T08:00:00.000Z',
      evaluatedAt: '2026-10-10T08:01:00.000Z',
    }));
  const masteryAttempts = {
    projection: async (userId, profileId) => [
      ...publishedMilestones,
      ...await journal.projection(userId, profileId),
    ],
    reconcileRemediationExerciseAttempts: (...args) =>
      journal.reconcileRemediationExerciseAttempts(...args),
  };
  const runtime = new RealLifeLanguageService(
    prisma,
    {}, {}, {}, {}, {}, {}, {}, {}, {}, {},
    { enabled: () => true },
    { get: () => null },
    {},
    masteryAttempts,
  );
  runtime.strictMasteryAvailable = () => true;
  const curriculumIds = a1Units.map((unit) => unit.unitId);
  const state = {
    schemaVersion: 2,
    startLevel: 'A1',
    level: { declared: 'A1', estimated: null, evaluated: null, target: 'A1' },
    goal: null,
    goalDomain: 'general',
    curriculumIds,
    completedUnitIds: [],
    masteryPolicyVersion: shared.LANGUAGE_MASTERY_POLICY_VERSION,
    legacyCompletedUnitIds: [],
    milestoneMastery: Object.fromEntries(curriculumIds.map((unitId) => [
      unitId,
      runtime.emptyMilestoneMastery(unitId),
    ])),
    currentUnitId: curriculumIds[0],
    unitLessonIds: { [curriculumIds[0]]: ['lesson-reconnect-remediation'] },
    unitLastActivityAt: {},
    currentLesson: {
      lessonId: 'lesson-reconnect-remediation',
      unitId: curriculumIds[0],
    },
    currentMission: null,
    evidence: [],
    gaps: [],
    mistakeMemory: [],
    repairLoops: [],
    immersionIntensity: 'guided',
    correctionIntensity: 'balanced',
  };

  const recovered = await runtime.reconcileCanonicalMastery(
    'owner',
    {
      id: 'profile-owner',
      userId: 'owner',
      language: 'English',
      normalizedLanguage: 'en',
    },
    state,
  );
  const recoveredFailure = (await journal.projection('owner', 'profile-owner'))
    .find((attempt) => attempt.attemptId === failed.attemptId);
  assert.equal(recoveredFailure.remediation.completedExerciseCount, 10);
  assert.equal(recoveredFailure.remediation.evidenceCount, 10);
  assert.equal(recoveredFailure.remediation.status, 'ready_for_retest');
  assert.equal(recovered.nextMasteryTarget.scopeKind, 'pillar_exam');
  assert.equal(recovered.nextMasteryTarget.targetId, CANONICAL_PLAN.examId);
  assert.equal(recovered.nextMasteryTarget.remediationPlanId, plan.id);
  assert.equal(recovered.nextMasteryTarget.eligible, true);
  const operationKey = recovered.nextMasteryTarget.operationKey;

  const replay = await runtime.reconcileCanonicalMastery(
    'owner',
    {
      id: 'profile-owner',
      userId: 'owner',
      language: 'English',
      normalizedLanguage: 'en',
    },
    recovered.state,
  );
  assert.equal(prisma.rows.remediation.length, 10);
  assert.equal(replay.nextMasteryTarget.operationKey, operationKey);
  assert.equal(replay.nextMasteryTarget.eligible, true);
});

test('a pre-started pillar attempt cannot submit after a sibling failure without completed remediation', async () => {
  const prisma = memoryPrisma();
  const service = masteryService(prisma);
  const stale = await service.start('owner', scope({
    idempotencyKey: 'pillar-prestarted-stale',
    scopeKind: 'pillar_exam',
  }));
  const failing = await service.start('owner', scope({
    idempotencyKey: 'pillar-concurrent-failure',
    scopeKind: 'pillar_exam',
  }));

  const failedAssessment = bindAssessment(prisma, failing, 'assessment-concurrent-failure');
  await service.bindAssessment('owner', failing.attemptId, failedAssessment);
  const failedSubmission = submission(
    prisma,
    failedAssessment,
    'submission-concurrent-failure',
    8,
    10,
    80,
  );
  await service.appendOutcome('owner', {
    attemptId: failing.attemptId,
    assessmentSubmissionId: failedSubmission,
    decision: decision('not-mastered', 0.8),
    criteria: [{ id: CANONICAL_PLAN.mandatoryCompetencies[0].competencyId, met: false, score: 0.8 }],
  });
  await service.startRemediationPlan('owner', {
    failedAttemptId: failing.attemptId,
    idempotencyKey: 'automatic-plan-after-failure',
  });

  const staleAssessment = bindAssessment(prisma, stale, 'assessment-prestarted-stale');
  await service.bindAssessment('owner', stale.attemptId, staleAssessment);
  const staleSubmission = submission(
    prisma,
    staleAssessment,
    'submission-prestarted-stale',
    10,
    10,
    100,
  );
  await assert.rejects(
    service.appendOutcome('owner', {
      attemptId: stale.attemptId,
      assessmentSubmissionId: staleSubmission,
      decision: decision('mastered', 1),
      criteria: CANONICAL_PLAN.mandatoryCompetencies.map((item) => ({
        id: item.competencyId,
        met: true,
        score: 1,
      })),
    }),
    /must complete its targeted remediation before submission/,
  );
  assert.equal(prisma.rows.attempts.find((row) => row.id === stale.id).status, 'assessment_bound');
});

test('profile reset removes linked proof before owner-scoped attempts', async () => {
  const prisma = memoryPrisma();
  const service = masteryService(prisma);
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
