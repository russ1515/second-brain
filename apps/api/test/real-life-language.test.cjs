'use strict';

require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { RealLifeLanguageService } = require('../dist/languages/real-life-language.service.js');

const root = path.resolve(__dirname, '../../..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const shared = require(path.join(root, 'packages/shared/dist/index.js'));

const profile = {
  id: 'language-1', userId: 'user-1', language: 'English', normalizedLanguage: 'en',
  nativeLanguage: 'French', mode: 'intermediate', cefrLevel: 'B1',
  goal: 'Work internationally', vocabDeckId: 'deck-1',
  createdAt: new Date('2026-09-14T08:00:00.000Z'),
  updatedAt: new Date('2026-09-14T08:00:00.000Z'),
};

function harness(options = {}) {
  const sessions = new Map();
  const attempts = [];
  const finalizedUnits = [];
  const masteryJournal = [];
  const lessonGenerations = [];
  const assessmentCreations = [];
  const assessments = new Map();
  const masteryAttempts = new Map();
  const remediationPlans = new Map();
  const remediationEvidence = new Map();
  const generatedLessons = new Map();
  let nextId = 1;
  let submissionCount = 0;
  let conversationStarts = 0;
  let failedAutonomyActivePersist = false;
  const toSession = (request, id = `experience-${nextId++}`) => ({
    id, userId: 'user-1', version: 1, type: request.type ?? 'language',
    status: 'active', title: request.title ?? null, intent: request.intent ?? null,
    inputModality: request.inputModality ?? null,
    activeContexts: { ownerId: 'user-1', items: request.activeContexts ?? [] },
    currentStep: request.currentStep ?? null, progress: request.progress ?? null,
    productions: request.productions ?? [], sourceReferences: request.sourceReferences ?? [],
    twinImpact: request.twinImpact ?? null, resumeTarget: request.resumeTarget ?? null,
    nextBestAction: request.nextBestAction ?? null,
    links: {
      tutorSessionId: request.links?.tutorSessionId ?? null,
      studySessionId: null, documentId: null, lessonId: request.links?.lessonId ?? null,
      goalId: null, languageProfileId: request.links?.languageProfileId ?? null,
      workspaceRef: null,
    },
    startedAt: '2026-09-14T08:00:00.000Z', updatedAt: '2026-09-14T08:00:00.000Z',
    pausedAt: null, completedAt: null,
  });
  const experiences = {
    create: async (_userId, request) => {
      const session = toSession(request);
      sessions.set(session.id, session);
      return session;
    },
    get: async (userId, id) => {
      const session = sessions.get(id);
      if (!session || session.userId !== userId) throw new Error('not found');
      return session;
    },
    updateState: async (userId, id, update) => {
      const previous = await experiences.get(userId, id);
      if (
        options.failAutonomyActivePersistOnce
        && !failedAutonomyActivePersist
        && JSON.stringify(update).includes('autonomy-active')
      ) {
        failedAutonomyActivePersist = true;
        throw new Error('autonomy active persist interrupted');
      }
      const next = { ...previous, ...update, version: previous.version + 1, updatedAt: '2026-09-14T08:05:00.000Z' };
      sessions.set(id, next);
      return next;
    },
    resume: async (userId, id) => {
      const previous = await experiences.get(userId, id);
      const next = { ...previous, status: 'active', pausedAt: null };
      sessions.set(id, next);
      return next;
    },
    complete: async (userId, id) => {
      const previous = await experiences.get(userId, id);
      const next = { ...previous, status: 'completed', completedAt: '2026-09-14T09:00:00.000Z' };
      sessions.set(id, next);
      return next;
    },
  };
  const prisma = {
    experienceSession: {
      findFirst: async ({ where }) => {
        const match = [...sessions.values()].find((item) =>
          item.userId === where.userId &&
          item.links.languageProfileId === where.languageProfileId &&
          item.intent === where.intent &&
          (typeof where.status === 'string'
            ? item.status === where.status
            : where.status?.in?.includes(item.status)),
        );
        return match ? { id: match.id } : null;
      },
    },
    card: { count: async () => 0 },
    exerciseAttempt: {
      findFirst: async ({ where }) => attempts.find((attempt) =>
        attempt.id === where.id
        && attempt.userId === where.userId
        && attempt.lessonId === where.lessonId
        && attempt.exerciseIndex === where.exerciseIndex) ?? null,
      findMany: async ({ where }) => attempts
        .filter((attempt) => attempt.userId === where.userId && attempt.lessonId === where.lessonId
          && (where.contentVersion === undefined || attempt.contentVersion === where.contentVersion))
        .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime()),
    },
    lesson: {
      findFirst: async ({ where }) => {
        if (where.id === 'lesson-1' && where.userId === 'user-1') {
          return { id: 'lesson-1', userId: 'user-1', contentVersion: 1, exercises: lessonExercises };
        }
        const generated = generatedLessons.get(where.id);
        return generated && where.userId === 'user-1'
          ? { ...generated, userId: 'user-1', contentVersion: 1 }
          : null;
      },
    },
  };
  const languages = {
    requireOwned: async (userId, id) => {
      if (userId !== profile.userId || id !== profile.id) throw new Error('not found');
      return profile;
    },
    promptRoles: async () => ({
      interfaceLanguage: 'fr', supportLanguage: 'fr', targetLanguage: 'English',
    }),
    ensureVocabDeck: async () => 'deck-1',
  };
  const lessonExercises = shared.LANGUAGE_TRAINING_FORMATS.map((languageFormat, index) => ({
    type: ['recognition-mcq', 'contextual-discrimination', 'register-matching'].includes(languageFormat)
      ? 'qcm'
      : 'open',
    question: `Training ${index + 1}`,
    answer: `Answer ${index + 1}`,
    options: ['recognition-mcq', 'contextual-discrimination', 'register-matching'].includes(languageFormat)
      ? [`Answer ${index + 1}`, 'Distractor']
      : undefined,
    languageFormat,
    ...(languageFormat === 'sentence-reconstruction' ? { tokens: ['I', 'am', 'ready'] } : {}),
    ...(languageFormat === 'listening-discrimination' || languageFormat === 'voice-pronunciation'
      ? { audioText: `Audio ${index + 1}` }
      : {}),
    ...(languageFormat === 'mini-dialogue' ? { dialogueTurns: ['Hello', 'Hi'] } : {}),
  }));
  const lessons = {
    generate: async (...args) => {
      lessonGenerations.push(args);
      const internal = args[2] ?? {};
      const isRemediation = Boolean(internal.masteryRemediationGenerationKey);
      const generated = {
        id: isRemediation ? 'lesson-remediation-1' : 'lesson-1',
        languageProfileId: profile.id,
        topic: isRemediation ? 'Targeted remediation' : 'First contact',
        objective: isRemediation
          ? 'Strengthen only the failed notion.'
          : 'Introduce yourself in a real exchange.',
        sourceDocumentId: null,
        exercises: isRemediation
          ? lessonExercises.map((exercise) => ({
              ...exercise,
              notionIds: internal.languageNotions.map((item) => item.notionId),
              criterionIds: internal.languageNotions.map((item) => item.criterionId),
            }))
          : lessonExercises,
      };
      generatedLessons.set(generated.id, generated);
      return generated;
    },
    get: async (_userId, lessonId) => generatedLessons.get(lessonId) ?? ({
      id: 'lesson-1', languageProfileId: profile.id, topic: 'First contact',
      objective: 'Introduce yourself in a real exchange.', sourceDocumentId: null,
      exercises: lessonExercises,
    }),
  };
  const conversations = {
    start: async (_userId, profileId) => {
      conversationStarts += 1;
      const tutorSessionId = `tutor-${conversationStarts}`;
      const experienceSession = toSession({
        type: 'language', intent: 'practice-language',
        links: { tutorSessionId, languageProfileId: profileId },
        currentStep: { id: 'conversation', state: 'active', metadata: {} },
        resumeTarget: { kind: 'route', path: `/tutor/${tutorSessionId}` },
      });
      sessions.set(experienceSession.id, experienceSession);
      return { id: tutorSessionId, experienceSession };
    },
  };
  const submitAssessment = async (_userId, id, answers) => {
    const item = assessments.get(id);
    const submissionIndex = submissionCount++;
    const awarded = options.scopedAwardedPointsSequence?.[submissionIndex]
      ?? options.scopedAwardedPoints
      ?? 9;
    const maximum = options.scopedMaximumPointsSequence?.[submissionIndex]
      ?? options.scopedMaximumPoints
      ?? 10;
    const submission = {
      id: `submission-${submissionIndex + 1}`, assessmentId: id,
      score: options.scopedSubmissionScoreSequence?.[submissionIndex]
        ?? options.scopedSubmissionScore
        ?? 90,
      results: item.view.questions.map((question, index) => ({
        questionId: question.id, prompt: question.prompt, learnerAnswer: answers[index],
        awarded, max: maximum, verdict: 'partial', why: 'Observed production.', how: 'Keep practising.',
        errorMade: 'Minor detail.', howToAvoid: 'Review it.',
      })),
      summary: 'Autonomous production reached the threshold.', advice: 'Continue.',
      createdAt: '2026-09-14T08:40:00.000Z',
    };
    item.view = { ...item.view, latestSubmission: submission };
    return submission;
  };
  const service = new RealLifeLanguageService(
    prisma, languages, lessons,
    conversations,
    { sendMessage: async () => { throw new Error('unused'); } },
    { extract: async () => ({ cards: [] }) },
    experiences,
    { generate: async () => ({ text: '{}' }) },
    {
      finalizeLanguageUnit: async (_userId, input) => {
        finalizedUnits.push(input);
        if (options.rejectFinalizer) throw new Error('late-help-finalizer-rejected');
        return { id: 'completion-1' };
      },
    },
    {
      create: async (_userId, _dto, internal) => {
        assessmentCreations.push(internal);
        const assessment = {
          id: `assessment-${assessmentCreations.length}`, type: 'open', topic: 'Autonomy', title: 'Autonomy',
          level: 'beginner',
          questions: [1, 2, 3].map((index) => ({
            id: `question-${index}`, prompt: `Produce answer ${index}.`, format: 'open', points: 10,
          })),
          teacherPolicy: null, createdAt: '2026-09-14T08:30:00.000Z', latestSubmission: null,
        };
        assessments.set(assessment.id, {
          view: assessment,
          metadata: {
            ...internal.languageMastery,
            helpUsed: false,
            answerLeak: false,
            sealedAt: null,
            createdAt: '2026-09-14T08:30:00.000Z',
          },
        });
        return assessment;
      },
      get: async (_userId, id) => assessments.get(id).view,
      languageMasteryMetadata: async (_userId, id) => assessments.get(id).metadata,
      sealLanguageMasterySubmission: async (_userId, id) => {
        const item = assessments.get(id);
        item.metadata = { ...item.metadata, sealedAt: '2026-09-14T08:40:01.000Z' };
        return item.metadata;
      },
      markLanguageMasteryHelpUsed: async (_userId, id) => {
        const item = assessments.get(id);
        item.metadata = { ...item.metadata, helpUsed: true };
        return item.metadata;
      },
      submit: submitAssessment,
      submitLanguageMasteryOnce: async (userId, id, _attemptId, answers) =>
        submitAssessment(userId, id, answers),
    },
    {
      coachSpeaking: async () => ({
        transcript: 'Hello', summary: 'Understandable spoken attempt.',
        dimensions: [], why: 'The message was understood.', howToImprove: 'Keep practising.', exercises: [],
      }),
    },
    { enabled: () => options.featureFlag !== false },
    {
      get: () => ({
        transcriptionLanguageCodes: ['en'],
        synthesisLanguageCodes: ['en'],
        pronunciationAssessmentLanguageCodes: ['en'],
      }),
    },
    { supportsSynthesis: true, supportsAnalysis: true },
    {
      projection: async () => {
        const external = options.masteryProjection?.() ?? [];
        if (!options.useMasteryJournalProjection) return external;
        const journal = [...masteryAttempts.values()].map((entry) => {
          const plan = remediationPlans.get(entry.attemptId) ?? null;
          const evidence = plan ? (remediationEvidence.get(plan.id) ?? []) : [];
          return {
            id: entry.attemptId,
            ...entry,
            completionId: entry.completionId ?? null,
            threshold: shared.LANGUAGE_MASTERY_THRESHOLD,
            evaluatedAt: entry.evaluatedAt ?? null,
            remediation: plan ? {
              planId: plan.id,
              generationKey: plan.generationKey,
              lessonId: plan.lessonId ?? null,
              requiredExerciseCount: 10,
              completedExerciseCount: evidence.length,
              evidenceCount: evidence.length,
              status: evidence.length >= 10 ? 'ready_for_retest' : plan.lessonId ? 'active' : 'preparing',
              evidence,
            } : null,
          };
        });
        return [...external, ...journal];
      },
      reconcileRemediationExerciseAttempts: async (_userId, attemptId) => {
        if (!options.useMasteryJournalProjection) return null;
        const plan = remediationPlans.get(attemptId);
        const evidence = plan ? (remediationEvidence.get(plan.id) ?? []) : [];
        return {
          ...masteryAttempts.get(attemptId),
          remediation: plan ? {
            planId: plan.id,
            evidenceCount: evidence.length,
            completedExerciseCount: evidence.length,
            requiredExerciseCount: 10,
          } : null,
        };
      },
      start: async (_userId, input) => {
        const attemptId = `journal:${input.idempotencyKey}`;
        const existing = masteryAttempts.get(attemptId);
        if (existing) return existing;
        const entry = {
          attemptId,
          assessmentId: null,
          status: 'started',
          verdict: null,
          helpUsed: false,
          startedAt: '2026-09-14T08:30:00.000Z',
          ...input,
        };
        masteryAttempts.set(attemptId, entry);
        masteryJournal.push({ event: 'start', ...entry });
        return entry;
      },
      get: async (_userId, attemptId) => {
        const entry = masteryAttempts.get(attemptId);
        if (!entry) throw new Error('journal attempt not found');
        return entry;
      },
      bindAssessment: async (_userId, attemptId, assessmentId) => {
        const entry = masteryAttempts.get(attemptId);
        masteryAttempts.set(attemptId, { ...entry, assessmentId, status: 'assessment_bound' });
        masteryJournal.push({ event: 'bind', attemptId, assessmentId });
        return { attemptId, assessmentId, status: 'assessment_bound' };
      },
      appendOutcome: async (_userId, input) => {
        const entry = masteryAttempts.get(input.attemptId);
        masteryAttempts.set(input.attemptId, {
          ...entry,
          status: 'evaluated',
          verdict: input.decision.verdict,
          rawScore: input.decision.rawScore,
          decision: input.decision,
          criteria: input.criteria,
          assessmentSubmissionId: input.assessmentSubmissionId,
          evaluatedAt: '2026-09-14T08:40:00.000Z',
        });
        masteryJournal.push({ event: 'outcome', ...input });
        return {
          ...entry,
          ...input,
          completionId: null,
          status: 'evaluated',
          verdict: input.decision.verdict,
          evaluatedAt: '2026-09-14T08:40:00.000Z',
        };
      },
      publishCompletion: async (_userId, attemptId) => {
        const entry = masteryAttempts.get(attemptId);
        const published = {
          ...entry,
          completionId: entry.completionId ?? `completion:${attemptId}`,
        };
        masteryAttempts.set(attemptId, published);
        masteryJournal.push({ event: 'publish', attemptId, completionId: published.completionId });
        return published;
      },
      appendNotEvaluable: async (_userId, input) => {
        const entry = masteryAttempts.get(input.attemptId);
        masteryAttempts.set(input.attemptId, {
          ...entry,
          status: 'evaluated',
          verdict: 'not-evaluable',
        });
        masteryJournal.push({ event: 'not-evaluable', ...input });
        return { ...input, status: 'evaluated' };
      },
      startRemediationPlan: async (_userId, input) => {
        const existing = remediationPlans.get(input.failedAttemptId);
        if (existing) return existing;
        const plan = {
          id: `plan:${input.failedAttemptId}`,
          failedAttemptId: input.failedAttemptId,
          generationKey: `generation:${input.failedAttemptId}`,
          requiredExerciseCount: 10,
          completedExerciseCount: 0,
          status: 'preparing',
        };
        remediationPlans.set(input.failedAttemptId, plan);
        remediationEvidence.set(plan.id, []);
        return plan;
      },
      bindRemediationLesson: async (_userId, input) => {
        const plan = [...remediationPlans.values()].find((item) => item.id === input.remediationPlanId);
        plan.lessonId = input.lessonId;
        return { ...plan, remediationLessonId: input.lessonId, status: 'active' };
      },
      appendRemediationEvidence: async (_userId, input) => {
        const plan = [...remediationPlans.values()].find((item) => item.id === input.remediationPlanId);
        const evidence = remediationEvidence.get(plan.id);
        if (!evidence.some((item) => item.evidenceId === input.evidenceId)) evidence.push(input);
        return {
          ...masteryAttempts.get(input.attemptId),
          remediation: {
            planId: plan.id,
            generationKey: plan.generationKey,
            lessonId: plan.lessonId,
            requiredExerciseCount: 10,
            completedExerciseCount: evidence.length,
            evidenceCount: evidence.length,
            status: evidence.length >= 10 ? 'ready_for_retest' : 'active',
            evidence,
          },
        };
      },
    },
  );
  if (!options.useRealActivationGate) {
    service.strictMasteryAvailable = () => options.strictMastery !== false;
  }
  return {
    service, sessions, experiences, attempts, finalizedUnits, lessonExercises, masteryJournal,
    lessonGenerations, assessmentCreations, remediationPlans, remediationEvidence,
    conversationStarts: () => conversationStarts,
  };
}

