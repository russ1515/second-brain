'use strict';

require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');
const { ForbiddenException } = require('@nestjs/common');
const {
  LanguageAcousticMasteryService,
} = require('../dist/languages/language-acoustic-mastery.service.js');
const { ExaminerService } = require('../dist/examiner/examiner.service.js');
const { SpeechController } = require('../dist/speech/speech.controller.js');
const shared = require('../../../packages/shared/dist/index.js');

const AUDIO = Buffer.concat([
  Buffer.from([0x1a, 0x45, 0xdf, 0xa3]),
  Buffer.from('bounded-test-audio'),
]);
const FILE = { buffer: AUDIO, mimetype: 'audio/webm' };

function targetFixture() {
  const unit = shared.RLLE_LANGUAGE_MASTERY_UNIT_MAP.find(
    (candidate) => candidate.unitId === 'a2-routines',
  );
  assert.ok(unit, 'A2 mapped unit must exist');
  const milestone = unit.milestones.find(
    (candidate) => candidate.oralRole === 'audio-native-assessment',
  );
  assert.ok(milestone, 'native acoustic milestone must exist');
  return { unit, milestone };
}

function trainingEvidence() {
  return shared.LANGUAGE_TRAINING_FORMATS.map((format, index) => ({
    id: `training-${index + 1}`,
    format,
    state: 'completed',
    helpUsed: false,
    lessonId: 'lesson-1',
    contentVersion: 7,
  }));
}

function projection(overrides = {}) {
  return {
    id: 'row-1',
    attemptId: 'attempt-1',
    idempotencyKey: 'acoustic-attempt-1',
    scopeKind: 'milestone',
    scopeKey: 'scope-1',
    targetId: targetFixture().milestone.id,
    mappingVersion: shared.RLLE_LANGUAGE_MASTERY_MAPPING_VERSION,
    policyVersion: shared.LANGUAGE_MASTERY_POLICY_VERSION,
    masteryContentVersion: targetFixture().milestone.contentVersion,
    contentDefinitionId: targetFixture().milestone.contentDefinitionId,
    sourceContentVersion: 7,
    lessonId: 'lesson-1',
    languageCode: 'en',
    cefrLevel: 'A2',
    pillar: 'orthography-graphy-phonetics',
    status: 'started',
    verdict: null,
    rawScore: null,
    threshold: shared.LANGUAGE_MASTERY_THRESHOLD,
    decisionReason: null,
    helpUsed: false,
    decision: null,
    criteria: [],
    assessmentId: null,
    assessmentSubmissionId: null,
    completionId: null,
    remediation: null,
    startedAt: '2026-10-12T10:00:00.000Z',
    evaluatedAt: null,
    ...overrides,
  };
}

function acousticResult(mode, values = {}, includeProsody = true) {
  const dimensions = [
    { kind: 'accuracy', rawValue: values.accuracy ?? 95, range: { min: 0, max: 100 } },
    { kind: 'fluency', rawValue: values.fluency ?? 95, range: { min: 0, max: 100 } },
  ];
  if (includeProsody) {
    dimensions.push({
      kind: 'prosody', rawValue: values.prosody ?? 95, range: { min: 0, max: 100 },
    });
  }
  return {
    contractVersion: shared.ACOUSTIC_ASSESSMENT_CONTRACT_VERSION,
    rubricVersion: shared.LANGUAGE_MASTERY_POLICY_VERSION,
    provider: 'azure-speech',
    providerModel: 'pronunciation-assessment',
    providerAdapterVersion: 'azure-pa-v1',
    requestedLocale: 'en-US',
    providerLocale: 'en-US',
    mode,
    referenceTextFingerprint: mode === 'scripted-reference' ? 'a'.repeat(64) : null,
    providerRequestId: `request-${mode}`,
    audioSeconds: 1.25,
    outcome: 'evaluated',
    dimensions,
    reason: null,
  };
}

