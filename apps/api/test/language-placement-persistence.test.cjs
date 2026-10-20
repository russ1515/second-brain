'use strict';

require('reflect-metadata');
const test = require('node:test');
const assert = require('node:assert/strict');
const { LanguagePlacementService } = require('../dist/languages/language-placement.service.js');
const { projectLanguagePlacementSummaries } = require('../dist/languages/language-placement-projection.js');
const shared = require('@second-brain/shared');

const OWNER = 'placement-owner';
const PROFILE = 'placement-language';
const SKILLS = shared.LANGUAGE_PLACEMENT_REQUIRED_SKILLS;
const POLICY = shared.LANGUAGE_PLACEMENT_POLICY_VERSION;
const ANSWERS = ['familiar words', 'I can write a sentence', 'the meaning is clear', 'a short written message'];

function harness({ levels = [['A1', 'A2', 'A1', 'A1']], native = false } = {}) {
  const profile = { id: PROFILE, userId: OWNER, language: 'English', normalizedLanguage: 'en',
    cefrLevel: 'C2', mode: 'advanced', teachingLanguageSource: native ? 'native' : 'interface', nativeLanguage: 'Lingala' };
  const sessions = new Map();
  const assessments = new Map();
  const submissions = new Map();
  const calls = { create: 0, grade: 0, write: 0 };
  let rejectNextWrite = false;
  const view = (row) => ({ ...structuredClone(row), links: { languageProfileId: row.languageProfileId } });
  const db = {
    $executeRaw: async () => 1,
    languageProfile: { findFirst: async ({ where }) => where.id === PROFILE && where.userId === OWNER ? profile : null },
    profile: { findUnique: async () => ({ preferredLanguage: 'fr' }) },
    onboardingProfile: { findUnique: async () => ({ extra: { interfaceLanguage: 'fr' } }) },
    experienceSession: {
      findFirst: async ({ where }) => [...sessions.values()].find((row) =>
        Object.entries(where).every(([key, value]) => row[key] === value)) ?? null,
      updateMany: async ({ where, data }) => {
        if (rejectNextWrite) { rejectNextWrite = false; throw new Error('simulated post-submission interruption'); }
        const row = sessions.get(where.id);
        if (!row || row.userId !== where.userId || row.version !== where.version) return { count: 0 };
        Object.assign(row, data, { version: row.version + 1 });
        calls.write += 1;
        return { count: 1 };
      },
    },
    assessmentSubmission: { findMany: async ({ where }) => [...submissions.values()]
      .filter((item) => item.userId === where.userId && where.assessmentId.in.includes(item.assessmentId))
      .map((item) => ({ ...structuredClone(item), assessment: structuredClone(assessments.get(item.assessmentId).row) })) },
  };
  const prisma = { ...db, $transaction: async (callback) => callback(db) };
  const experiences = {
    create: async (userId, request) => {
      let row = [...sessions.values()].find((item) => item.idempotencyKey === request.idempotencyKey && item.userId === userId);
      if (!row) {
        row = { ...structuredClone(request), id: 'placement-session', userId, version: 1, status: 'active',
          languageProfileId: request.links.languageProfileId };
        sessions.set(row.id, row);
      }
      return view(row);
    },
    get: async (userId, id) => {
      const row = sessions.get(id);
      if (!row || row.userId !== userId) throw new Error('Experience not found');
      return view(row);
    },
  };
  function ownedAssessment(userId, id, profileId, sessionId) {
    const item = assessments.get(id);
    if (!item || userId !== OWNER || profileId !== PROFILE || item.scope.placementSessionId !== sessionId) throw new Error('Assessment not found');
    return item;
  }
  function evidence(item, submission) {
    return { submission: { ...structuredClone(submission), createdAt: submission.createdAt.toISOString() },
      skills: item.questions.map((question, index) => ({ policyVersion: POLICY, round: item.scope.round,
        skill: SKILLS[index], level: submission.results[index].placement.level, questionId: question.id,
        assessmentId: item.row.id, submissionId: submission.id,
        reason: submission.results[index].placement.reason, evidenceQuote: submission.results[index].placement.evidenceQuote,
        observedAt: submission.createdAt.toISOString() })) };
  }
  const examiner = {
    createLanguagePlacementOnce: async (userId, input) => {
      assert.equal(userId, OWNER);
      assert.equal(input.targetLanguage, 'English');
      assert.equal(input.supportLanguage, native ? 'Lingala' : 'French');
      const id = `diagnostic-${input.round}`;
      if (!assessments.has(id)) {
        calls.create += 1;
        const scope = { ...input, policyVersion: POLICY, skills: [...SKILLS] };
        const questions = SKILLS.map((skill, index) => ({ id: `${id}-q${index}`, prompt: `${skill} prompt`, format: 'open', points: 10 }));
        assessments.set(id, { scope, questions, row: { id, userId, masteryGenerationStatus: 'ready',
          questions: { version: 2, languagePlacement: scope, questions } } });
      }
      return { id, questions: structuredClone(assessments.get(id).questions), latestSubmission: null };
    },
    languagePlacementAssessment: async (userId, id, profileId, sessionId) => {
      const item = ownedAssessment(userId, id, profileId, sessionId);
      return { id, questions: structuredClone(item.questions), latestSubmission: submissions.has(id)
        ? evidence(item, submissions.get(id)).submission : null };
    },
    languagePlacementSubmissionEvidence: async (userId, id, profileId, sessionId) => {
      const item = ownedAssessment(userId, id, profileId, sessionId);
      return submissions.has(id) ? evidence(item, submissions.get(id)) : null;
    },
    submitLanguagePlacementOnce: async (userId, id, input) => {
      const item = ownedAssessment(userId, id, input.profileId, input.placementSessionId);
      assert.equal(item.scope.round, input.round);
      if (submissions.has(id)) {
        assert.deepEqual(submissions.get(id).answers, input.answers, 'different retry answers are rejected');
        return evidence(item, submissions.get(id));
      }
      calls.grade += 1;
      const submission = { id: `submission-${id}`, assessmentId: id, userId, answers: input.answers,
        // A numeric total is intentionally misleading: diagnostic uses per-skill evidence.
        score: 99, masteryGenerationStatus: 'ready', masterySubmissionKey: `language-placement:${id}`,
        createdAt: new Date(`2026-10-20T12:0${input.round}:00.000Z`),
        results: SKILLS.map((skill, index) => ({ questionId: item.questions[index].id, awarded: 10, max: 10,
          placement: { skill, level: levels[input.round - 1]?.[index] ?? null,
            reason: `Observed ${skill} independently.`, evidenceQuote: input.answers[index] } })),
      };
      submissions.set(id, submission);
      return evidence(item, submission);
    },
  };
  const service = new LanguagePlacementService(prisma, experiences, examiner);
  const start = (selfEstimate = 'unknown') => service.start(OWNER, PROFILE, { selfEstimate, idempotencyKey: 'start-key' });
  const submit = (assessmentId, answers = ANSWERS) => service.submit(OWNER, PROFILE, { assessmentId, answers, idempotencyKey: 'submit-key' });
  return { service, start, submit, calls, profile, sessions, assessments, submissions, prisma,
    failNextSave: () => { rejectNextWrite = true; } };
}