function masteredMilestoneProjection(milestones) {
  return milestones.map((milestone, index) => ({
    id: `row-${index}`,
    attemptId: `attempt-${index}`,
    idempotencyKey: `key-${index}`,
    scopeKind: 'milestone',
    scopeKey: shared.rlleMilestoneEvidenceScopeKey({ languageCode: 'en', milestone }),
    targetId: milestone.id,
    mappingVersion: shared.RLLE_LANGUAGE_MASTERY_MAPPING_VERSION,
    policyVersion: shared.LANGUAGE_MASTERY_POLICY_VERSION,
    masteryContentVersion: milestone.contentVersion,
    contentDefinitionId: milestone.contentDefinitionId,
    sourceContentVersion: 1,
    lessonId: 'lesson-1',
    languageCode: 'en',
    cefrLevel: milestone.level,
    pillar: milestone.pillar,
    status: 'evaluated',
    verdict: 'mastered',
    rawScore: 0.9,
    threshold: 0.9,
    decisionReason: 'threshold-met',
    helpUsed: false,
    decision: {
      policyVersion: shared.LANGUAGE_MASTERY_POLICY_VERSION,
      verdict: 'mastered',
      reason: 'threshold-met',
      trainingComplete: true,
      missingTrainingFormats: [],
      rawScore: 0.9,
      threshold: 0.9,
      helpUsed: false,
    },
    criteria: [{ id: milestone.criterionId, met: true, score: 0.9 }],
    assessmentId: `assessment-${index}`,
    assessmentSubmissionId: `submission-${index}`,
    completionId: `completion-${index}`,
    remediation: null,
    startedAt: '2026-09-14T08:30:00.000Z',
    evaluatedAt: '2026-09-14T08:40:00.000Z',
  }));
}