function fixture(options = {}) {
  const { unit, milestone } = targetFixture();
  const observed = {
    speech: [],
    starts: [],
    notEvaluable: [],
    assessments: [],
    submissions: [],
    binds: [],
    outcomes: [],
    completions: [],
    remediations: [],
    recoveries: [],
  };
  const prisma = {
    languageProfile: {
      findFirst: async () => ({ id: 'profile-1', userId: 'user-1', language: 'English' }),
    },
    experienceSession: {
      findFirst: async () => ({
        id: 'session-1',
        currentStep: {
          metadata: {
            rlleCourse: {
              currentLesson: { lessonId: 'lesson-1', unitId: unit.unitId, status: 'active' },
              milestoneMastery: {
                [unit.unitId]: { trainingEvidence: trainingEvidence() },
              },
            },
          },
        },
      }),
    },
    lesson: {
      findFirst: async () => ({
        id: 'lesson-1',
        contentVersion: 7,
        topic: 'Everyday routines',
        exercises: [{
          languageFormat: 'voice-pronunciation',
          audioText: 'Please introduce yourself and describe your routine.',
        }],
      }),
    },
  };
  const config = {
    get: () => ({
      transcriptionLanguageCodes: ['en'],
      synthesisLanguageCodes: ['en'],
      pronunciationAssessmentLanguageCodes: options.allowlisted === false ? [] : ['en'],
      pronunciationAssessmentLocales: options.localeMissing ? {} : { en: 'en-US' },
    }),
  };
  const featureFlags = {
    enabled: (flag) => flag === 'languageMasteryV1' && options.featureOff !== true,
  };
  let resultIndex = 0;
  const provided = options.results ?? [
    acousticResult('scripted-reference'),
    acousticResult('spontaneous'),
  ];
  const speech = {
    supportsSynthesis: true,
    supportsPronunciationAssessment: options.providerMissing !== true,
    activePronunciationAssessmentProvider: options.providerMissing ? null : 'azure-speech',
    assessPronunciation: async (audio, request) => {
      observed.speech.push({ audio, request });
      if (options.quotaRejected) {
        throw new ForbiddenException({
          code: 'QUOTA_EXHAUSTED',
          message: 'Voice quota is exhausted.',
        });
      }
      return provided[resultIndex++];
    },
  };
  const assessment = {
    id: 'assessment-1',
    questions: ['target-sound', 'stress-rhythm', 'spontaneous'].map((name, index) => ({
      id: `question-${index + 1}`,
      prompt: name,
    })),
  };
  const examiner = {
    createAcousticLanguageMasteryAssessment: async (...args) => {
      observed.assessments.push(args);
      return assessment;
    },
    recordAcousticLanguageMasterySubmission: async (...args) => {
      observed.submissions.push(args);
      return { id: 'submission-1' };
    },
    findAcousticLanguageMasterySubmission: async (...args) => {
      observed.recoveries.push(args);
      return options.existingSubmission ?? null;
    },
  };
  const started = options.replay ?? projection();
  let remediationCreated = false;
  const attempts = {
    start: async (...args) => {
      observed.starts.push(args);
      return started;
    },
    appendNotEvaluable: async (_userId, input) => {
      observed.notEvaluable.push(input);
      return projection({
        status: 'evaluated', verdict: 'not-evaluable', decision: input.decision,
        decisionReason: input.decision.reason, criteria: input.criteria,
      });
    },
    bindAssessment: async (...args) => {
      observed.binds.push(args);
      return projection({ status: 'assessment_bound', assessmentId: assessment.id });
    },
    appendOutcome: async (_userId, input) => {
      observed.outcomes.push(input);
      return projection({
        status: 'evaluated', verdict: input.decision.verdict,
        decision: input.decision, criteria: input.criteria,
        assessmentId: assessment.id, assessmentSubmissionId: input.assessmentSubmissionId,
      });
    },
    publishCompletion: async (...args) => {
      observed.completions.push(args);
      return projection({ status: 'evaluated', verdict: 'mastered', completionId: 'completion-1' });
    },
    startRemediationPlan: async (...args) => {
      observed.remediations.push(args);
      remediationCreated = true;
      return { id: 'remediation-1' };
    },
    get: async () => projection({
      status: 'evaluated',
      verdict: 'not-mastered',
      decision: observed.outcomes.at(-1)?.decision ?? null,
      criteria: observed.outcomes.at(-1)?.criteria ?? [],
      assessmentId: assessment.id,
      assessmentSubmissionId: 'submission-1',
      remediation: remediationCreated
        ? {
            planId: 'remediation-1', status: 'preparing', lessonId: null,
            requiredExerciseCount: 10, completedExerciseCount: 0,
            evidenceCount: 0, evidence: [],
          }
        : null,
    }),
  };
  const service = new LanguageAcousticMasteryService(
    prisma, config, featureFlags, speech, examiner, attempts,
  );
  const request = {
    experienceSessionId: 'session-1',
    lessonId: 'lesson-1',
    targetId: milestone.id,
    idempotencyKey: 'acoustic-attempt-1',
    exerciseIndex: 0,
  };
  return { service, request, observed };
}

