'use strict';

require('reflect-metadata');
const test = require('node:test');
const assert = require('node:assert/strict');
const { ExaminerService } = require('../dist/examiner/examiner.service.js');
const { LanguagePlacementService } = require('../dist/languages/language-placement.service.js');
const { LearnerPassportService } = require('../dist/onboarding/learner-passport.service.js');
const { LANGUAGE_PLACEMENT_REQUIRED_SKILLS: SKILLS } = require('@second-brain/shared');

const OWNER = 'closure-technical-owner';
const PROFILE = 'closure-english';
const ANSWERS = ['An apple is a fruit.', 'She works every day.', 'The train leaves at six.', 'My name is Ada. I live here.'];
const NOW = new Date('2026-10-20T12:00:00.000Z');
const copy = (value) => value == null ? value : structuredClone(value);

function matches(row, where = {}) {
  return Object.entries(where).every(([key, expected]) => {
    if (key === 'OR') return expected.some((item) => matches(row, item));
    if (key === 'AND') return expected.every((item) => matches(row, item));
    const actual = row[key];
    if (expected instanceof Date) return actual instanceof Date && actual.getTime() === expected.getTime();
    if (expected && typeof expected === 'object') {
      if (Array.isArray(expected.in)) return expected.in.includes(actual);
      if (typeof expected.startsWith === 'string') return typeof actual === 'string' && actual.startsWith(expected.startsWith);
    }
    return actual === expected;
  });
}

/** Only storage and the provider boundary are in memory. Examiner parsing,
 * claims, grading, CEFR projection, placement orchestration and the public
 * LearnerPassportService.get() path below are the real compiled services. */
function harness({ levels = [['A1', 'A2', 'A1', 'A1']], corruptResult } = {}) {
  const rows = { assessment: [], assessmentSubmission: [], experienceSession: [] };
  const calls = [];
  let failNextSessionWrite = false;
  const profile = { id: PROFILE, userId: OWNER, language: 'English', normalizedLanguage: 'en',
    cefrLevel: 'C2', mode: 'advanced', teachingLanguageSource: 'interface', nativeLanguage: 'Lingala',
    goal: 'Technical placement acceptance', updatedAt: NOW };
  const prisma = { $executeRaw: async () => 1 };
  for (const name of Object.keys(rows)) {
    const update = (row, data) => {
      for (const [key, value] of Object.entries(data)) {
        row[key] = value && typeof value === 'object' && 'increment' in value
          ? row[key] + value.increment : copy(value);
      }
      row.updatedAt = NOW;
    };
    prisma[name] = {
      create: async ({ data }) => {
        const row = { id: `${name}-${rows[name].length + 1}`, createdAt: NOW, updatedAt: NOW, ...copy(data) };
        rows[name].push(row);
        return copy(row);
      },
      findFirst: async ({ where }) => copy(rows[name].find((row) => matches(row, where)) ?? null),
      findUnique: async ({ where }) => copy(rows[name].find((row) => matches(row, where)) ?? null),
      findMany: async ({ where = {}, include } = {}) => rows[name].filter((row) => matches(row, where)).map((row) => ({
        ...copy(row), ...(include?.assessment ? { assessment: copy(rows.assessment.find((item) => item.id === row.assessmentId)) } : {}),
      })),
      update: async ({ where, data }) => {
        const row = rows[name].find((item) => matches(item, where));
        assert.ok(row, 'Canonical update must match a stored row.');
        update(row, data);
        return copy(row);
      },
      updateMany: async ({ where, data }) => {
        if (name === 'experienceSession' && failNextSessionWrite) {
          failNextSessionWrite = false;
          throw new Error('Technical fixture: interrupted session projection write.');
        }
        const found = rows[name].filter((row) => matches(row, where));
        found.forEach((row) => update(row, data));
        return { count: found.length };
      },
    };
  }
  prisma.$transaction = async (callback) => callback(prisma);
  prisma.profile = { findUnique: async ({ where }) => where.userId === OWNER
    ? { userId: OWNER, preferredLanguage: 'fr', timezone: 'UTC', updatedAt: NOW } : null };
  prisma.onboardingProfile = { findUnique: async ({ where }) => where.userId === OWNER
    ? { userId: OWNER, languages: { native: 'ln', interface: 'fr' }, extra: { interfaceLanguage: 'fr' }, updatedAt: NOW } : null };
  prisma.learningDna = { findUnique: async () => null };
  prisma.languageProfile = {
    findFirst: async ({ where }) => matches(profile, where) ? copy(profile) : null,
    findMany: async ({ where }) => where.userId === OWNER ? [{ ...copy(profile), _count: { lessons: 0, tutorSessions: 0 },
      lessons: [], tutorSessions: [], masteryAttempts: [], experienceSessions: copy(rows.experienceSession) }] : [],
  };
  prisma.learningCompletion = {
    create: async () => { throw new Error('Diagnostic must never create mastery.'); },
    upsert: async () => { throw new Error('Diagnostic must never create mastery.'); },
  };
  const experiences = {
    create: async (userId, request) => {
      assert.equal(userId, OWNER);
      const existing = rows.experienceSession.find((row) => row.idempotencyKey === request.idempotencyKey);
      if (existing) return copy(existing);
      return prisma.experienceSession.create({ data: { ...request, userId, version: 1, status: 'active',
        languageProfileId: request.links.languageProfileId } });
    },
    get: async (userId, id) => {
      const row = rows.experienceSession.find((item) => item.id === id && item.userId === userId);
      assert.ok(row, 'Experience recovery must be owner-scoped.');
      return copy(row);
    },
  };
  const llm = { generate: async (messages, options) => {
    calls.push({ messages, options });
    assert.equal(options.operation, 'language-placement');
    const grading = messages.some((message) => message.content.includes('learnerAnswer'));
    if (!grading) return { text: JSON.stringify({ questions: SKILLS.map((skill) => ({ diagnosticSkill: skill,
      prompt: `Independent ${skill} task with all necessary material.`, format: 'open', points: 10,
      answerKey: `Private ${skill} key.`, rubric: `Independent CEFR ${skill} evidence.` })) }) };
    const assessment = rows.assessment.at(-1);
    const submitted = rows.assessmentSubmission.find((row) => row.assessmentId === assessment.id);
    const round = assessment.questions.languagePlacement.round;
    const result = { results: assessment.questions.questions.map((question, index) => ({ questionId: question.id,
      awarded: 10, verdict: 'correct', why: 'Observed independent evidence.', how: 'Keep practising.',
      errorMade: null, howToAvoid: null, placement: { skill: SKILLS[index], level: levels[round - 1][index],
        reason: 'The submitted answer demonstrates this descriptor.', evidenceQuote: submitted.answers[index] } })),
      summary: 'Diagnostic, not mastery.', advice: 'Continue from the globally demonstrated level.' };
    if (corruptResult) corruptResult(result);
    return { text: JSON.stringify(result) };
  } };
  const examiner = new ExaminerService(prisma, llm);
  const placement = () => new LanguagePlacementService(prisma, experiences, examiner);
  const passport = () => new LearnerPassportService(prisma, { profile: async () => null });
  return { rows, calls, prisma, placement, passport,
    failNextSessionWrite: () => { failNextSessionWrite = true; },
    start: () => placement().start(OWNER, PROFILE, { selfEstimate: 'fluent', idempotencyKey: 'closure-start' }),
    submit: (assessmentId) => placement().submit(OWNER, PROFILE, { assessmentId, answers: [...ANSWERS], idempotencyKey: 'closure-submit' }) };
}