test('course from zero keeps the complete A1→B1 spine and distinguishes declared/evaluated levels', async () => {
  const { service, lessonGenerations } = harness();
  const result = await service.startCourse('user-1', 'language-1', {
    startFrom: 'zero', targetLevel: 'B1', goalDomain: 'work',
  });
  assert.equal(result.course.level.declared, 'B1');
  assert.equal(result.course.level.estimated, null);
  assert.equal(result.course.level.evaluated, null);
  assert.equal(result.course.level.target, 'B1');
  assert.deepEqual([...new Set(result.course.units.map((unit) => unit.level))], ['A1', 'A2', 'B1']);
  assert.ok(result.course.units.some((unit) => unit.priority === 'goal'));
  assert.equal(result.course.progress.completedUnits, 0);
  assert.equal(result.course.canDoMap.every((item) => item.status === 'not-evaluated'), true);
  assert.equal(result.session.currentStep.metadata.rlleCourse.immersionIntensity, 'guided');
  assert.equal(result.course.currentLesson.lessonId, 'lesson-1');
  assert.equal(lessonGenerations.length, 1);
  const mapped = shared.RLLE_LANGUAGE_MASTERY_UNIT_MAP
    .find((item) => item.unitId === 'a1-first-contact').milestones;
  assert.deepEqual(
    new Set(lessonGenerations[0][2].languageNotions.map((item) => item.notionId)),
    new Set(mapped.map((item) => item.id)),
  );
  const retried = await service.startCourse('user-1', 'language-1', {
    startFrom: 'zero', targetLevel: 'B1', goalDomain: 'work',
  });
  assert.equal(retried.course.currentLesson.lessonId, result.course.currentLesson.lessonId);
  assert.equal(lessonGenerations.length, 1);
  assert.ok(result.course.masteryBulletins.length >= 1);
});