test('native acoustic bridge records evaluated evidence and publishes only a fully mastered result', async () => {
  const { service, request, observed } = fixture();
  const result = await service.assess(
    'user-1', 'profile-1', request, FILE, FILE, 1.2, 1.4,
  );

  assert.equal(result.outcome, 'evaluated');
  assert.equal(result.decision.verdict, 'mastered');
  assert.equal(result.completionId, 'completion-1');
  assert.equal(observed.speech.length, 2);
  assert.deepEqual(
    observed.speech.map((entry) => entry.request.mode),
    ['scripted-reference', 'spontaneous'],
  );
  assert.deepEqual(
    [...observed.speech[0].request.requiredDimensions].sort(),
    ['accuracy', 'fluency', 'prosody'],
  );
  assert.equal(observed.speech[0].request.referenceText, 'Please introduce yourself and describe your routine.');
  assert.equal(observed.speech[1].request.referenceText, undefined);
  assert.equal(observed.submissions.length, 1);
  assert.equal(observed.outcomes.length, 1);
  assert.equal(observed.completions.length, 1);
  assert.equal(observed.remediations.length, 0);
  const persisted = observed.submissions[0][2];
  assert.match(persisted.evidenceHash, /^[a-f0-9]{64}$/);
  assert.equal(persisted.results.every((item) => item.learnerAnswer === '[audio not retained]'), true);
  assert.equal(JSON.stringify(persisted).includes(AUDIO.toString('base64')), false);
});

test('unverified locale is capability-unavailable before provider or canonical write', async () => {
  const { service, request, observed } = fixture({ localeMissing: true });
  await assert.rejects(
    service.assess('user-1', 'profile-1', request, FILE, FILE),
    (error) => error?.getStatus?.() === 503,
  );

  assert.equal(observed.speech.length, 0);
  assert.equal(observed.starts.length, 0);
  assert.equal(observed.notEvaluable.length, 0);
  assert.equal(observed.assessments.length, 0);
  assert.equal(observed.submissions.length, 0);
  assert.equal(observed.completions.length, 0);
  assert.equal(observed.remediations.length, 0);
});

test('direct endpoint path cannot bypass disabled strict mastery feature flag', async () => {
  const { service, request, observed } = fixture({ featureOff: true });
  await assert.rejects(
    service.assess('user-1', 'profile-1', request, FILE, FILE),
    (error) => error?.getStatus?.() === 503,
  );

  assert.equal(observed.starts.length, 0);
  assert.equal(observed.speech.length, 0);
  assert.equal(observed.notEvaluable.length, 0);
  assert.equal(observed.assessments.length, 0);
  assert.equal(observed.submissions.length, 0);
});

