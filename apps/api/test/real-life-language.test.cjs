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
  const assessments = new Map();
  let nextId = 1;
  let conversationStarts = 0;
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
      findMany: async ({ where }) => attempts
        .filter((attempt) => attempt.userId === where.userId && attempt.lessonId === where.lessonId
          && (where.contentVersion === undefined || attempt.contentVersion === where.contentVersion))
        .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime()),
    },
    lesson: {
      findFirst: async ({ where }) => where.id === 'lesson-1' && where.userId === 'user-1'
        ? { contentVersion: 1 }
        : null,
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
    generate: async () => ({
      id: 'lesson-1', languageProfileId: profile.id, topic: 'First contact',
      objective: 'Introduce yourself in a real exchange.', sourceDocumentId: null,
      exercises: lessonExercises,
    }),
    get: async () => ({
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
        const assessment = {
          id: 'assessment-1', type: 'open', topic: 'Autonomy', title: 'Autonomy',
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
      submit: async (_userId, id, answers) => {
        const item = assessments.get(id);
        const submission = {
          id: 'submission-1', assessmentId: id, score: 90,
          results: item.view.questions.map((question, index) => ({
            questionId: question.id, prompt: question.prompt, learnerAnswer: answers[index],
            awarded: 9, max: 10, verdict: 'partial', why: 'Observed production.', how: 'Keep practising.',
            errorMade: 'Minor detail.', howToAvoid: 'Review it.',
          })),
          summary: 'Autonomous production reached the threshold.', advice: 'Continue.',
          createdAt: '2026-09-14T08:40:00.000Z',
        };
        item.view = { ...item.view, latestSubmission: submission };
        return submission;
      },
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
  );
  if (!options.useRealActivationGate) {
    service.strictMasteryAvailable = () => options.strictMastery !== false;
  }
  return {
    service, sessions, experiences, attempts, finalizedUnits, lessonExercises,
    conversationStarts: () => conversationStarts,
  };
}

test('course from zero keeps the complete A1→B1 spine and distinguishes declared/evaluated levels', async () => {
  const { service } = harness();
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

test('structured lesson navigation never grants mastery; ten formats and autonomous 90% proof do', async () => {
  const { service, attempts, finalizedUnits, lessonExercises } = harness();
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
  assert.equal(course.progress.completedUnits, 1);
  const unitCanDoIds = new Set(shared.RLLE_CURRICULUM.find((item) => item.id === outline.unitId).canDoIds);
  assert.equal(course.canDoMap.filter((item) => unitCanDoIds.has(item.id)).every((item) => item.status === 'validated'), true);
  assert.equal(finalizedUnits.length, 1);
  assert.equal(finalizedUnits[0].unitId, outline.unitId);
  assert.equal(finalizedUnits[0].assessmentSubmissionId, 'submission-1');
  assert.equal(finalizedUnits[0].lessonContentVersion, 1);
  assert.equal(finalizedUnits[0].policyVersion, shared.LANGUAGE_MASTERY_POLICY_VERSION);
});

test('the real activation gate keeps the deployed RLLE path legacy while mandatory content is incomplete', async () => {
  const { service } = harness({ useRealActivationGate: true });
  const started = await service.startCourse('user-1', 'language-1', {
    startFrom: 'zero', targetLevel: 'A1', goalDomain: 'general',
  });
  assert.equal(started.course.masteryPolicyVersion, 'legacy');
  assert.equal(started.session.currentStep.metadata.rlleCourse.masteryPolicyVersion, null);
  await assert.rejects(
    () => service.startAutonomy('user-1', 'language-1', {
      experienceSessionId: started.session.id,
      lessonId: 'lesson-1',
      idempotencyKey: 'blocked-autonomy-attempt',
    }),
    /not available/i,
  );
});

test('feature-off lessons retain the deployed completion and finalizer flow', async () => {
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
  assert.equal(course.currentLesson.status, 'completed');
  assert.equal(course.progress.completedUnits, 1);
  assert.equal(course.masteryPolicyVersion, 'legacy');
  assert.equal(finalizedUnits.length, 1);
  assert.deepEqual(finalizedUnits[0].evidenceIds.length > 0, true);
  assert.equal(Object.hasOwn(finalizedUnits[0], 'policyVersion'), false);
});

test('a rejected late-help finalizer never persists mastered progress or unlocks the next unit', async () => {
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
  await assert.rejects(
    () => service.submitAutonomy('user-1', 'language-1', {
      experienceSessionId: started.session.id,
      lessonId: outline.lessonId,
      assessmentId: autonomy.assessment.id,
      answers: ['One', 'Two', 'Three'],
    }),
    /late-help-finalizer-rejected/,
  );
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
