'use strict';

require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');
const { BadRequestException } = require('@nestjs/common');
const {
  LearnerPassportService,
} = require('../dist/onboarding/learner-passport.service.js');
const {
  OnboardingService,
} = require('../dist/onboarding/onboarding.service.js');
const {
  StudyPlannerService,
} = require('../dist/planner/study-planner.service.js');
const { TutorService } = require('../dist/tutor/tutor.service.js');
const {
  resolveAgeTeachingPolicy,
  selectStrategy,
} = require('../dist/tutor/teaching-strategy.js');
const { resolveTeacherPolicy } = require('@second-brain/shared');

const updatedAt = new Date('2026-09-30T10:00:00.000Z');

function readPrisma(overrides = {}, ageBand = '12to15') {
  return {
    onboardingProfile: {
      findUnique: async () => ({
        identity: {
          ageBand,
          countryOfOrigin: 'SN',
          currentCountry: 'FR',
        },
        education: { category: 'school', level: 'secondary', system: 'national' },
        languages: {
          native: 'fr', explanation: 'fr', teaching: 'en',
          known: [{ language: 'en', level: 'B1' }],
        },
        languageLearner: {
          targetLanguage: 'en', currentLevel: 'B1', targetLevel: 'C1',
          mainGoal: 'Academic fluency', skills: ['speaking'],
        },
        goals: ['Pass the final exam'],
        subjects: ['Mathematics'],
        preferences: ['visual'],
        teacher: { learningSupport: 'balanced' },
        extra: { interfaceLanguage: 'fr' },
        category: 'school',
        updatedAt,
      }),
    },
    profile: {
      findUnique: async () => ({
        userId: 'u1', preferredLanguage: 'fr', timezone: 'Europe/Paris', updatedAt,
      }),
    },
    languageProfile: {
      findMany: async () => [{
        id: 'lp1', language: 'English', normalizedLanguage: 'en',
        nativeLanguage: 'French', cefrLevel: 'B1', goal: 'Academic fluency',
        updatedAt, _count: { lessons: 2, tutorSessions: 3 },
        lessons: [{ createdAt: updatedAt }], tutorSessions: [],
      }],
    },
    learningDna: {
      findUnique: async () => ({
        traits: [{ key: 'visual', label: 'Visual', confidence: 80 }],
        maturity: 60, interactions: 12, updatedAt,
      }),
    },
    ...overrides,
  };
}

test('GET projection keeps declared, observed and verified provenance separate', async () => {
  const prisma = readPrisma();
  const observed = { generatedAt: updatedAt.toISOString(), conceptCount: 3 };
  const service = new LearnerPassportService(prisma, { profile: async () => observed });
  const passport = await service.get('u1');

  assert.equal(passport.version, 1);
  assert.equal(passport.declared.source, 'DECLARED');
  assert.equal(passport.declared.ageBand, '12to15');
  assert.equal(passport.declared.interfaceLanguage, 'fr');
  assert.equal(passport.declared.nativeOrPrimaryLanguage, 'fr');
  assert.equal(passport.declared.teachingLanguage, 'en');
  assert.deepEqual(passport.declared.knownLanguages, [{ language: 'en', level: 'B1' }]);
  assert.equal(passport.observed.source, 'OBSERVED');
  assert.equal(passport.observed.learnerProfile, observed);
  assert.equal(passport.observed.languageProgress[0].evaluatedLevel, null);
  assert.deepEqual(passport.verified, {
    source: 'VERIFIED', available: false, fields: [],
  });
});

