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

function harness() {
  const sessions = new Map();
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
  };
  const languages = {
    requireOwned: async (userId, id) => {
      if (userId !== profile.userId || id !== profile.id) throw new Error('not found');
      return profile;
    },
  };
  const lessons = {
    generate: async () => ({
      id: 'lesson-1', languageProfileId: profile.id, topic: 'First contact',
      objective: 'Introduce yourself in a real exchange.', sourceDocumentId: null,
    }),
    get: async () => ({
      id: 'lesson-1', languageProfileId: profile.id, topic: 'First contact',
      objective: 'Introduce yourself in a real exchange.', sourceDocumentId: null,
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
  );
  return { service, sessions, experiences, conversationStarts: () => conversationStarts };
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

test('structured lesson progression is ordered and completing it does not validate a Can-Do', async () => {
  const { service } = harness();
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
  for (const stage of outline.stages.filter((item) => item.status !== 'skipped')) {
    course = await service.advanceLesson('user-1', 'language-1', started.session.id, outline.lessonId, stage.kind);
  }
  assert.equal(course.progress.completedUnits, 1);
  assert.equal(course.canDoMap.every((item) => item.status === 'not-evaluated'), true);
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