test('arbitrary bytes disguised as audio are rejected before provider or journal write', async () => {
  const { service, request, observed } = fixture();
  await assert.rejects(
    service.assess(
      'user-1',
      'profile-1',
      request,
      { buffer: Buffer.from('not-a-container'), mimetype: 'audio/webm' },
      FILE,
    ),
    (error) => error?.getStatus?.() === 400,
  );

  assert.equal(observed.starts.length, 0);
  assert.equal(observed.speech.length, 0);
  assert.equal(observed.assessments.length, 0);
  assert.equal(observed.submissions.length, 0);
});

test('missing mandatory acoustic dimension remains NOT_EVALUABLE and cannot grant a zero or mastery', async () => {
  const { service, request, observed } = fixture({
    results: [
      acousticResult('scripted-reference', {}, false),
      acousticResult('spontaneous', {}, false),
    ],
  });
  const result = await service.assess('user-1', 'profile-1', request, FILE, FILE);

  assert.equal(observed.speech.length, 2);
  assert.equal(result.decision.verdict, 'not-evaluable');
  assert.equal(result.decision.rawScore, null);
  assert.equal(result.criteria.every((item) => item.score === null && item.met === false), true);
  assert.equal(observed.notEvaluable.length, 1);
  assert.equal(observed.submissions.length, 0);
  assert.equal(observed.completions.length, 0);
  assert.equal(observed.remediations.length, 0);
});

test('quota rejection remains 403 and leaves only a retryable started journal', async () => {
  const { service, request, observed } = fixture({ quotaRejected: true });
  await assert.rejects(
    service.assess('user-1', 'profile-1', request, FILE, FILE),
    (error) => error?.getStatus?.() === 403
      && error.getResponse().code === 'QUOTA_EXHAUSTED',
  );

  assert.equal(observed.starts.length, 1);
  assert.equal(observed.speech.length, 1);
  assert.equal(observed.notEvaluable.length, 0);
  assert.equal(observed.outcomes.length, 0);
  assert.equal(observed.assessments.length, 0);
  assert.equal(observed.submissions.length, 0);
  assert.equal(observed.completions.length, 0);
  assert.equal(observed.remediations.length, 0);
});

test('a mandatory criterion below unrounded 90% fails and starts targeted remediation without completion', async () => {
  const { service, request, observed } = fixture({
    results: [
      acousticResult('scripted-reference', { accuracy: 89.9, fluency: 99, prosody: 99 }),
      acousticResult('spontaneous', { accuracy: 99, fluency: 99, prosody: 99 }),
    ],
  });
  const result = await service.assess('user-1', 'profile-1', request, FILE, FILE);

  assert.equal(result.decision.verdict, 'not-mastered');
  assert.equal(result.criteria.find((item) => item.id === 'target-sound-accuracy').score, 0.899);
  assert.equal(result.criteria.find((item) => item.id === 'target-sound-accuracy').met, false);
  assert.equal(observed.submissions.length, 1);
  assert.equal(observed.completions.length, 0);
  assert.equal(observed.remediations.length, 1);
});

test('an evaluated idempotent replay makes no provider or canonical write call', async () => {
  const replayDecision = {
    policyVersion: shared.LANGUAGE_MASTERY_POLICY_VERSION,
    verdict: 'mastered',
    reason: 'threshold-met',
    trainingComplete: true,
    missingTrainingFormats: [],
    rawScore: 0.95,
    threshold: shared.LANGUAGE_MASTERY_THRESHOLD,
    helpUsed: false,
  };
  const { service, request, observed } = fixture({
    replay: projection({
      status: 'evaluated', verdict: 'mastered', decision: replayDecision,
      criteria: [{ id: 'target-sound-accuracy', score: 0.95, met: true }],
      assessmentSubmissionId: 'submission-1', completionId: 'completion-1',
    }),
  });
  const result = await service.assess('user-1', 'profile-1', request, FILE, FILE);

  assert.equal(result.replayed, true);
  assert.equal(result.decision.verdict, 'mastered');
  assert.equal(observed.speech.length, 0);
  assert.equal(observed.assessments.length, 0);
  assert.equal(observed.submissions.length, 0);
  assert.equal(observed.notEvaluable.length, 0);
});