test('course creation infers its domain from the explicit learner objective', async () => {
  const { service } = harness();
  const result = await service.startCourse('user-1', 'language-1', {
    startFrom: 'zero', targetLevel: 'A1', goal: 'Préparer un entretien professionnel',
  });
  assert.equal(result.course.goal, 'Préparer un entretien professionnel');
  assert.equal(result.course.goalDomain, 'work');
});

test('canonical unit mastery closes the active lesson and opens the next unit', async () => {
  let projection = [];
  const { service } = harness({ masteryProjection: () => projection });
  await service.startCourse('user-1', 'language-1', {
    startFrom: 'zero', targetLevel: 'A1', goalDomain: 'general',
  });
  const firstMapping = shared.RLLE_LANGUAGE_MASTERY_UNIT_MAP
    .find((item) => item.unitId === 'a1-first-contact');
  projection = masteredMilestoneProjection(firstMapping.milestones);
  const reconciled = await service.course('user-1', 'language-1');
  assert.equal(reconciled.currentLesson.status, 'completed');
  assert.equal(reconciled.units.find((unit) => unit.id === 'a1-first-contact').status, 'completed');
  assert.equal(reconciled.units.find((unit) => unit.id === 'a1-daily-needs').status, 'in-progress');
  const next = await service.startLesson('user-1', 'language-1', { unitId: 'a1-daily-needs' });
  assert.equal(next.course.currentLesson.unitId, 'a1-daily-needs');
});

test('the raw 90 percent notion gate advances to the next level without strict certification', async () => {
  let projection = [];
  const { service } = harness({
    masteryProjection: () => projection,
    strictMastery: false,
  });
  await service.startCourse('user-1', 'language-1', {
    startFrom: 'zero', targetLevel: 'A2', goalDomain: 'general',
  });
  const a1 = shared.RLLE_LANGUAGE_MASTERY_UNIT_MAP
    .filter((item) => item.level === 'A1')
    .flatMap((item) => item.milestones);
  projection = masteredMilestoneProjection(a1.slice(0, Math.ceil(a1.length * 0.9)));
  const reconciled = await service.course('user-1', 'language-1');
  const bulletin = reconciled.masteryBulletins.find((item) => item.level === 'A1');
  assert.ok(bulletin.rawMasteryRatio >= 0.9);
  assert.equal(bulletin.notionGateUnlocked, true);
  assert.equal(reconciled.units.filter((unit) => unit.level === 'A1').every((unit) => unit.status === 'completed'), true);
  assert.equal(reconciled.nextMasteryTarget.scopeKind, 'milestone');
  const target = shared.RLLE_LANGUAGE_MASTERY_UNIT_MAP
    .flatMap((item) => item.milestones)
    .find((item) => item.id === reconciled.nextMasteryTarget.targetId);
  assert.equal(target.level, 'A2');
});

test('authored mastery supplements are injected into the existing unit generation contract', async () => {
  const { service, lessonGenerations } = harness();
  await service.startCourse('user-1', 'language-1', {
    startFrom: 'zero', targetLevel: 'A1', goalDomain: 'general',
  });
  await service.startLesson('user-1', 'language-1', { unitId: 'a1-first-contact' });
  const directive = lessonGenerations[0][2].directive;
  assert.match(directive, /a1-graphy-writing-foundations/);
  assert.match(directive, new RegExp(shared.RLLE_LANGUAGE_MASTERY_CONTENT_VERSION));
  for (const format of shared.LANGUAGE_TRAINING_FORMATS) assert.match(directive, new RegExp(format));
  assert.match(directive, /legible-target-graphemes/);
  assert.match(directive, /independent-basic-writing/);
});

test('an advanced course starts at the declared level and never silently replays A1', async () => {
  const { service } = harness();
  const result = await service.startCourse('user-1', 'language-1', {
    startFrom: 'declared-level', targetLevel: 'C1', goalDomain: 'work',
  });
  assert.deepEqual([...new Set(result.course.units.map((unit) => unit.level))], ['B1', 'B2', 'C1']);
  assert.equal(result.course.units.some((unit) => unit.level === 'A1'), false);
});

test('course access remains strictly scoped to the owning language profile', async () => {
  const { service } = harness();
  await assert.rejects(
    () => service.startCourse('another-user', 'language-1', {
      startFrom: 'zero', targetLevel: 'A1', goalDomain: 'general',
    }),
    /not found/i,
  );
  await assert.rejects(
    () => service.course('user-1', 'another-language-profile'),
    /not found/i,
  );
});

test('World Missions stay visibly locked until the structured course is started', async () => {
  const { service } = harness();
  const catalog = await service.missions('user-1', 'language-1');
  assert.equal(catalog.items.every((mission) => mission.available === false), true);
});

test('course preferences remain user-controlled without replacing course progress', async () => {
  const { service } = harness();
  await service.startCourse('user-1', 'language-1', {
    startFrom: 'declared-level', targetLevel: 'B2', goalDomain: 'work',
  });
  const course = await service.updatePreferences('user-1', 'language-1', {
    immersionIntensity: 'full', correctionIntensity: 'detailed',
  });
  assert.equal(course.immersionIntensity, 'full');
  assert.equal(course.correctionIntensity, 'detailed');
  assert.equal(course.progress.completedUnits, 0);
  assert.equal(course.level.target, 'B2');
});

test('a paused World Mission resumes the same Tutor context and keeps its repair continuity', async () => {
  const { service, sessions, conversationStarts } = harness();
  await service.startCourse('user-1', 'language-1', {
    startFrom: 'declared-level', targetLevel: 'B1', goalDomain: 'general',
  });
  const started = await service.startMission('user-1', 'language-1', 'social-story', {
    missionId: 'social-story', inputModality: 'mixed',
  });
  const duringMission = await service.missions('user-1', 'language-1');
  assert.equal(duringMission.items.find((item) => item.id === 'social-story').available, true);
  assert.equal(duringMission.items.filter((item) => item.id !== 'social-story').every((item) => item.available === false), true);
  await assert.rejects(
    () => service.startMission('user-1', 'language-1', 'work-meeting', {
      missionId: 'work-meeting', inputModality: 'mixed',
    }),
    /current World Mission/i,
  );
  sessions.set(started.session.id, { ...started.session, status: 'paused', pausedAt: '2026-09-14T08:10:00.000Z' });
  const projected = await service.course('user-1', 'language-1');
  assert.equal(projected.currentMission.status, 'paused');
  const resumed = await service.startMission('user-1', 'language-1', 'social-story', {
    missionId: 'social-story', inputModality: 'mixed',
  });
  assert.equal(resumed.session.id, started.session.id);
  assert.equal(resumed.session.status, 'active');
  assert.equal(conversationStarts(), 1);
});

