'use strict';

require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const shared = require('../../../packages/shared/dist/index.js');
const {
  LearningCompletionService,
} = require('../dist/learning-evidence/learning-completion.service.js');
const {
  EvidenceProgressService,
} = require('../dist/learning-evidence/evidence-progress.service.js');

const EVALUATED_AT = new Date('2026-10-10T09:30:00.000Z');
const STARTED_AT = new Date('2026-10-10T09:00:00.000Z');
const CANONICAL_UNIT = shared.RLLE_LANGUAGE_MASTERY_UNIT_MAP.find((unit) => unit.milestones.length > 0);
const CANONICAL_MILESTONE = CANONICAL_UNIT.milestones[0];
const CANONICAL_PLAN = shared.getRlleLevelPillarPlans(CANONICAL_UNIT.level)
  .find((plan) => plan.contentReady);

function masteredAttempt(overrides = {}) {
  const scopeKind = overrides.scopeKind ?? 'milestone';
  const targetId = overrides.targetId
    ?? (scopeKind === 'pillar_exam' ? CANONICAL_PLAN.examId : CANONICAL_MILESTONE.id);
  const rawScore = overrides.rawScore ?? 0.9;
  const criterionScore = Math.max(rawScore, shared.LANGUAGE_MASTERY_THRESHOLD);
  const pillar = scopeKind === 'pillar_exam' ? CANONICAL_PLAN.pillar : CANONICAL_MILESTONE.pillar;
  const scopeKey = scopeKind === 'pillar_exam'
    ? [shared.RLLE_LANGUAGE_MASTERY_MAPPING_VERSION, 'de', CANONICAL_UNIT.level, pillar, targetId, 'pillar-exam'].join(':')
    : shared.rlleMilestoneEvidenceScopeKey({ languageCode: 'de', milestone: CANONICAL_MILESTONE });
  const criteria = scopeKind === 'pillar_exam'
    ? CANONICAL_PLAN.mandatoryCompetencies.map((item) => ({
        id: item.competencyId, met: true, score: criterionScore,
      }))
    : [{ id: CANONICAL_MILESTONE.criterionId, met: true, score: criterionScore }];
  const attempt = {
    id: 'attempt-row-1',
    userId: 'owner-1',
    languageProfileId: 'profile-1',
    experienceSessionId: 'session-1',
    lessonId: 'lesson-1',
    assessmentId: 'assessment-1',
    assessmentSubmissionId: 'submission-1',
    attemptId: 'attempt-public-1',
    scopeKind,
    scopeKey,
    targetId,
    mappingVersion: shared.RLLE_LANGUAGE_MASTERY_MAPPING_VERSION,
    policyVersion: shared.LANGUAGE_MASTERY_POLICY_VERSION,
    masteryContentVersion: scopeKind === 'pillar_exam' ? null : CANONICAL_MILESTONE.contentVersion,
    contentDefinitionId: scopeKind === 'pillar_exam' ? null : CANONICAL_MILESTONE.contentDefinitionId,
    sourceContentVersion: 4,
    languageCode: 'de',
    cefrLevel: CANONICAL_UNIT.level,
    pillar,
    status: 'evaluated',
    verdict: 'mastered',
    rawScore,
    threshold: shared.LANGUAGE_MASTERY_THRESHOLD,
    decisionReason: 'threshold-met',
    helpUsed: false,
    decision: {
      policyVersion: shared.LANGUAGE_MASTERY_POLICY_VERSION,
      verdict: 'mastered',
      reason: 'threshold-met',
      trainingComplete: true,
      missingTrainingFormats: [],
      rawScore,
      threshold: shared.LANGUAGE_MASTERY_THRESHOLD,
      helpUsed: false,
    },
    criteria,
    startedAt: STARTED_AT,
    evaluatedAt: EVALUATED_AT,
    languageProfile: { id: 'profile-1', userId: 'owner-1', language: 'German' },
    assessmentSubmission: {
      id: 'submission-1',
      userId: 'owner-1',
      assessmentId: 'assessment-1',
      masteryGenerationStatus: 'ready',
      createdAt: EVALUATED_AT,
    },
    ...overrides,
  };
  if (overrides.rawScore !== undefined && overrides.decision === undefined) {
    attempt.decision = { ...attempt.decision, rawScore: overrides.rawScore };
  }
  return attempt;
}

