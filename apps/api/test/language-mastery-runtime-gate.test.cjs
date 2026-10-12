'use strict';

require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  LANGUAGE_MASTERY_POLICY_VERSION,
  RLLE_LANGUAGE_MASTERY_MAPPING_VERSION,
  RLLE_LANGUAGE_MASTERY_UNIT_MAP,
  rlleMilestoneEvidenceScopeKey,
} = require('../../../packages/shared/dist/index.js');
const {
  RealLifeLanguageService,
} = require('../dist/languages/real-life-language.service.js');
const {
  LANGUAGE_MASTERY_RUNTIME_READINESS,
  LANGUAGE_MASTERY_STRICT_RUNTIME_READY,
} = require('../dist/languages/language-mastery-readiness.js');
const {
  LanguageMasteryAttemptService,
} = require('../dist/languages/language-mastery-attempt.service.js');

function serviceWithPrisma(prisma, overrides = {}) {
  return new RealLifeLanguageService(
    prisma,
    overrides.languages ?? {},
    {}, {}, {}, {}, {}, {}, {},
    overrides.examiner ?? {},
    {},
    overrides.featureFlags ?? { enabled: () => true },
    overrides.config ?? { get: () => null },
    overrides.speech ?? {},
    overrides.masteryAttempts ?? {},
  );
}

test('pillar prerequisites accept only current mapping and policy proofs', async () => {
  const rows = [
    {
      userId: 'owner', languageProfileId: 'profile-1', targetId: 'milestone-1',
      mappingVersion: 'legacy-map', policyVersion: LANGUAGE_MASTERY_POLICY_VERSION,
      status: 'evaluated', verdict: 'mastered', completion: { id: 'legacy-proof', status: 'verified' },
    },
    {
      userId: 'owner', languageProfileId: 'profile-1', targetId: 'milestone-1',
      mappingVersion: RLLE_LANGUAGE_MASTERY_MAPPING_VERSION,
      policyVersion: LANGUAGE_MASTERY_POLICY_VERSION,
      status: 'evaluated', verdict: 'mastered', completion: { id: 'current-proof', status: 'verified' },
    },
  ];
  let observedWhere;
  const prisma = {
    languageMasteryAttempt: {
      findMany: async ({ where }) => {
        observedWhere = where;
        return rows
          .filter((row) => row.userId === where.userId
            && row.languageProfileId === where.languageProfileId
            && where.targetId.in.includes(row.targetId)
            && row.mappingVersion === where.mappingVersion
            && row.policyVersion === where.policyVersion
            && row.status === where.status
            && row.verdict === where.verdict
            && row.completion.status === where.completion.is.status)
          .map((row) => ({ targetId: row.targetId, completion: { id: row.completion.id } }));
      },
    },
  };
  const service = serviceWithPrisma(prisma);
  const proofs = await service.requirePillarMilestoneProofs('owner', 'profile-1', ['milestone-1']);
  assert.deepEqual(proofs, ['current-proof']);
  assert.equal(observedWhere.mappingVersion, RLLE_LANGUAGE_MASTERY_MAPPING_VERSION);
  assert.equal(observedWhere.policyVersion, LANGUAGE_MASTERY_POLICY_VERSION);

  rows.pop();
  await assert.rejects(
    service.requirePillarMilestoneProofs('owner', 'profile-1', ['milestone-1']),
    /Every mapped micro-milestone must be published/,
  );
});

test('pillar certification fails closed while non-acoustic remediation remains reachable', async () => {
  let providerCalls = 0;
  let journalWrites = 0;
  let exerciseReads = 0;
  const service = serviceWithPrisma({
    exerciseAttempt: { findFirst: async () => { exerciseReads += 1; return null; } },
  }, {
    languages: {
      requireOwned: async () => ({
        id: 'profile-1', userId: 'owner', language: 'English', normalizedLanguage: 'en',
      }),
    },
    examiner: { create: async () => { providerCalls += 1; } },
    masteryAttempts: { start: async () => { journalWrites += 1; } },
  });
  await assert.rejects(
    service.startScopedMastery('owner', 'profile-1', {
      experienceSessionId: 'session-1',
      lessonId: 'lesson-1',
      scopeKind: 'pillar_exam',
      targetId: 'pillar-exam-1',
      idempotencyKey: 'retry-1',
    }),
    (error) => error?.response?.code === 'LANGUAGE_MASTERY_V1_NOT_AVAILABLE',
  );
  assert.equal(providerCalls, 0);
  assert.equal(journalWrites, 0);
  await assert.rejects(
    service.recordRemediationExercise('owner', 'profile-1', {
      remediationPlanId: 'plan-1',
      failedAttemptId: 'attempt-1',
      lessonId: 'lesson-1',
      exerciseAttemptId: 'exercise-attempt-1',
      exerciseIndex: 0,
      trainingFormat: 'recognition-mcq',
    }),
    /Owned remediation exercise attempt not found/,
  );
  assert.equal(exerciseReads, 1);
  assert.equal(journalWrites, 0);
  assert.equal(LANGUAGE_MASTERY_RUNTIME_READINESS.nativeAcousticAssessmentIntegrated, true);
  assert.equal(LANGUAGE_MASTERY_STRICT_RUNTIME_READY, true);
});

test('strict mastery requires an exact pronunciation provider locale for the product language code', () => {
  let pronunciationAssessmentLocales = {};
  const service = serviceWithPrisma({}, {
    featureFlags: { enabled: () => true },
    config: {
      get: () => ({
        transcriptionLanguageCodes: ['en'],
        synthesisLanguageCodes: ['en'],
        pronunciationAssessmentLanguageCodes: ['en'],
        pronunciationAssessmentLocales,
      }),
    },
    speech: {
      supportsSynthesis: true,
      supportsPronunciationAssessment: true,
      activePronunciationAssessmentProvider: 'azure-speech-simulated',
    },
  });
  const profile = { language: 'English', normalizedLanguage: 'en' };

  assert.equal(service.strictMasteryAvailable(profile), false);
  pronunciationAssessmentLocales = { en: 'en-US' };
  assert.equal(service.strictMasteryAvailable(profile), true);
});

test('canonical language normalisation preserves the registered zh-Hant casing', () => {
  const milestone = RLLE_LANGUAGE_MASTERY_UNIT_MAP
    .flatMap((unit) => unit.milestones)
    .at(0);
  assert.ok(milestone);
  const service = new LanguageMasteryAttemptService({}, {});
  const normalized = service.normalizedStart({
    languageProfileId: 'profile-1',
    experienceSessionId: null,
    lessonId: null,
    idempotencyKey: 'zh-hant-case',
    scopeKind: 'milestone',
    scopeKey: rlleMilestoneEvidenceScopeKey({ languageCode: 'zh-Hant', milestone }),
    targetId: milestone.id,
    mappingVersion: RLLE_LANGUAGE_MASTERY_MAPPING_VERSION,
    policyVersion: LANGUAGE_MASTERY_POLICY_VERSION,
    masteryContentVersion: milestone.contentVersion,
    contentDefinitionId: milestone.contentDefinitionId,
    sourceContentVersion: 1,
    languageCode: 'zh-hant',
    cefrLevel: milestone.level,
    pillar: milestone.pillar,
  });
  assert.equal(normalized.languageCode, 'zh-Hant');
  assert.match(normalized.scopeKey, /:zh-Hant:/);
});