test('unit autonomy is journaled without cloning aggregate evidence into strict mastery', async () => {
  const { service, attempts, finalizedUnits, lessonExercises, masteryJournal } = harness();
  await service.startCourse('user-1', 'language-1', {
    startFrom: 'zero', targetLevel: 'A1', goalDomain: 'general',
  });
  const started = await service.startLesson('user-1', 'language-1', { unitId: 'a1-first-contact' });
  const outline = started.course.currentLesson;
  assert.ok(outline);
  await assert.rejects(
    () => service.advanceLesson('user-1', 'language-1', started.session.id, outline.lessonId, 'oral'),
    /completed in order/i,
  );
  let course = started.course;
  assert.ok(outline.stages.some((stage) => stage.status === 'skipped'));
  const stages = outline.stages.filter((item) => item.status !== 'skipped');
  for (const stage of stages.slice(0, stages.findIndex((item) => item.kind === 'verification'))) {
    course = await service.advanceLesson('user-1', 'language-1', started.session.id, outline.lessonId, stage.kind);
  }
  await assert.rejects(
    () => service.advanceLesson('user-1', 'language-1', started.session.id, outline.lessonId, 'verification'),
    /required training format/i,
  );
  for (let index = 0; index < lessonExercises.length; index += 1) {
    if (lessonExercises[index].languageFormat === 'voice-pronunciation') continue;
    attempts.push({
      id: `attempt-${index}`, userId: 'user-1', lessonId: outline.lessonId,
      contentVersion: 1,
      exerciseIndex: index, correct: true, score: 1,
      feedback: `Evaluated answer ${index + 1}.`, correction: 'Correct.',
      createdAt: new Date(`2026-09-14T08:1${index}:00.000Z`),
    });
  }
  await service.recordVoiceTraining(
    'user-1',
    'language-1',
    { experienceSessionId: started.session.id, lessonId: outline.lessonId, exerciseIndex: 8 },
    { buffer: Buffer.from('technical-audio'), mimetype: 'audio/webm', originalname: 'training.webm', size: 15 },
    2,
  );
  const verificationIndex = stages.findIndex((item) => item.kind === 'verification');
  for (const stage of stages.slice(verificationIndex)) {
    course = await service.advanceLesson('user-1', 'language-1', started.session.id, outline.lessonId, stage.kind);
  }
  assert.equal(course.progress.completedUnits, 0);
  assert.equal(course.currentLesson.status, 'active');
  assert.equal(course.milestoneMastery.find((item) => item.unitId === outline.unitId).status, 'autonomy-ready');
  assert.equal(finalizedUnits.length, 0);

  const autonomy = await service.startAutonomy('user-1', 'language-1', {
    experienceSessionId: started.session.id,
    lessonId: outline.lessonId,
    idempotencyKey: 'autonomy-attempt-0001',
  });
  assert.equal(autonomy.assessment.questions.every((question) => question.format === 'open'), true);
  const evaluated = await service.submitAutonomy('user-1', 'language-1', {
    experienceSessionId: started.session.id,
    lessonId: outline.lessonId,
    assessmentId: autonomy.assessment.id,
    answers: ['One', 'Two', 'Three'],
  });
  course = evaluated.course;
  assert.equal(evaluated.decision.verdict, 'mastered');
  assert.equal(evaluated.decision.rawScore, 0.9);
  assert.equal(course.progress.completedUnits, 0);
  const unitCanDoIds = new Set(shared.RLLE_CURRICULUM.find((item) => item.id === outline.unitId).canDoIds);
  assert.equal(course.canDoMap.filter((item) => unitCanDoIds.has(item.id)).every((item) => item.status !== 'validated'), true);
  assert.equal(finalizedUnits.length, 0);
  assert.equal(masteryJournal.find((entry) => entry.event === 'start').scopeKind, 'unit_autonomy');
  assert.deepEqual(
    masteryJournal.find((entry) => entry.event === 'outcome').criteria,
    [{ id: 'unit-autonomy-aggregate-non-credit', met: true, score: 0.9 }],
  );
});

test('autonomy start reconciles a bound journal after the course-state write is interrupted', async () => {
  const runtime = harness({ failAutonomyActivePersistOnce: true });
  const {
    service, attempts, lessonExercises, masteryJournal, assessmentCreations,
  } = runtime;
  await service.startCourse('user-1', 'language-1', {
    startFrom: 'zero', targetLevel: 'A1', goalDomain: 'general',
  });
  const started = await service.startLesson('user-1', 'language-1', { unitId: 'a1-first-contact' });
  const outline = started.course.currentLesson;
  const stages = outline.stages.filter((item) => item.status !== 'skipped');
  const verificationIndex = stages.findIndex((item) => item.kind === 'verification');
  for (const stage of stages.slice(0, verificationIndex)) {
    await service.advanceLesson('user-1', 'language-1', started.session.id, outline.lessonId, stage.kind);
  }
  for (let index = 0; index < lessonExercises.length; index += 1) {
    if (lessonExercises[index].languageFormat === 'voice-pronunciation') continue;
    attempts.push({
      id: `recovery-attempt-${index}`,
      userId: 'user-1',
      lessonId: outline.lessonId,
      contentVersion: 1,
      exerciseIndex: index,
      correct: true,
      score: 1,
      feedback: `Evaluated recovery answer ${index + 1}.`,
      correction: 'Correct.',
      createdAt: new Date(`2026-09-14T08:2${index}:00.000Z`),
    });
  }
  await service.recordVoiceTraining(
    'user-1',
    'language-1',
    { experienceSessionId: started.session.id, lessonId: outline.lessonId, exerciseIndex: 8 },
    { buffer: Buffer.from('technical-audio'), mimetype: 'audio/webm', originalname: 'recovery.webm', size: 15 },
    2,
  );
  for (const stage of stages.slice(verificationIndex)) {
    await service.advanceLesson('user-1', 'language-1', started.session.id, outline.lessonId, stage.kind);
  }

  const request = {
    experienceSessionId: started.session.id,
    lessonId: outline.lessonId,
    idempotencyKey: 'autonomy-recovery-0001',
  };
  await assert.rejects(
    () => service.startAutonomy('user-1', 'language-1', request),
    /persist interrupted/i,
  );
  const recovered = await service.startAutonomy('user-1', 'language-1', request);
  assert.equal(recovered.assessment.id, 'assessment-1');
  assert.equal(
    recovered.course.milestoneMastery.find((item) => item.unitId === outline.unitId).status,
    'autonomy-active',
  );
  assert.equal(assessmentCreations.length, 1);
  assert.equal(masteryJournal.filter((entry) => entry.event === 'start').length, 1);
  assert.equal(masteryJournal.filter((entry) => entry.event === 'bind').length, 1);
});

test('canonical notions stay available while strict acoustic certification remains blocked', async () => {
  const { service } = harness({ useRealActivationGate: true });
  const started = await service.startCourse('user-1', 'language-1', {
    startFrom: 'zero', targetLevel: 'A1', goalDomain: 'general',
  });
  assert.equal(started.course.masteryPolicyVersion, shared.LANGUAGE_MASTERY_POLICY_VERSION);
  assert.equal(
    started.session.currentStep.metadata.rlleCourse.masteryPolicyVersion,
    shared.LANGUAGE_MASTERY_POLICY_VERSION,
  );
  assert.ok(started.course.currentLesson);
  await assert.rejects(
    () => service.startScopedMastery('user-1', 'language-1', {
      experienceSessionId: started.session.id,
      lessonId: 'lesson-1',
      scopeKind: 'pillar_exam',
      targetId: 'blocked-pillar-exam',
      idempotencyKey: 'blocked-autonomy-attempt',
    }),
    /not available/i,
  );
});