test('Onboarding persists the existing ageBand field and a fresh service instance reloads it', async () => {
  const now = new Date('2026-10-04T12:00:00.000Z');
  let stored = null;
  const table = {
    findUnique: async () => stored,
    upsert: async ({ create, update }) => {
      stored = stored
        ? { ...stored, ...update, updatedAt: now }
        : {
            id: 'onboarding-age', userId: 'u1', status: 'not_started', category: null,
            currentStep: 'welcome', identity: null, education: null, languages: null,
            languageLearner: null, goals: null, subjects: null, preferences: null,
            teacher: null, academicSupport: null, assessment: null, extra: null,
            completedAt: null, createdAt: now, updatedAt: now, ...create,
          };
      return stored;
    },
  };
  const prisma = {
    onboardingProfile: table,
    $transaction: async (operation) => operation({
      $executeRaw: async () => 1,
      onboardingProfile: table,
    }),
  };

  const firstRequest = new OnboardingService(prisma, {});
  const saved = await firstRequest.save('u1', {
    currentStep: 'category',
    answers: { identity: { ageBand: '18to25' } },
  });
  assert.equal(saved.answers.identity.ageBand, '18to25');
  assert.equal(stored.identity.ageBand, '18to25');

  // A new service instance represents a later authenticated request: no age
  // value is kept in process/session state.
  const laterRequest = new OnboardingService(prisma, {});
  const reloaded = await laterRequest.get('u1');
  assert.equal(reloaded.answers.identity.ageBand, '18to25');
});

test('Tutor context adapts age/languages but explicitly preserves assessment rules', async () => {
  const service = new LearnerPassportService(readPrisma(), { profile: async () => null });
  const context = await service.tutorContext('u1', true);

  assert.equal(context.nativeOrPrimaryLanguage, 'fr');
  assert.equal(context.teachingLanguage, 'en');
  assert.equal(context.ageBand, '12to15');
  assert.deepEqual(context.learningPreferences, ['visual']);
  assert.match(context.directive, /adolescent/i);
  assert.match(context.directive, /General explanation language: fr/);
  assert.match(context.directive, /Teaching language: en/);
  assert.match(context.directive, /Declared known languages and levels: en=B1/);
  assert.match(context.directive, /Declared learning language goal: en \(current=B1, target=C1\)/);
  assert.match(context.directive, /Observed Learning DNA signals/);
  assert.match(context.directive, /must never lower, change or bypass.*assessment rubric/i);
});

test('Persisted Passport age maps to a distinct ITE policy and final Teacher Context', async () => {
  const tutor = new TutorService({}, {}, {}, {}, {}, {}, {}, {});
  const policy = resolveTeacherPolicy(
    { automaticAdaptation: true },
    { mode: 'conversation', intent: 'learn' },
  );
  const cases = [
    ['under12', 'child', 'simple_concrete', /accessible vocabulary.*short guided steps.*concrete familiar examples/is],
    ['12to15', 'adolescent', 'school_exam', /school-level vocabulary.*growing autonomy.*exam-preparation/is],
    ['18to25', 'adult', 'academic_professional', /denser academic or technical vocabulary.*greater learner autonomy/is],
  ];

  for (const [ageBand, audience, style, expectedMethod] of cases) {
    const passport = new LearnerPassportService(
      readPrisma({}, ageBand),
      { profile: async () => null },
    );
    const context = await passport.tutorContext('u1', true);
    assert.equal(context.ageBand, ageBand);
    const selected = selectStrategy({
      subject: 'Informatique',
      isLanguage: false,
      mastery: null,
      learningStyle: context.learningPreferences.join(' '),
      ageBand: context.ageBand,
    });
    assert.deepEqual(selected.agePolicy, { sourceAgeBand: ageBand, audience, style });
    const prompt = tutor.systemPrompt(
      undefined,
      undefined,
      undefined,
      undefined,
      selected.strategy,
      'fr',
      undefined,
      policy,
      context.directive,
      selected.agePolicy,
    );

    assert.match(prompt, new RegExp(`Age-adaptive ITE policy: audience=${audience}; style=${style}`));
    assert.match(prompt, expectedMethod);
    assert.match(prompt, /declared Learner Passport settings.*permitted inputs.*not verified mastery/is);
    assert.match(prompt, /never lower, change or bypass an announced assessment rubric, assistance rule or grading standard/i);
  }
});