function memoryPrisma(attemptInput, options = {}) {
  const attempts = Array.isArray(attemptInput) ? attemptInput : [attemptInput];
  const attempt = attempts[0];
  const rows = { completions: [], reviewables: [], links: [] };
  const calls = { completionCreates: [], reviewableUpserts: 0, linkUpserts: 0 };
  const prisma = {
    rows,
    calls,
    languageMasteryAttempt: {
      findFirst: async ({ where }) => {
        if (where.attemptId !== undefined) {
          return attempts.find((candidate) => (
            where.userId === candidate.userId && where.attemptId === candidate.attemptId
          )) ?? null;
        }
        if (where.verdict === 'not_mastered') return options.latestFailure ?? null;
        return null;
      },
      findMany: async () => CANONICAL_PLAN.requiredMilestoneIds.map((targetId) => ({ targetId })),
    },
    learningCompletion: {
      findFirst: async ({ where }) => rows.completions.find((candidate) => (
        candidate.userId === where.userId
        && candidate.kind === where.kind
        && candidate.learningRefId === where.learningRefId
      )) ?? null,
      upsert: async (args) => {
        const key = args.where.userId_kind_learningRefId_contentVersion;
        let row = rows.completions.find((candidate) => (
          candidate.userId === key.userId
          && candidate.kind === key.kind
          && candidate.learningRefId === key.learningRefId
          && candidate.contentVersion === key.contentVersion
        ));
        if (!row) {
          calls.completionCreates.push(args.create);
          row = {
            id: `completion-${rows.completions.length + 1}`,
            ...args.create,
            finalizedAt: args.create.finalizedAt ?? new Date(),
            goals: [],
            lesson: null,
            languageProfile: { language: attempt.languageProfile.language },
            languageMasteryAttempt: {
              targetId: attempt.targetId,
              scopeKind: attempt.scopeKind,
            },
          };
          rows.completions.push(row);
        }
        return row;
      },
      findUniqueOrThrow: async ({ where }) => {
        const row = rows.completions.find((candidate) => candidate.id === where.id);
        if (!row) throw new Error('completion not found');
        return row;
      },
    },
    reviewable: {
      upsert: async (args) => {
        calls.reviewableUpserts += 1;
        const key = args.where.userId_kind_refId;
        let row = rows.reviewables.find((candidate) => (
          candidate.userId === key.userId
          && candidate.kind === key.kind
          && candidate.refId === key.refId
        ));
        if (!row) {
          row = { id: `reviewable-${rows.reviewables.length + 1}`, ...args.create };
          rows.reviewables.push(row);
        } else {
          Object.assign(row, args.update);
        }
        return row;
      },
    },
    learningCompletionReviewable: {
      upsert: async (args) => {
        calls.linkUpserts += 1;
        const key = args.where.completionId_reviewableId;
        const existing = rows.links.find((candidate) => (
          candidate.completionId === key.completionId
          && candidate.reviewableId === key.reviewableId
        ));
        if (existing) return existing;
        rows.links.push(args.create);
        return args.create;
      },
    },
  };
  prisma.$executeRaw = async () => 1;
  prisma.$transaction = async (callback) => callback(prisma);
  return prisma;
}