test('no diagnostic means required, not the declared C2, and course entry is blocked', async () => {
  const h = harness();
  const result = await h.service.get(OWNER, PROFILE);
  assert.equal(result.status, 'required');
  assert.equal(result.globalLevel, null);
  assert.equal(result.supportLanguage, 'French');
  await assert.rejects(h.service.requireCourseEntry(OWNER, PROFILE), (error) => error.getResponse().code === 'LANGUAGE_PLACEMENT_REQUIRED');
  assert.deepEqual(h.calls, { create: 0, grade: 0, write: 0 });
});

test('start/reload resumes the same four-question round and preserves self-estimation as context only', async () => {
  const h = harness();
  const first = await h.start('fluent');
  const replay = await h.start('zero');
  assert.equal(first.assessment.id, replay.assessment.id);
  assert.equal(replay.selfEstimate, 'fluent');
  assert.equal(replay.status, 'active');
  assert.equal(replay.globalLevel, null);
  assert.equal(first.assessment.questions.length, 4);
  assert.equal(h.calls.create, 1);
  assert.equal(h.calls.grade, 0);
});

test('actual beginner stays PRE_A1, course entry is A1 without awarding false A1 mastery', async () => {
  const h = harness({ levels: [['PRE_A1', 'A1', 'A2', 'A2']] });
  await h.start('fluent');
  const result = await h.submit('diagnostic-1', ['', ANSWERS[1], ANSWERS[2], ANSWERS[3]]);
  assert.equal(result.globalLevel, 'PRE_A1');
  assert.equal(result.productLevel, 'BEGINNER');
  assert.equal(await h.service.requireCourseEntry(OWNER, PROFILE), 'A1');
  assert.equal(h.profile.cefrLevel, 'C2', 'self-declared profile is never rewritten');
  assert.equal(h.calls.create, 1);
  assert.equal(h.calls.grade, 1);
  assert.equal(h.sessions.size, 1);
});