test('Every existing age band maps explicitly and missing or legacy formats never get a silent default', () => {
  assert.equal(resolveAgeTeachingPolicy('under12').style, 'simple_concrete');
  assert.equal(resolveAgeTeachingPolicy('12to15').style, 'school_exam');
  assert.equal(resolveAgeTeachingPolicy('16to18').style, 'school_exam');
  assert.equal(resolveAgeTeachingPolicy('18to25').style, 'academic_professional');
  assert.equal(resolveAgeTeachingPolicy('25to40').style, 'academic_professional');
  assert.equal(resolveAgeTeachingPolicy('over40').style, 'academic_professional');
  assert.equal(resolveAgeTeachingPolicy(null), null);
  assert.equal(resolveAgeTeachingPolicy('18-25'), null);
});

test('Adolescent school_exam policy outranks subject method and locale wording in final Teacher Context', async () => {
  const tutor = new TutorService({}, {}, {}, {}, {}, {}, {}, {});
  const passport = new LearnerPassportService(
    readPrisma({
      onboardingProfile: {
        findUnique: async () => ({
          identity: { ageBand: '12to15' },
          education: { category: 'school', level: 'secondary' },
          languages: {
            native: 'fr', explanation: 'fr', teaching: 'de',
            known: [{ language: 'de', level: 'A2' }],
          },
          goals: ['Prepare an assessment'],
          subjects: ['Informatique'],
          preferences: ['project'],
          teacher: { learningSupport: 'balanced' },
          extra: { interfaceLanguage: 'fr' },
          category: 'school',
          updatedAt,
        }),
      },
    }, '12to15'),
    { profile: async () => null },
  );
  const context = await passport.tutorContext('u1', true);
  const selected = selectStrategy({
    subject: 'Informatique',
    isLanguage: false,
    mastery: null,
    learningStyle: context.learningPreferences.join(' '),
    ageBand: context.ageBand,
  });
  assert.equal(selected.strategy, 'project_based');
  assert.equal(selected.agePolicy.style, 'school_exam');

  const prompt = tutor.systemPrompt(
    undefined,
    undefined,
    undefined,
    undefined,
    selected.strategy,
    'fr',
    undefined,
    resolveTeacherPolicy(
      { automaticAdaptation: true },
      { mode: 'conversation', intent: 'learn' },
    ),
    context.directive,
    selected.agePolicy,
  );
  const priorityAt = prompt.indexOf('Adaptive Teacher Context instruction priority:');
  assert.ok(priorityAt > prompt.indexOf('Teaching strategy: Project-based learning'));
  assert.ok(priorityAt > prompt.indexOf('All pedagogical content must be written'));
  assert.match(prompt.slice(priorityAt), /school_exam context remains in force throughout.*subject teaching strategy.*inside that exam-oriented policy/is);
  assert.match(prompt.slice(priorityAt), /explanation language for explanatory prose.*academic and technical terminology.*declared teaching language.*intentional exception/is);
  assert.match(prompt.slice(priorityAt), /never lower the expected level, grading standard or assistance rules/i);
  assert.doesNotMatch(prompt.slice(priorityAt), /Germany|German|Deutsch|verkettet/i);
});

test('Tutor does not silently replace a failed Passport read with an unadapted default', async () => {
  const failure = new Error('controlled Passport read failure');
  const tutor = new TutorService({}, {}, {}, {}, {}, {}, {}, {
    tutorContext: async () => { throw failure; },
  });
  await assert.rejects(() => tutor.loadPassportContext('u1', true), failure);
});

test('Passport learning preferences steer the existing ITE without a new engine', () => {
  assert.equal(selectStrategy({
    subject: null, isLanguage: false, mastery: null, learningStyle: 'visual',
  }).strategy, 'guided_demonstration');
  assert.equal(selectStrategy({
    subject: null, isLanguage: true, mastery: null, learningStyle: 'visual',
  }).strategy, 'task_based');
  assert.equal(selectStrategy({
    subject: null, isLanguage: false, mastery: 0.2, learningStyle: 'project',
  }).strategy, 'guided_demonstration');
});