test('mastered milestone and pillar exam publish distinct canonical proof without undoing review scheduling on retry', async (t) => {
  for (const scenario of [
    { scopeKind: 'milestone', expectedKind: 'language_milestone' },
    { scopeKind: 'pillar_exam', expectedKind: 'language_pillar_exam' },
  ]) {
    await t.test(scenario.scopeKind, async () => {
      const attempt = masteredAttempt({ scopeKind: scenario.scopeKind });
      const prisma = memoryPrisma(attempt);
      const service = new LearningCompletionService(prisma, {});
      const first = await service.finalizeLanguageMastery('owner-1', {
        attemptId: attempt.attemptId,
      });
      assert.equal(prisma.rows.reviewables.length, 1);
      assert.equal(prisma.rows.reviewables[0].isScheduled, false);
      assert.equal(Object.hasOwn(prisma.rows.reviewables[0], 'due'), false);

      const scheduledDue = new Date('2026-10-12T09:30:00.000Z');
      Object.assign(prisma.rows.reviewables[0], {
        isScheduled: true,
        due: scheduledDue,
      });
      const replay = await service.finalizeLanguageMastery('owner-1', {
        attemptId: attempt.attemptId,
      });

      assert.equal(first.kind, scenario.expectedKind);
      assert.equal(first.id, replay.id);
      assert.equal(first.result.score, 0.9);
      assert.equal(first.result.passed, true);
      assert.equal(first.title, `German — ${attempt.targetId}`);
      assert.equal(prisma.rows.completions.length, 1);
      assert.equal(prisma.rows.reviewables.length, 1);
      assert.equal(prisma.rows.reviewables[0].isScheduled, true);
      assert.equal(prisma.rows.reviewables[0].due, scheduledDue);
      assert.equal(prisma.rows.links.length, 1);
      assert.equal(prisma.calls.completionCreates.length, 1);
      const created = prisma.calls.completionCreates[0];
      assert.equal(created.evidenceSource, 'language_mastery_attempt');
      assert.equal(created.evidenceRefId, attempt.id);
      assert.equal(created.languageMasteryAttemptId, attempt.id);
      assert.equal(created.assessmentSubmissionId, attempt.assessmentSubmissionId);
      assert.equal(created.provenance.schemaVersion, 2);
      assert.deepEqual(created.provenance.evidenceRefIds, [attempt.id, 'submission-1']);
      assert.equal(created.provenance.languageMastery.scopeKind, scenario.scopeKind);
      assert.equal(created.dimensionScores.knowledge.score, null);
      assert.equal(created.dimensionScores.perspective.score, null);
      assert.equal(Object.hasOwn(prisma, 'reviewSchedule'), false);
    });
  }
});

test('a regenerated source lesson cannot award a second canonical mastery credit', async () => {
  const firstAttempt = masteredAttempt();
  const regeneratedAttempt = masteredAttempt({
    id: 'attempt-row-2',
    attemptId: 'attempt-public-2',
    lessonId: 'lesson-2',
    sourceContentVersion: 9,
    assessmentId: 'assessment-2',
    assessmentSubmissionId: 'submission-2',
    assessmentSubmission: {
      id: 'submission-2',
      userId: 'owner-1',
      assessmentId: 'assessment-2',
      masteryGenerationStatus: 'ready',
      createdAt: EVALUATED_AT,
    },
  });
  const prisma = memoryPrisma([firstAttempt, regeneratedAttempt]);
  const service = new LearningCompletionService(prisma, {});

  const first = await service.finalizeLanguageMastery('owner-1', {
    attemptId: firstAttempt.attemptId,
  });
  const replayFromRegeneratedLesson = await service.finalizeLanguageMastery('owner-1', {
    attemptId: regeneratedAttempt.attemptId,
  });

  assert.equal(first.id, replayFromRegeneratedLesson.id);
  assert.equal(prisma.rows.completions.length, 1);
  assert.equal(prisma.rows.reviewables.length, 1);
  assert.equal(prisma.rows.links.length, 1);
  assert.equal(prisma.calls.completionCreates.length, 1);
  assert.equal(prisma.calls.completionCreates[0].contentVersion, 1);
  assert.equal(prisma.calls.completionCreates[0].provenance.contentVersion, 4);
  assert.equal(prisma.rows.completions[0].languageMasteryAttemptId, firstAttempt.id);
});

test('publication rejects aggregate, failed, assisted, incomplete and foreign attempts without credit', async (t) => {
  const cases = [
    ['unit aggregate', { scopeKind: 'unit_autonomy', pillar: null }],
    ['score 0.899', { rawScore: 0.899 }],
    ['score null', { rawScore: null }],
    ['assisted', { helpUsed: true }],
    ['criterion score 0.899', {
      criteria: [{ id: CANONICAL_MILESTONE.criterionId, met: true, score: 0.899 }],
    }],
    ['criterion score null', {
      criteria: [{ id: CANONICAL_MILESTONE.criterionId, met: true, score: null }],
    }],
    ['criterion unmet', {
      criteria: [{ id: CANONICAL_MILESTONE.criterionId, met: false, score: 0.95 }],
    }],
  ];
  for (const [name, overrides] of cases) {
    await t.test(name, async () => {
      const attempt = masteredAttempt(overrides);
      const prisma = memoryPrisma(attempt);
      await assert.rejects(
        new LearningCompletionService(prisma, {}).finalizeLanguageMastery('owner-1', {
          attemptId: attempt.attemptId,
        }),
      );
      assert.equal(prisma.rows.completions.length, 0);
      assert.equal(prisma.rows.reviewables.length, 0);
    });
  }

  const owned = masteredAttempt();
  const foreignPrisma = memoryPrisma(owned);
  await assert.rejects(
    new LearningCompletionService(foreignPrisma, {}).finalizeLanguageMastery('other-user', {
      attemptId: owned.attemptId,
    }),
    /not found/i,
  );
  assert.equal(foreignPrisma.rows.completions.length, 0);
});