test('non-acoustic notion course never falls back to legacy whole-unit credit', async () => {
  const { service, attempts, finalizedUnits, lessonExercises } = harness({
    strictMastery: false,
  });
  await service.startCourse('user-1', 'language-1', {
    startFrom: 'zero', targetLevel: 'A1', goalDomain: 'general',
  });
  const started = await service.startLesson(
    'user-1',
    'language-1',
    { unitId: 'a1-first-contact' },
  );
  const outline = started.course.currentLesson;
  for (let index = 0; index < lessonExercises.length; index += 1) {
    if (lessonExercises[index].languageFormat === 'voice-pronunciation') continue;
    attempts.push({
      id: 'legacy-attempt-' + index,
      userId: 'user-1',
      lessonId: outline.lessonId,
      contentVersion: 1,
      exerciseIndex: index,
      correct: true,
      score: 1,
      feedback: 'Evaluated legacy answer.',
      correction: 'Correct.',
      createdAt: new Date('2026-09-14T08:' + String(10 + index) + ':00.000Z'),
    });
  }
  await service.recordVoiceTraining(
    'user-1',
    'language-1',
    { experienceSessionId: started.session.id, lessonId: outline.lessonId, exerciseIndex: 8 },
    { buffer: Buffer.from('technical-audio'), mimetype: 'audio/webm', originalname: 'course.webm', size: 15 },
    2,
  );
  let course = started.course;
  for (const stage of outline.stages.filter((item) => item.status !== 'skipped')) {
    course = await service.advanceLesson(
      'user-1',
      'language-1',
      started.session.id,
      outline.lessonId,
      stage.kind,
    );
  }
  assert.equal(course.currentLesson.status, 'active');
  assert.equal(course.progress.completedUnits, 0);
  assert.equal(course.masteryPolicyVersion, shared.LANGUAGE_MASTERY_POLICY_VERSION);
  assert.ok(course.masteryBulletins.length > 0);
  assert.equal(course.nextMasteryTarget.scopeKind, 'milestone');
  assert.equal(course.nextMasteryTarget.eligible, true);
  assert.equal(finalizedUnits.length, 0);
});

test('a failed milestone generates target-only remediation and becomes retest-ready after ten new formats', async () => {
  const runtime = harness({
    strictMastery: false,
    useMasteryJournalProjection: true,
    scopedSubmissionScoreSequence: [89.9, 90],
    scopedAwardedPointsSequence: [899, 900],
    scopedMaximumPointsSequence: [1000, 1000],
  });
  const {
    service,
    attempts,
    lessonExercises,
    lessonGenerations,
    remediationPlans,
    remediationEvidence,
  } = runtime;
  const started = await service.startCourse('user-1', 'language-1', {
    startFrom: 'zero', targetLevel: 'A1', goalDomain: 'general',
  });
  const outline = started.course.currentLesson;
  for (let index = 0; index < lessonExercises.length; index += 1) {
    if (lessonExercises[index].languageFormat === 'voice-pronunciation') continue;
    attempts.push({
      id: `milestone-training-${index}`,
      userId: 'user-1',
      lessonId: outline.lessonId,
      contentVersion: 1,
      exerciseIndex: index,
      correct: true,
      score: 1,
      feedback: 'Completed.',
      correction: 'Correct.',
      createdAt: new Date(`2026-09-14T08:${String(10 + index).padStart(2, '0')}:00.000Z`),
    });
  }
  await service.recordVoiceTraining(
    'user-1',
    'language-1',
    { experienceSessionId: started.session.id, lessonId: outline.lessonId, exerciseIndex: 8 },
    { buffer: Buffer.from('technical-audio'), mimetype: 'audio/webm', originalname: 'milestone.webm', size: 15 },
    2,
  );
  let course = started.course;
  for (const stage of outline.stages.filter((item) => item.status !== 'skipped')) {
    course = await service.advanceLesson(
      'user-1',
      'language-1',
      started.session.id,
      outline.lessonId,
      stage.kind,
    );
  }
  const target = course.nextMasteryTarget;
  assert.equal(target.scopeKind, 'milestone');
  assert.equal(target.eligible, true);
  const assessment = await service.startScopedMastery('user-1', 'language-1', {
    experienceSessionId: started.session.id,
    lessonId: outline.lessonId,
    scopeKind: 'milestone',
    targetId: target.targetId,
    idempotencyKey: target.operationKey,
  });
  const failed = await service.submitScopedMastery('user-1', 'language-1', {
    experienceSessionId: started.session.id,
    lessonId: outline.lessonId,
    scopeKind: 'milestone',
    attemptId: assessment.attemptId,
    assessmentId: assessment.assessment.id,
    answers: ['One', 'Two', 'Three'],
  });
  assert.equal(failed.decision.verdict, 'not-mastered');
  assert.equal(failed.decision.rawScore, 0.899);
  const plan = remediationPlans.get(failed.attemptId);
  assert.ok(plan);

  const remediation = await service.startRemediation('user-1', 'language-1', {
    experienceSessionId: started.session.id,
    lessonId: outline.lessonId,
    failedAttemptId: failed.attemptId,
    idempotencyKey: `milestone-failure:${failed.attemptId}`,
  });
  const generation = lessonGenerations.find((args) =>
    args[2]?.masteryRemediationGenerationKey === plan.generationKey);
  assert.ok(generation);
  assert.deepEqual(generation[2].languageNotions, [{
    notionId: target.targetId,
    criterionId: shared.RLLE_LANGUAGE_MASTERY_UNIT_MAP
      .flatMap((unit) => unit.milestones)
      .find((milestone) => milestone.id === target.targetId).criterionId,
  }]);
  const remediationLesson = remediation.course.currentLesson;
  assert.notEqual(remediationLesson.lessonId, outline.lessonId);

  for (let index = 0; index < shared.LANGUAGE_TRAINING_FORMATS.length; index += 1) {
    if (shared.LANGUAGE_TRAINING_FORMATS[index] === 'voice-pronunciation') continue;
    const exerciseAttemptId = `milestone-remediation-attempt-${index}`;
    attempts.push({
      id: exerciseAttemptId,
      userId: 'user-1',
      lessonId: remediationLesson.lessonId,
      contentVersion: 1,
      exerciseIndex: index,
      correct: true,
      score: 1,
      feedback: 'Completed targeted remediation.',
      correction: 'Correct.',
      createdAt: new Date(`2026-09-14T09:${String(index).padStart(2, '0')}:00.000Z`),
    });
    await service.recordRemediationExercise('user-1', 'language-1', {
      remediationPlanId: plan.id,
      failedAttemptId: failed.attemptId,
      lessonId: remediationLesson.lessonId,
      exerciseAttemptId,
      exerciseIndex: index,
      trainingFormat: shared.LANGUAGE_TRAINING_FORMATS[index],
    });
  }
  const voiceIndex = shared.LANGUAGE_TRAINING_FORMATS.indexOf('voice-pronunciation');
  const voiceResult = await service.recordVoiceTraining(
    'user-1',
    'language-1',
    {
      experienceSessionId: started.session.id,
      lessonId: remediationLesson.lessonId,
      exerciseIndex: voiceIndex,
    },
    { buffer: Buffer.from('technical-audio'), mimetype: 'audio/webm', originalname: 'remediation.webm', size: 15 },
    2,
  );
  assert.equal(voiceResult.coaching.transcript, 'Hello');
  assert.equal(remediationEvidence.get(plan.id).length, 10);
  const reloaded = await service.course('user-1', 'language-1');
  assert.equal(reloaded.nextMasteryTarget.targetId, target.targetId);
  assert.equal(reloaded.nextMasteryTarget.remediationPlanId, plan.id);
  assert.equal(reloaded.nextMasteryTarget.eligible, true);

  const retest = await service.startScopedMastery('user-1', 'language-1', {
    experienceSessionId: started.session.id,
    lessonId: remediationLesson.lessonId,
    scopeKind: 'milestone',
    targetId: target.targetId,
    idempotencyKey: reloaded.nextMasteryTarget.operationKey,
    remediationPlanId: plan.id,
  });
  const mastered = await service.submitScopedMastery('user-1', 'language-1', {
    experienceSessionId: started.session.id,
    lessonId: remediationLesson.lessonId,
    scopeKind: 'milestone',
    attemptId: retest.attemptId,
    assessmentId: retest.assessment.id,
    answers: ['One', 'Two', 'Three'],
  });
  assert.equal(mastered.decision.verdict, 'mastered');
  const afterReconnect = await service.course('user-1', 'language-1');
  const masteredNotion = afterReconnect.masteryBulletins
    .flatMap((bulletin) => bulletin.notions)
    .find((notion) => notion.notionId === target.targetId);
  assert.equal(masteredNotion.status, 'MASTERED');
  assert.notEqual(
    afterReconnect.milestoneMastery.find((item) => item.unitId === outline.unitId)?.status,
    'remediation',
  );
  assert.notEqual(afterReconnect.nextMasteryTarget?.targetId, target.targetId);
});