test('full provider fixture → real Examiner → placement → real Passport completes Beginner and resumes canonically', async () => {
  const h = harness();
  const started = await h.start();
  assert.equal(started.assessment.questions.length, 4);
  assert.equal(h.calls.length, 1);
  const assessmentId = started.assessment.id;
  const draft = { assessmentId, answers: [ANSWERS[0], ANSWERS[1], '', ''], currentQuestionIndex: 2, expectedVersion: 0 };
  await h.placement().saveProgress(OWNER, PROFILE, draft);
  const midReload = await h.placement().get(OWNER, PROFILE);
  assert.deepEqual(midReload.progress.answers, draft.answers);
  assert.equal(midReload.progress.currentQuestionIndex, 2);
  assert.equal(midReload.progress.source, 'draft');
  assert.equal(h.calls.length, 1);

  const completed = await h.submit(assessmentId);
  assert.equal(completed.status, 'complete');
  assert.equal(completed.globalLevel, 'A1');
  assert.equal(completed.productLevel, 'BEGINNER');
  assert.equal(completed.oralStatus, 'NOT_EVALUATED');
  assert.equal(completed.nextAction, 'PREPARE_LEARNING_PATH');
  assert.equal(completed.skills.length, 4);
  assert.equal(h.rows.assessmentSubmission[0].masteryGenerationStatus, 'ready');
  assert.deepEqual(h.rows.assessmentSubmission[0].answers, ANSWERS);
  assert.equal(h.rows.assessmentSubmission[0].score, 100, 'A high numerical score does not award Advanced.');
  assert.equal(h.calls.length, 2);

  const passport = await h.passport().get(OWNER);
  const observed = passport.observed.languageProgress[0];
  assert.equal(observed.placement.status, 'complete');
  assert.equal(observed.placement.globalLevel, 'A1');
  assert.equal(observed.placement.productLevel, 'BEGINNER');
  assert.equal(observed.placement.oralStatus, 'NOT_EVALUATED');
  assert.equal(observed.placement.nextAction, 'PREPARE_LEARNING_PATH');
  assert.equal(h.rows.experienceSession[0].currentStep.metadata.languagePlacement.oralStatus, 'NOT_EVALUATED');
  assert.deepEqual(observed.placement.skills.map((item) => item.skill), SKILLS);
  assert.equal(observed.placement.skills.some((item) => ['listening', 'speaking', 'pronunciation'].includes(item.skill)), false,
    'The written-only contract contains no fabricated oral assessment or acoustic score.');
  assert.equal(observed.evaluatedLevel, null, 'Placement is not five-pillar mastery certification.');

  const reconnected = await h.placement().get(OWNER, PROFILE);
  const duplicate = await h.submit(assessmentId);
  const repeatedStart = await h.start();
  for (const result of [reconnected, duplicate, repeatedStart]) {
    assert.equal(result.status, 'complete');
    assert.equal(result.globalLevel, 'A1');
    assert.deepEqual(result.submissionIds, completed.submissionIds);
  }
  assert.deepEqual(reconnected.progress.answers, ANSWERS);
  assert.equal(reconnected.progress.source, 'submission');
  assert.deepEqual((await h.passport().get(OWNER)).observed.languageProgress[0].placement, observed.placement);
  assert.equal(h.calls.length, 2, 'GET, reconnect, duplicate submit and completed start must not regenerate.');
  assert.equal(h.rows.assessmentSubmission.length, 1);
});