test('pillar publication fails closed when a newer sibling failure still requires remediation', async () => {
  const attempt = masteredAttempt({ scopeKind: 'pillar_exam', remediationPlanId: null });
  const prisma = memoryPrisma(attempt, {
    latestFailure: {
      id: 'failed-sibling-attempt',
      failedRemediationPlan: {
        id: 'remediation-plan-sibling',
        status: 'active',
      },
    },
  });
  await assert.rejects(
    new LearningCompletionService(prisma, {}).finalizeLanguageMastery('owner-1', {
      attemptId: attempt.attemptId,
    }),
    /must complete targeted remediation before publication/,
  );
  assert.equal(prisma.rows.completions.length, 0);
  assert.equal(prisma.rows.reviewables.length, 0);
});

test('mastery completion identity is profile/scoping/version aware and migration is additive', () => {
  const base = {
    languageProfileId: 'profile-1',
    scopeKind: 'milestone',
    scopeKey: 'map:v2:de:B1:milestone-1',
    policyVersion: shared.LANGUAGE_MASTERY_POLICY_VERSION,
    masteryContentVersion: 'content-v1',
    contentDefinitionId: 'definition-1',
  };
  const first = shared.languageMasteryLearningRef(base);
  assert.equal(first, shared.languageMasteryLearningRef(base));
  assert.notEqual(first, shared.languageMasteryLearningRef({ ...base, languageProfileId: 'profile-2' }));
  assert.notEqual(first, shared.languageMasteryLearningRef({ ...base, scopeKind: 'pillar_exam' }));
  assert.notEqual(first, shared.languageMasteryLearningRef({ ...base, masteryContentVersion: 'content-v2' }));

  const root = path.resolve(__dirname, '../../..');
  const migration = fs.readFileSync(path.join(
    root,
    'apps/api/prisma/migrations/20261010130000_language_mastery_completion_publication/migration.sql',
  ), 'utf8');
  assert.match(migration, /LearningCompletionKind[\s\S]*language_milestone/);
  assert.match(migration, /LearningCompletionKind[\s\S]*language_pillar_exam/);
  assert.match(migration, /LearningEvidenceSourceKind[\s\S]*language_mastery_attempt/);
  assert.doesNotMatch(migration, /\b(?:DROP|DELETE|TRUNCATE|UPDATE)\b/i);

  const schedulingMigration = fs.readFileSync(path.join(
    root,
    'apps/api/prisma/migrations/20261010140000_language_mastery_remediation_provenance/migration.sql',
  ), 'utf8');
  assert.match(
    schedulingMigration,
    /ADD COLUMN "isScheduled" BOOLEAN NOT NULL DEFAULT true/,
  );
  assert.match(
    schedulingMigration,
    /reviewables_userId_isScheduled_due_idx/,
  );
  assert.doesNotMatch(schedulingMigration, /UPDATE\s+"reviewables"\s+SET\s+"due"/i);
});

test('generic history keeps mastery kind and projects a readable target title', async () => {
  const row = {
    id: 'completion-history-1',
    kind: 'language_milestone',
    learningRefId: 'opaque-canonical-ref',
    startedAt: STARTED_AT,
    finalizedAt: EVALUATED_AT,
    criteria: [],
    result: { outcome: 'demonstrated', score: 0.9, passed: true, feedback: null },
    provenance: {},
    dimensionScores: {},
    lesson: null,
    languageProfile: { language: 'German', goal: null },
    languageMasteryAttempt: { targetId: 'milestone-b1-1' },
    goals: [],
  };
  const prisma = {
    learningCompletion: {
      findMany: async ({ where, include }) => {
        assert.equal(where.userId, 'owner-1');
        assert.equal(where.status, 'verified');
        assert.deepEqual(include.languageMasteryAttempt, { select: { targetId: true } });
        return [row];
      },
    },
  };
  const history = await new EvidenceProgressService(prisma).history('owner-1');
  assert.equal(history.items[0].kind, 'language_milestone');
  assert.equal(history.items[0].title, 'German — milestone-b1-1');
});