test('an aggregate autonomy result never invokes the strict completion finalizer', async () => {
  const runtime = harness({ rejectFinalizer: true });
  const { service, attempts, lessonExercises, sessions } = runtime;
  await service.startCourse('user-1', 'language-1', {
    startFrom: 'zero', targetLevel: 'A1', goalDomain: 'general',
  });
  const started = await service.startLesson('user-1', 'language-1', { unitId: 'a1-first-contact' });
  const outline = started.course.currentLesson;
  const stages = outline.stages.filter((item) => item.status !== 'skipped');
  const verificationIndex = stages.findIndex((item) => item.kind === 'verification');
  for (const stage of stages.slice(0, verificationIndex)) {
    await service.advanceLesson('user-1', 'language-1', started.session.id, outline.lessonId, stage.kind);
  }
  for (let index = 0; index < lessonExercises.length; index += 1) {
    if (lessonExercises[index].languageFormat === 'voice-pronunciation') continue;
    attempts.push({
      id: `attempt-late-${index}`, userId: 'user-1', lessonId: outline.lessonId,
      contentVersion: 1, exerciseIndex: index, correct: true, score: 1,
      feedback: 'Evaluated.', correction: 'Correct.',
      createdAt: new Date(`2026-09-14T08:2${index}:00.000Z`),
    });
  }
  await service.recordVoiceTraining(
    'user-1',
    'language-1',
    { experienceSessionId: started.session.id, lessonId: outline.lessonId, exerciseIndex: 8 },
    { buffer: Buffer.from('technical-audio'), mimetype: 'audio/webm', originalname: 'training.webm', size: 15 },
    2,
  );
  for (const stage of stages.slice(verificationIndex)) {
    await service.advanceLesson('user-1', 'language-1', started.session.id, outline.lessonId, stage.kind);
  }
  const autonomy = await service.startAutonomy('user-1', 'language-1', {
    experienceSessionId: started.session.id,
    lessonId: outline.lessonId,
    idempotencyKey: 'late-help-race-attempt',
  });
  const evaluated = await service.submitAutonomy('user-1', 'language-1', {
    experienceSessionId: started.session.id,
    lessonId: outline.lessonId,
    assessmentId: autonomy.assessment.id,
    answers: ['One', 'Two', 'Three'],
  });
  assert.equal(evaluated.decision.verdict, 'mastered');
  const persisted = sessions.get(started.session.id);
  const state = persisted.currentStep.metadata.rlleCourse;
  assert.deepEqual(state.completedUnitIds, []);
  assert.equal(state.currentUnitId, outline.unitId);
  assert.notEqual(state.milestoneMastery[outline.unitId].status, 'mastered');
  assert.equal(persisted.twinImpact, null);
});

test('Mistake Memory moves observed → repeated → confirmed using actual distinct evidence', () => {
  const { service } = harness();
  const base = {
    schemaVersion: 1, startLevel: 'A1',
    level: { declared: 'A1', estimated: null, evaluated: null, target: 'A1' },
    goal: null, goalDomain: 'general', curriculumIds: ['a1-first-contact'],
    completedUnitIds: [], currentUnitId: 'a1-first-contact', unitLessonIds: {},
    unitLastActivityAt: {}, currentLesson: null, currentMission: null,
    evidence: [], gaps: [], mistakeMemory: [], repairLoops: [],
    immersionIntensity: 'guided', correctionIntensity: 'balanced',
  };
  const gap = { kind: 'grammar', label: 'article choice', learnerExample: 'I go to school', correction: 'Use the required article in this context.' };
  let state = base;
  for (let index = 1; index <= 3; index += 1) {
    state = service.mergeEvidence(state, {
      id: `e-${index}`, canDoId: 'social-introduce', source: 'mission', sourceId: `m-${index}`,
      result: 'not-demonstrated', observedAt: `2026-09-14T08:0${index}:00.000Z`, observation: 'Observed article error.',
    }, gap, `session-${index}`, `micro-${index}`);
  }
  assert.equal(state.gaps[0].status, 'confirmed');
  assert.equal(state.mistakeMemory[0].occurrenceCount, 3);
  assert.equal(state.repairLoops[0].currentStage, 'retry-now');
});

test('long-running RLLE evidence remains inside the ExperienceSession field budget', () => {
  const { service } = harness();
  let state = {
    schemaVersion: 1, startLevel: 'A1',
    level: { declared: 'A1', estimated: null, evaluated: null, target: 'A1' },
    goal: null, goalDomain: 'general', curriculumIds: ['a1-first-contact'],
    completedUnitIds: [], currentUnitId: 'a1-first-contact', unitLessonIds: {},
    unitLastActivityAt: {}, currentLesson: null, currentMission: null,
    evidence: [], gaps: [], mistakeMemory: [], repairLoops: [],
    immersionIntensity: 'guided', correctionIntensity: 'balanced',
  };
  for (let index = 0; index < 100; index += 1) {
    state = service.mergeEvidence(state, {
      id: `evidence-${index}-${'x'.repeat(40)}`,
      canDoId: 'social-introduce', source: 'mission', sourceId: `mission-${index}`,
      result: 'not-demonstrated', observedAt: new Date(1_750_000_000_000 + index).toISOString(),
      observation: 'o'.repeat(360), dimensions: ['grammar'],
    }, {
      kind: 'grammar', label: `pattern-${index}-${'l'.repeat(190)}`,
      learnerExample: 'e'.repeat(300), correction: 'c'.repeat(600),
    }, `session-${index}`, `micro-${index}`);
  }
  assert.equal(state.evidence.length, 32);
  assert.equal(state.gaps.length, 12);
  assert.equal(state.mistakeMemory.length, 12);
  assert.equal(state.repairLoops.length, 12);
  assert.ok(JSON.stringify({ rlleCourse: state }).length < 64_000);
});