test('retry repairs completion after a terminal journal write without recalling the provider', async () => {
  const replayDecision = {
    policyVersion: shared.LANGUAGE_MASTERY_POLICY_VERSION,
    verdict: 'mastered',
    reason: 'threshold-met',
    trainingComplete: true,
    missingTrainingFormats: [],
    rawScore: 0.95,
    threshold: shared.LANGUAGE_MASTERY_THRESHOLD,
    helpUsed: false,
  };
  const { service, request, observed } = fixture({
    replay: projection({
      status: 'evaluated', verdict: 'mastered', decision: replayDecision,
      criteria: [{ id: 'target-sound-accuracy', score: 0.95, met: true }],
      assessmentSubmissionId: 'submission-1', completionId: null,
    }),
  });
  const result = await service.assess('user-1', 'profile-1', request, FILE, FILE);

  assert.equal(result.replayed, true);
  assert.equal(result.completionId, 'completion-1');
  assert.equal(observed.completions.length, 1);
  assert.equal(observed.speech.length, 0);
});

test('retry recovers a canonical submission before any second provider call', async () => {
  const evidence = {
    scripted: acousticResult('scripted-reference'),
    spontaneous: acousticResult('spontaneous'),
  };
  const criterionIds = ['target-sound-accuracy', 'word-stress-rhythm', 'spontaneous-intelligibility'];
  const existingSubmission = {
    id: 'submission-1',
    assessmentId: 'assessment-1',
    score: 95,
    summary: 'Persisted result',
    advice: 'Continue',
    createdAt: '2026-10-12T11:01:00.000Z',
    results: criterionIds.map((id, index) => ({
      questionId: `question-${index + 1}`,
      prompt: id,
      learnerAnswer: '[audio not retained]',
      awarded: 0.95,
      max: 1,
      verdict: 'correct',
      why: 'Measured',
      how: 'Continue',
      errorMade: null,
      howToAvoid: null,
      acousticEvidence: evidence,
    })),
  };
  const { service, request, observed } = fixture({
    replay: projection({ status: 'assessment_bound', assessmentId: 'assessment-1' }),
    existingSubmission,
  });
  const result = await service.assess('user-1', 'profile-1', request, FILE, FILE);

  assert.equal(result.replayed, true);
  assert.equal(result.decision.verdict, 'mastered');
  assert.equal(result.completionId, 'completion-1');
  assert.equal(observed.recoveries.length, 1);
  assert.equal(observed.speech.length, 0);
  assert.equal(observed.submissions.length, 0);
  assert.equal(observed.outcomes.length, 1);
});

test('public speech capability matrix does not claim an allowlisted language without an exact provider locale', () => {
  const controller = new SpeechController(
    {
      activeProvider: 'openai',
      supportsSynthesis: true,
      supportsAnalysis: true,
      supportsPronunciationAssessment: true,
      activePronunciationAssessmentProvider: 'azure-speech',
    },
    {
      get: (key) => key === 'features'
        ? { languageMasteryV1: true }
        : {
            transcriptionLanguageCodes: ['en', 'fr'],
            synthesisLanguageCodes: ['en', 'fr'],
            pronunciationAssessmentLanguageCodes: ['en', 'fr'],
            pronunciationAssessmentLocales: { en: 'en-US' },
          },
    },
  );
  const capabilities = controller.capabilities();
  assert.deepEqual(capabilities.languageMasteryV1.pronunciationAssessmentLanguageCodes, ['en']);
});