test('global diagnostic is the weakest required skill, never numeric score or strongest skill', async () => {
  const h = harness({ levels: [['A2', 'A2', 'A1', 'A2']] });
  await h.start();
  const result = await h.submit('diagnostic-1');
  assert.equal(result.globalLevel, 'A1');
  assert.equal(result.skills.find((item) => item.skill === 'reading').level, 'A1');
  assert.equal(result.status, 'complete');
  assert.equal(h.calls.create, 1, 'no escalation unless all four meet the ceiling');
});

test('A2 ceiling schedules explicit round two without hidden generation; B2 ceiling schedules round three', async () => {
  const h = harness({ levels: [Array(4).fill('A2'), Array(4).fill('B2'), Array(4).fill('C2')] });
  await h.start();
  const first = await h.submit('diagnostic-1');
  assert.equal(first.status, 'active');
  assert.equal(first.round, 2);
  assert.equal(first.assessment, null);
  assert.equal(h.calls.create, 1);
  await h.start();
  const second = await h.submit('diagnostic-2');
  assert.equal(second.round, 3);
  assert.equal(second.status, 'active');
  assert.equal(h.calls.create, 2);
  await h.start();
  const third = await h.submit('diagnostic-3');
  assert.equal(third.status, 'complete');
  assert.equal(third.globalLevel, 'C2');
  assert.equal(third.productLevel, 'ADVANCED');
  assert.equal(third.skills.length, 12);
  assert.equal(h.calls.create, 3);
  assert.equal(h.calls.grade, 3);
  await h.start();
  assert.equal(h.calls.create, 3, 'completed diagnostic is never redone on reconnection');
});

test('second round can finish at B1 and preserve its separate per-skill profile', async () => {
  const h = harness({ levels: [Array(4).fill('A2'), ['B2', 'B1', 'B2', 'B2']] });
  await h.start(); await h.submit('diagnostic-1'); await h.start();
  const result = await h.submit('diagnostic-2');
  assert.equal(result.globalLevel, 'B1');
  assert.equal(result.productLevel, 'INTERMEDIATE');
  assert.equal(result.skills.length, 8);
  assert.equal(await h.service.requireCourseEntry(OWNER, PROFILE), 'B1');
});

test('a completed earlier consensus is not erased by harder prompts in a later round', async () => {
  const h = harness({ levels: [Array(4).fill('A2'), ['B1', 'B1', 'A1', 'B1']] });
  await h.start(); await h.submit('diagnostic-1'); await h.start();
  const result = await h.submit('diagnostic-2');
  assert.equal(result.status, 'complete');
  assert.equal(result.globalLevel, 'A2');
  assert.equal(result.productLevel, 'BEGINNER');
  assert.equal(result.skills.find((item) => item.round === 2 && item.skill === 'reading').level, 'A1');
  const summary = (await projectLanguagePlacementSummaries(h.prisma, OWNER,
    [{ id: PROFILE, experienceSessions: [...h.sessions.values()] }])).get(PROFILE);
  assert.equal(summary.globalLevel, 'A2');
});

test('unknown written skill is neutral NOT_EVALUABLE, never an invented score or mastery', async () => {
  const h = harness({ levels: [['A1', 'A1', null, 'A1']] });
  await h.start();
  const result = await h.submit('diagnostic-1');
  assert.equal(result.status, 'not_evaluable');
  assert.equal(result.globalLevel, null);
  assert.equal(result.skills.length, 4);
  await assert.rejects(h.service.requireCourseEntry(OWNER, PROFILE), /diagnostic/);
  await h.start();
  assert.equal(h.calls.create, 1, 'no automatic retry or new assessment');
  assert.equal(h.calls.grade, 1);
});

test('same submission replay adds neither a grading operation nor another diagnostic result', async () => {
  const h = harness();
  await h.start();
  const first = await h.submit('diagnostic-1');
  const replay = await h.submit('diagnostic-1');
  assert.deepEqual(first, replay);
  assert.equal(h.calls.grade, 1);
  assert.equal(replay.submissionIds.length, 1);
  await assert.rejects(h.submit('diagnostic-1', ['changed', ...ANSWERS.slice(1)]), /different retry answers/);
});

test('canonical saved submission recovers after interruption before placement summary is written', async () => {
  const h = harness();
  await h.start();
  h.failNextSave();
  await assert.rejects(h.submit('diagnostic-1'), /simulated post-submission interruption/);
  const reloaded = await h.service.get(OWNER, PROFILE);
  assert.equal(reloaded.status, 'complete');
  assert.equal(reloaded.globalLevel, 'A1');
  assert.equal(h.calls.grade, 1);
  assert.equal(h.submissions.size, 1);
});