test('mission JSON evaluation fails closed and never infers listening or pronunciation from a transcript', () => {
  const { service } = harness();
  const pronunciation = service.parseMissionEvaluation(JSON.stringify({
    outcome: 'needs-repair', observation: 'Text was hard to understand.',
    gap: { kind: 'pronunciation', label: 'accent', correction: 'Change accent.' },
    microLesson: { explanation: 'x', example: 'y', practicePrompt: 'z' },
  }));
  assert.equal(pronunciation, null);
  const listening = service.parseMissionEvaluation(JSON.stringify({
    outcome: 'needs-repair', observation: 'The response did not match the prompt.',
    gap: { kind: 'listening', label: 'detail recognition', correction: 'Listen again.' },
    microLesson: { explanation: 'x', example: 'y', practicePrompt: 'z' },
  }));
  assert.equal(listening, null);
  const incompleteRepair = service.parseMissionEvaluation(JSON.stringify({
    outcome: 'needs-repair', observation: 'A concrete grammar blocker was observed.',
    gap: { kind: 'grammar', label: 'word order', correction: 'Put the verb second.' },
    microLesson: null,
  }));
  assert.equal(incompleteRepair, null);
  const presentation = shared.RLLE_WORLD_MISSIONS.find((mission) => mission.id === 'work-presentation');
  assert.deepEqual(service.missionEvidenceDimensions(presentation, false), []);
  assert.deepEqual(service.missionEvidenceDimensions(presentation, true), ['conversation']);
});

test('course, mission and mobile Tutor routes preserve the RLLE session context', () => {
  const controller = read('apps/api/src/languages/language.controller.ts');
  const engine = read('apps/api/src/languages/real-life-language.service.ts');
  const client = read('apps/mobile/lib/language-rll-client.ts');
  const tutor = read('apps/mobile/app/tutor/[id].tsx');
  assert.match(controller, /@Get\(':id\/course'\)/);
  assert.match(controller, /@Post\(':id\/missions\/:missionId\/turn'\)/);
  assert.match(engine, /kind: 'language-course'/);
  assert.match(engine, /kind: 'language-mission'/);
  assert.match(engine, /courseSessionId/);
  assert.match(client, /missions\/\$\{encodeURIComponent\(request\.missionId\)\}\/start/);
  assert.match(tutor, /missionExperienceSessionId/);
  assert.match(tutor, /RlleMissionTurnResponse/);
});

test('RLLE remains orchestration over Lesson, Tutor, ExperienceSession and the existing FSRS deck', () => {
  const engine = read('apps/api/src/languages/real-life-language.service.ts');
  const vocabulary = read('apps/api/src/languages/vocabulary.service.ts');
  assert.match(engine, /this\.lessons\.generate/);
  assert.match(engine, /this\.conversations\.start/);
  assert.match(engine, /this\.tutor\.sendMessage/);
  assert.match(engine, /this\.experiences\.(create|updateState)/);
  assert.match(engine, /this\.languages\.ensureVocabDeck/);
  assert.match(engine, /languageStructureProgression/);
  assert.match(engine, /word or expression → sentence → context → learner use → later reuse → FSRS review/);
  assert.match(engine, /communication-survival strategies/);
  assert.match(vocabulary, /collocations and frequent verbs/);
  assert.match(vocabulary, /conjugated form/);
  assert.match(vocabulary, /compact grammar pattern/);
  assert.doesNotMatch(engine, /prisma\.rll|prisma\.curriculum|prisma\.mistakeMemory/);
});

test('every RLLE catalogue and UI key exists exactly once in English and French', () => {
  const sources = [
    'apps/mobile/app/languages/index.tsx',
    'apps/mobile/app/languages/[id].tsx',
    'apps/mobile/app/languages/[id]/course/index.tsx',
    'apps/mobile/app/languages/[id]/course/lesson.tsx',
    'apps/mobile/app/languages/[id]/course/missions.tsx',
    'apps/mobile/app/languages/[id]/course/can-do.tsx',
    'apps/mobile/app/tutor/[id].tsx',
    'apps/mobile/components/language/course-ui.tsx',
  ].map(read).join('\n');
  const keys = new Set(
    [...sources.matchAll(/[\'\"`](rlle\.[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)+)[\'\"`]/g)]
      .map((match) => match[1]),
  );
  for (const unit of shared.RLLE_CURRICULUM) {
    keys.add(unit.titleCode);
    keys.add(unit.objectiveCode);
  }
  for (const mission of shared.RLLE_WORLD_MISSIONS) {
    keys.add(mission.titleCode);
    keys.add(mission.objectiveCode);
  }
  for (const capability of shared.RLLE_CAN_DO_MAP) keys.add(capability.labelCode);
  for (const stage of shared.RLLE_LESSON_STAGES) keys.add(`rlle.ui.stage.${stage}`);
  for (const stage of shared.RLLE_REPAIR_STAGES) keys.add(`rlle.ui.repair.${stage}`);
  for (const skill of shared.RLLE_SURVIVAL_SKILLS) keys.add(`rlle.ui.survival.${skill}`);
  for (const strand of shared.RLLE_CURRICULUM_STRANDS) keys.add(`rlle.ui.strand.${strand}`);
  for (const category of shared.RLLE_MISSION_CATEGORIES) keys.add(`rlle.ui.category.${category}`);
  for (const dimension of shared.RLLE_PROGRESS_DIMENSIONS) keys.add(`rlle.ui.dimension.${dimension}`);
  for (const suffix of [
    'stage.status.pending', 'stage.status.active', 'stage.status.completed', 'stage.status.skipped',
    'course.status.locked', 'course.status.available', 'course.status.in-progress', 'course.status.completed', 'course.status.untracked', 'course.status.paused',
    'mission.status.active', 'mission.status.paused', 'mission.status.succeeded', 'mission.status.needs-retry',
    'gap.status.observed', 'gap.status.repeated', 'gap.status.confirmed', 'gap.status.repairing', 'gap.status.consolidated',
    'dimension.status.not-evaluated', 'dimension.status.emerging', 'dimension.status.demonstrated', 'dimension.status.consistent',
    'cando.status.not-evaluated', 'cando.status.in-progress', 'cando.status.validated',
    'cando.source.mission', 'cando.source.assessment', 'cando.source.controlled-activity',
    'modality.text', 'modality.voice', 'modality.mixed',
  ]) keys.add(`rlle.ui.${suffix}`);

  const catalogue = read('apps/mobile/lib/i18n.tsx');
  const missing = [...keys].filter((key) => !catalogue.includes(`'${key}':`));
  const duplicated = [...keys].filter((key) => catalogue.split(`'${key}':`).length - 1 !== 2);
  assert.deepEqual(missing, []);
  assert.deepEqual(duplicated, []);
});