test('full invalid provider result fails closed with safe reason and preserves the attempt through Passport/recovery', async () => {
  const h = harness({ corruptResult: (result) => { result.results[0].placement.evidenceQuote = 'invented quotation'; } });
  const started = await h.start();
  await assert.rejects(h.submit(started.assessment.id), (error) => error.code === 'PLACEMENT_RESULT_EVIDENCE_INVALID');
  assert.equal(h.rows.assessmentSubmission[0].masteryGenerationStatus, 'failed');
  assert.deepEqual(h.rows.assessmentSubmission[0].answers, ANSWERS);
  assert.deepEqual(h.rows.assessmentSubmission[0].results, []);
  const recovered = await h.placement().get(OWNER, PROFILE);
  assert.equal(recovered.globalLevel, null);
  assert.equal(recovered.productLevel, null);
  assert.notEqual(recovered.status, 'complete');
  assert.deepEqual(recovered.progress.answers, ANSWERS);
  assert.equal(recovered.progress.source, 'submission');
  assert.equal(recovered.progress.submissionStatus, 'failed');
  const observed = (await h.passport().get(OWNER)).observed.languageProgress[0];
  assert.equal(observed.placement.globalLevel, null);
  assert.equal(observed.placement.productLevel, null);
  assert.equal(observed.evaluatedLevel, null);
  assert.equal(h.calls.length, 2);
  assert.equal(h.rows.assessmentSubmission.length, 1);
});

test('canonical real Examiner result recovers after an interrupted placement projection write without another generation', async () => {
  const h = harness();
  const started = await h.start();
  h.failNextSessionWrite();
  await assert.rejects(h.submit(started.assessment.id), (error) => error.code === 'PLACEMENT_PASSPORT_WRITE_FAILED');
  assert.equal(h.rows.assessmentSubmission[0].masteryGenerationStatus, 'ready');
  assert.deepEqual(h.rows.assessmentSubmission[0].answers, ANSWERS);
  assert.equal(h.rows.experienceSession[0].currentStep.metadata.languagePlacement.status, 'active');
  const recovered = await h.placement().get(OWNER, PROFILE);
  assert.equal(recovered.status, 'complete');
  assert.equal(recovered.productLevel, 'BEGINNER');
  assert.equal(h.rows.experienceSession[0].currentStep.metadata.languagePlacement.status, 'complete');
  const passport = await h.passport().get(OWNER);
  assert.equal(passport.observed.languageProgress[0].placement.productLevel, 'BEGINNER');
  assert.equal(h.calls.length, 2);
  assert.equal(h.rows.assessmentSubmission.length, 1);
});

test('real post-provider chain retains per-skill differences and maps the highest full written consensus', async () => {
  for (const [levels, product, global] of [
    [[['A2', 'A2', 'A2', 'A2'], ['B2', 'B1', 'B2', 'B2']], 'INTERMEDIATE', 'B1'],
    [[['A2', 'A2', 'A2', 'A2'], ['B2', 'B2', 'B2', 'B2'], ['C1', 'C2', 'C2', 'C2']], 'ADVANCED', 'C1'],
  ]) {
    const h = harness({ levels });
    let result;
    for (let round = 1; round <= levels.length; round += 1) {
      const started = await h.start();
      result = await h.submit(started.assessment.id);
    }
    assert.equal(result.status, 'complete');
    assert.equal(result.globalLevel, global);
    assert.equal(result.productLevel, product);
    const observed = (await h.passport().get(OWNER)).observed.languageProgress[0].placement;
    assert.equal(observed.globalLevel, global);
    assert.equal(observed.productLevel, product);
    assert.equal(observed.skills.length, levels.length * 4);
    assert.equal(h.calls.length, levels.length * 2, 'All calls are deterministic in-memory fixtures, not paid providers.');
  }
});