test('a cached complete status loses its unlock when the canonical submission disappears', async () => {
  const h = harness(); await h.start(); await h.submit('diagnostic-1');
  h.submissions.clear();
  const result = await h.service.get(OWNER, PROFILE);
  assert.equal(result.status, 'active');
  assert.equal(result.globalLevel, null);
  assert.equal(result.productLevel, null);
  await assert.rejects(h.service.requireCourseEntry(OWNER, PROFILE), /diagnostic/);
  assert.equal(h.calls.grade, 1, 'reconciliation never grades again');
});

test('a cached complete status with no assessment reference cannot unlock a course', async () => {
  const h = harness(); await h.start(); await h.submit('diagnostic-1');
  h.sessions.get('placement-session').currentStep.metadata.languagePlacement.assessmentIds = {};
  const result = await h.service.get(OWNER, PROFILE);
  assert.equal(result.status, 'active');
  assert.equal(result.globalLevel, null);
  await assert.rejects(h.service.requireCourseEntry(OWNER, PROFILE), /diagnostic/);
});

test('owner isolation rejects another account before any generation, grading or session write', async () => {
  const h = harness();
  await assert.rejects(h.service.get('other-user', PROFILE), /profile not found/);
  await assert.rejects(h.service.start('other-user', PROFILE, { selfEstimate: 'zero', idempotencyKey: 'other' }), /profile not found/);
  await assert.rejects(h.service.submit('other-user', PROFILE, { assessmentId: 'foreign', answers: ANSWERS, idempotencyKey: 'other' }), /profile not found/);
  assert.deepEqual(h.calls, { create: 0, grade: 0, write: 0 });
});

test('native support language is resolved independently from the target and persisted profile CEFR', async () => {
  const h = harness({ native: true });
  const result = await h.start();
  assert.equal(result.supportLanguage, 'Lingala');
  assert.equal(result.targetLanguage, 'English');
  assert.equal(result.globalLevel, null);
});

test('Passport projection reads actual owner-scoped skill results, not a fabricated cached global level', async () => {
  const h = harness();
  await h.start(); await h.submit('diagnostic-1');
  const row = h.sessions.get('placement-session');
  row.currentStep.metadata.languagePlacement.globalLevel = 'C2';
  row.currentStep.metadata.languagePlacement.productLevel = 'ADVANCED';
  const rows = [{ id: PROFILE, experienceSessions: [row] }];
  const projected = (await projectLanguagePlacementSummaries(h.prisma, OWNER, rows)).get(PROFILE);
  assert.equal(projected.status, 'complete');
  assert.equal(projected.globalLevel, 'A1');
  assert.equal(projected.productLevel, 'BEGINNER');
  assert.equal(projected.skills.length, 4);
  assert.equal(projected.skills[0].submissionId, 'submission-diagnostic-1');
  assert.equal(projected.selfEstimate, 'unknown');
  const foreign = await projectLanguagePlacementSummaries(h.prisma, 'another-user', rows);
  assert.equal(foreign.size, 0);
});

test('Passport projection rejects a missing, repeated, wrong-skill or ungrounded canonical result', async (t) => {
  for (const fault of ['missing', 'duplicate', 'wrong-skill', 'invented-quote']) {
    await t.test(fault, async () => {
      const h = harness(); await h.start(); await h.submit('diagnostic-1');
      const submission = h.submissions.get('diagnostic-1');
      if (fault === 'missing') submission.results.pop();
      if (fault === 'duplicate') submission.results[3].questionId = submission.results[0].questionId;
      if (fault === 'wrong-skill') submission.results[0].placement.skill = 'writing';
      if (fault === 'invented-quote') submission.results[0].placement.evidenceQuote = 'not present in learner answer';
      const summary = (await projectLanguagePlacementSummaries(h.prisma, OWNER,
        [{ id: PROFILE, experienceSessions: [...h.sessions.values()] }])).get(PROFILE);
      assert.equal(summary.status, 'not_evaluable');
      assert.equal(summary.globalLevel, null);
    });
  }
});

test('saved state remains compact references, never embeds learner answers or full assessment output', async () => {
  const h = harness(); await h.start(); await h.submit('diagnostic-1');
  const state = h.sessions.get('placement-session').currentStep.metadata.languagePlacement;
  assert.ok(JSON.stringify(state).length < 2_000);
  assert.equal(state.answers, undefined);
  assert.equal(state.skills, undefined);
  assert.equal(state.assessment, undefined);
  assert.deepEqual(state.assessmentIds, { 1: 'diagnostic-1' });
});