test('PATCH rejects invalid timezones before any write', async () => {
  const service = new LearnerPassportService(readPrisma(), { profile: async () => null });
  await assert.rejects(
    () => service.update('u1', { timezone: 'Mars/Olympus' }),
    BadRequestException,
  );
});

test('PATCH merges declared answers in the existing onboarding row', async () => {
  let written;
  const tx = {
    $executeRaw: async () => 1,
    onboardingProfile: {
      findUnique: async () => ({
        identity: { country: 'legacy-country' },
        languages: { native: 'fr' },
        education: { level: 'secondary' },
        languageLearner: {},
        teacher: {},
        category: 'school',
      }),
      upsert: async (request) => { written = request; },
    },
    profile: { findUnique: async () => null, upsert: async () => undefined },
  };
  const prisma = readPrisma({ $transaction: async (operation) => operation(tx) });
  const service = new LearnerPassportService(prisma, { profile: async () => null });
  service.get = async () => ({ updatedAt: null });

  await service.update('u1', {
    identity: { currentCountry: 'France' },
    languages: { teachingLanguage: 'en' },
    subjects: [' Mathematics ', 'Mathematics'],
  });

  assert.equal(written.update.identity.country, 'legacy-country');
  assert.equal(written.update.identity.currentCountry, 'France');
  assert.equal(written.update.languages.native, 'fr');
  assert.equal(written.update.languages.teaching, 'en');
  assert.deepEqual(written.update.subjects, ['Mathematics']);
});

test('Planner uses learner-local time and only persisted dated commitments', async () => {
  const service = new StudyPlannerService(
    { next: async () => ({ items: [{ name: 'Algebra', status: 'ready' }] }) },
    { profile: async () => ({ workRhythm: 'regular', focusWindow: 'morning' }) },
    { due: async () => [] },
    {
      planningSignals: async () => ({
        timezone: 'Asia/Tokyo', subjects: ['Physics'], academicGoals: [], languageProfiles: [],
      }),
    },
    {
      exam: { findFirst: async () => ({ subject: 'Calculus exam' }) },
      calendarEvent: { findFirst: async () => null },
    },
  );

  const plan = await service.build('u1', new Date('2026-01-01T23:30:00.000Z'));
  assert.equal(plan.date, '2026-01-02');
  assert.equal(plan.startsAt, '08:30');
  assert.equal(plan.blocks[0].subject, 'Calculus exam');
  assert.equal(plan.sources.includes('adaptivePath'), false);
  assert.equal(plan.sources.includes('digitalTwin'), true);
});

test('Planner falls back only to a declared Passport subject, then a real language profile', async () => {
  const base = {
    next: async () => ({ items: [] }),
  };
  const profile = { profile: async () => null };
  const revision = { due: async () => [] };
  const prisma = {
    exam: { findFirst: async () => null },
    calendarEvent: { findFirst: async () => null },
  };
  const passport = {
    planningSignals: async () => ({
      timezone: 'UTC', subjects: ['Biology'], academicGoals: [],
      languageProfiles: [{ id: 'lp-1', language: 'Spanish', goal: 'Travel' }],
    }),
  };
  const declared = await new StudyPlannerService(base, profile, revision, passport, prisma)
    .build('u1', new Date('2026-01-01T12:00:00.000Z'));
  assert.equal(declared.blocks[0].subject, 'Biology');
  assert.equal(declared.blocks[0].route, '/tutor');

  passport.planningSignals = async () => ({
    timezone: 'UTC', subjects: [], academicGoals: [],
    languageProfiles: [{ id: 'lp-1', language: 'Spanish', goal: 'Travel' }],
  });
  const language = await new StudyPlannerService(base, profile, revision, passport, prisma)
    .build('u1', new Date('2026-01-01T12:00:00.000Z'));
  assert.equal(language.blocks[0].subject, 'Spanish — Travel');
  assert.equal(language.blocks[0].route, '/languages/lp-1');
});