test('Examiner canonical acoustic records are owner-scoped, idempotent and contain no raw recording', async () => {
  let assessment = null;
  let submission = null;
  let assessmentCreates = 0;
  let submissionCreates = 0;
  const prisma = {
    $executeRaw: async () => 0,
    assessment: {
      findFirst: async ({ where }) => assessment
        && assessment.userId === where.userId
        && assessment.masteryCreationKey === where.masteryCreationKey
        ? assessment
        : null,
      findUnique: async ({ where }) => where.id === assessment?.id ? assessment : null,
      create: async ({ data }) => {
        assessmentCreates += 1;
        assessment = {
          id: 'assessment-canonical-1',
          conceptId: null,
          createdAt: new Date('2026-10-12T11:00:00.000Z'),
          ...data,
        };
        return assessment;
      },
    },
    assessmentSubmission: {
      findFirst: async ({ where }) => submission
        && submission.userId === where.userId
        && submission.masterySubmissionKey === where.masterySubmissionKey
        ? submission
        : null,
      create: async ({ data }) => {
        submissionCreates += 1;
        submission = {
          id: 'submission-canonical-1',
          createdAt: new Date('2026-10-12T11:01:00.000Z'),
          ...data,
        };
        return submission;
      },
    },
  };
  prisma.$transaction = (callback) => callback(prisma);
  const examiner = new ExaminerService(prisma, {});
  const creation = {
    attemptId: 'attempt-canonical-1',
    profileId: 'profile-1',
    courseSessionId: 'session-1',
    unitId: 'a2-routines',
    lessonId: 'lesson-1',
    contentVersion: 7,
    policyVersion: shared.LANGUAGE_MASTERY_POLICY_VERSION,
    criterionIds: ['target-sound-accuracy', 'word-stress-rhythm', 'spontaneous-intelligibility'],
    topic: 'Everyday routines — native pronunciation',
    difficulty: 'beginner',
  };
  const first = await examiner.createAcousticLanguageMasteryAssessment('user-1', creation);
  const replay = await examiner.createAcousticLanguageMasteryAssessment('user-1', creation);
  assert.equal(first.id, replay.id);
  assert.equal(assessmentCreates, 1);

  const results = first.questions.map((question) => ({
    questionId: question.id,
    prompt: question.prompt,
    learnerAnswer: '[audio not retained]',
    awarded: 0.95,
    max: 1,
    verdict: 'correct',
    why: 'Normalized acoustic evidence meets the criterion.',
    how: 'Continue varied practice.',
    errorMade: null,
    howToAvoid: null,
    acousticEvidence: {
      scripted: acousticResult('scripted-reference'),
      spontaneous: acousticResult('spontaneous'),
    },
  }));
  const payload = {
    attemptId: 'attempt-canonical-1',
    evidenceHash: 'b'.repeat(64),
    results,
    summary: 'Every versioned acoustic criterion is satisfied.',
    advice: 'Continue varied spontaneous speaking practice.',
  };
  const firstSubmission = await examiner.recordAcousticLanguageMasterySubmission(
    'user-1', first.id, payload,
  );
  const replaySubmission = await examiner.recordAcousticLanguageMasterySubmission(
    'user-1', first.id, payload,
  );
  assert.equal(firstSubmission.id, replaySubmission.id);
  assert.equal(submissionCreates, 1);
  const recoveredSubmission = await examiner.findAcousticLanguageMasterySubmission(
    'user-1', 'attempt-canonical-1',
  );
  assert.equal(recoveredSubmission.id, firstSubmission.id);
  assert.deepEqual(submission.answers, [
    '[audio-native-evidence]',
    '[audio-native-evidence]',
    '[audio-native-evidence]',
  ]);
  const persistedJson = JSON.stringify({ assessment, submission });
  assert.equal(persistedJson.includes(AUDIO.toString('base64')), false);
  assert.equal(persistedJson.includes('Please introduce yourself'), false);
});
