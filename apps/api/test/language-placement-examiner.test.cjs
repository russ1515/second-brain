'use strict';

require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');
const { ExaminerService } = require('../dist/examiner/examiner.service.js');
const { LlmService } = require('../dist/llm/llm.service.js');
const shared = require('@second-brain/shared');

const OWNER = 'placement-owner';
const PROFILE = 'placement-profile';
const SESSION = 'placement-session';
const SKILLS = ['vocabulary', 'grammar', 'reading', 'writing'];
const ANSWERS = [
  'I know the word apple.',
  'She works every day.',
  'The train leaves at six.',
  'My name is Ada. I live here.',
];

function matches(row, where = {}) {
  return Object.entries(where).every(([key, expected]) => {
    if (key === 'OR') return expected.some((candidate) => matches(row, candidate));
    if (key === 'AND') return expected.every((candidate) => matches(row, candidate));
    const actual = row[key];
    if (expected instanceof Date) return actual instanceof Date && actual.getTime() === expected.getTime();
    return actual === expected;
  });
}

function generationPayload() {
  return {
    questions: SKILLS.map((skill) => ({
      diagnosticSkill: skill,
      prompt: `Independent ${skill} task with complete material.`,
      format: 'open', points: 10,
      answerKey: `Private ${skill} answer key.`,
      rubric: `Evaluate independent ${skill} evidence using the CEFR descriptors.`,
    })),
  };
}

function fixture(options = {}) {
  const rows = { assessments: [], submissions: [] };
  const calls = [];
  const stats = { creates: 0, grades: 0, completionWrites: 0, locks: 0 };
  let transactionTail = Promise.resolve();
  const clone = (row) => row ? { ...row } : null;
  function table(name, prefix) {
    return {
      create: async ({ data }) => {
        const row = { id: `${prefix}-${rows[name].length + 1}`, createdAt: new Date(), ...data };
        rows[name].push(row);
        return clone(row);
      },
      findFirst: async ({ where }) => clone(rows[name].find((row) => matches(row, where))),
      findUnique: async ({ where }) => clone(rows[name].find((row) => matches(row, where))),
      findMany: async ({ where = {} } = {}) => rows[name].filter((row) => matches(row, where)).map(clone),
      update: async ({ where, data }) => {
        const row = rows[name].find((candidate) => matches(candidate, where));
        assert.ok(row, `${name}: update target must exist`);
        Object.assign(row, data);
        return clone(row);
      },
      updateMany: async ({ where, data }) => {
        const found = rows[name].filter((row) => matches(row, where));
        found.forEach((row) => Object.assign(row, data));
        return { count: found.length };
      },
    };
  }
  const prisma = {
    $executeRaw: async () => { stats.locks += 1; return 0; },
    languageProfile: {
      findFirst: async ({ where }) => matches({ id: PROFILE, userId: OWNER }, where)
        ? { id: PROFILE, userId: OWNER, language: options.targetLanguage || 'English' } : null,
    },
    experienceSession: {
      findFirst: async ({ where }) => matches({ id: SESSION, userId: OWNER, languageProfileId: PROFILE, intent: 'language-placement' }, where)
        ? { id: SESSION, userId: OWNER, languageProfileId: PROFILE, intent: 'language-placement' } : null,
    },
    profile: { findUnique: async () => ({ preferredLanguage: 'fr' }) },
    onboardingProfile: { findUnique: async () => null },
    assessment: table('assessments', 'placement-assessment'),
    assessmentSubmission: table('submissions', 'placement-submission'),
    learningCompletion: {
      create: async () => { stats.completionWrites += 1; throw new Error('Placement must never award mastery.'); },
      upsert: async () => { stats.completionWrites += 1; throw new Error('Placement must never award mastery.'); },
    },
  };
  prisma.$transaction = (callback) => {
    const result = transactionTail.then(() => callback(prisma));
    transactionTail = result.then(() => undefined, () => undefined);
    return result;
  };
  const llm = {
    generate: async (messages, callOptions) => {
      calls.push({ messages, options: callOptions });
      const isGrade = messages.some((message) => message.content.includes('learnerAnswer'));
      if (!isGrade) {
        stats.creates += 1;
        const payload = generationPayload();
        if (options.generation) options.generation(payload);
        return { text: JSON.stringify(payload) };
      }
      stats.grades += 1;
      const assessment = rows.assessments.find((row) => row.masteryGenerationStatus === 'ready');
      const answers = rows.submissions.at(-1).answers;
      const payload = {
        results: assessment.questions.questions.map((question, index) => ({
          questionId: question.id,
          awarded: options.awarded ?? 9,
          verdict: 'correct', why: 'Independent answer observed.', how: 'Keep practising the same skill.',
          errorMade: null, howToAvoid: null,
          placement: {
            skill: SKILLS[index], level: options.level ?? 'A1', reason: 'The response meets the stated descriptor.',
            evidenceQuote: answers[index],
          },
        })),
        summary: 'Diagnostic observations only.', advice: 'Begin at the demonstrated level.',
      };
      if (options.grading) options.grading(payload);
      return { text: options.gradingText ? options.gradingText(payload) : JSON.stringify(payload) };
    },
  };
  const service = new ExaminerService(prisma, llm);
  const createInput = (patch = {}) => ({
    profileId: PROFILE, placementSessionId: SESSION, round: 1,
    targetLanguage: options.targetLanguage || 'English', supportLanguage: options.supportLanguage || 'Français',
    idempotencyKey: 'placement-create-1', ...patch,
  });
  const submitInput = (patch = {}) => ({
    profileId: PROFILE, placementSessionId: SESSION, round: 1,
    answers: [...ANSWERS], idempotencyKey: 'placement-submit-1', ...patch,
  });
  return { service, rows, calls, stats, createInput, submitInput };
}

function httpStatus(expected) {
  return (error) => error?.getStatus?.() === expected;
}

async function assertNotEvaluable(options) {
  const f = fixture(options);
  const assessment = await f.service.createLanguagePlacementOnce(OWNER, f.createInput());
  try {
    const result = await f.service.submitLanguagePlacementOnce(OWNER, assessment.id, f.submitInput());
    assert.equal(shared.projectLanguagePlacementRound({ round: 1, skills: result.skills }).status, 'not_evaluable');
  } catch (error) {
    assert.ok([422, 503].includes(error?.getStatus?.()), 'Invalid provider evidence must fail explicitly, not become a level.');
  }
  assert.equal(f.stats.grades, 1);
  assert.equal(f.stats.completionWrites, 0);
}

test('placement creates exactly four private-keyed questions and persists the complete owner-scoped metadata', async () => {
  const f = fixture();
  const assessment = await f.service.createLanguagePlacementOnce(OWNER, f.createInput());
  assert.equal(assessment.questions.length, 4);
  assert.equal(f.rows.assessments.length, 1);
  const row = f.rows.assessments[0];
  assert.deepEqual(row.questions.languagePlacement.skills, SKILLS);
  assert.deepEqual({ ...row.questions.languagePlacement, createdAt: undefined }, {
    policyVersion: shared.LANGUAGE_PLACEMENT_POLICY_VERSION,
    profileId: PROFILE, placementSessionId: SESSION, round: 1,
    targetLanguage: 'English', supportLanguage: 'Français', skills: SKILLS, createdAt: undefined,
  });
  assert.ok(row.questions.questions.every((question) => question.answerKey && question.rubric));
  assert.equal(/answerKey|rubric|Private vocabulary/.test(JSON.stringify(assessment)), false);
  assert.equal(f.calls[0].options.operation, 'language-placement');
  assert.equal(f.stats.completionWrites, 0);
});

test('the target and support language are supplied independently to generation without an English-only branch', async () => {
  for (const pair of [['日本語', 'Lingala'], ['Lingala', 'Français'], ['العربية', 'Svenska']]) {
    const f = fixture({ targetLanguage: pair[0], supportLanguage: pair[1] });
    await f.service.createLanguagePlacementOnce(OWNER, f.createInput());
    const prompt = f.calls[0].messages.map((item) => item.content).join('\n');
    assert.ok(prompt.includes(pair[0]));
    assert.ok(prompt.includes(pair[1]));
    assert.equal(f.rows.assessments[0].questions.languagePlacement.targetLanguage, pair[0]);
    assert.equal(f.rows.assessments[0].questions.languagePlacement.supportLanguage, pair[1]);
  }
});

test('creation replay uses the same persistent assessment and performs no second generation', async () => {
  const f = fixture();
  const first = await f.service.createLanguagePlacementOnce(OWNER, f.createInput());
  const second = await f.service.createLanguagePlacementOnce(OWNER, f.createInput({ idempotencyKey: 'different-client-retry' }));
  assert.equal(first.id, second.id);
  assert.equal(f.stats.creates, 1);
  assert.equal(f.rows.assessments.length, 1);
});

test('a creation replay with changed immutable language scope is rejected without a new call', async () => {
  const f = fixture();
  await f.service.createLanguagePlacementOnce(OWNER, f.createInput());
  await assert.rejects(f.service.createLanguagePlacementOnce(OWNER, f.createInput({ supportLanguage: 'Lingala' })), httpStatus(409));
  assert.equal(f.stats.creates, 1);
});

test('creation refuses foreign owner, profile and placement session before any provider call', async () => {
  for (const [owner, patch] of [['other-owner', {}], [OWNER, { profileId: 'other-profile' }], [OWNER, { placementSessionId: 'other-session' }]]) {
    const f = fixture();
    await assert.rejects(f.service.createLanguagePlacementOnce(owner, f.createInput(patch)), httpStatus(404));
    assert.equal(f.calls.length, 0);
    assert.equal(f.rows.assessments.length, 0);
  }
});

test('the assessment is rejected if the provider omits a required question', async () => {
  const f = fixture({ generation: (payload) => payload.questions.pop() });
  await assert.rejects(f.service.createLanguagePlacementOnce(OWNER, f.createInput()), httpStatus(503));
  assert.equal(f.stats.creates, 1);
  assert.equal(f.rows.assessments[0].masteryGenerationStatus, 'failed');
});

test('the assessment is rejected if the provider adds a fifth question', async () => {
  const f = fixture({ generation: (payload) => payload.questions.push({ ...payload.questions[0] }) });
  await assert.rejects(f.service.createLanguagePlacementOnce(OWNER, f.createInput()), httpStatus(503));
  assert.equal(f.stats.creates, 1);
});

test('a missing private answer key or rubric is rejected, never exposed as an ungradable diagnostic', async () => {
  for (const key of ['answerKey', 'rubric']) {
    const f = fixture({ generation: (payload) => { payload.questions[0][key] = ''; } });
    await assert.rejects(f.service.createLanguagePlacementOnce(OWNER, f.createInput()), httpStatus(503));
    assert.equal(f.stats.creates, 1);
  }
});

test('missing, duplicate or misordered diagnostic skill labels cannot be assigned a false four-skill coverage', async () => {
  for (const generation of [
    (payload) => { delete payload.questions[0].diagnosticSkill; },
    (payload) => { payload.questions[1].diagnosticSkill = 'vocabulary'; },
    (payload) => { [payload.questions[0], payload.questions[1]] = [payload.questions[1], payload.questions[0]]; },
  ]) {
    const f = fixture({ generation });
    await assert.rejects(f.service.createLanguagePlacementOnce(OWNER, f.createInput()), httpStatus(503));
    assert.equal(f.stats.creates, 1);
    assert.equal(f.rows.assessments[0].masteryGenerationStatus, 'failed');
  }
});

test('graded observations use canonical persisted IDs, never provider-supplied identities', async () => {
  const f = fixture({ grading: (payload) => {
    payload.results.forEach((result) => Object.assign(result.placement, {
      assessmentId: 'forged-assessment', submissionId: 'forged-submission', questionId: 'forged-question',
    }));
  } });
  const assessment = await f.service.createLanguagePlacementOnce(OWNER, f.createInput());
  const result = await f.service.submitLanguagePlacementOnce(OWNER, assessment.id, f.submitInput());
  assert.equal(result.skills.length, 4);
  for (const [index, observation] of result.skills.entries()) {
    assert.equal(observation.questionId, assessment.questions[index].id);
    assert.equal(observation.assessmentId, assessment.id);
    assert.equal(observation.submissionId, result.submission.id);
    assert.equal(observation.policyVersion, shared.LANGUAGE_PLACEMENT_POLICY_VERSION);
    assert.equal(observation.skill, SKILLS[index]);
    assert.equal(observation.round, 1);
    assert.equal(observation.evidenceQuote, ANSWERS[index]);
  }
  assert.equal(f.stats.completionWrites, 0);
});

test('a score of 90 or 100 does not classify the learner as advanced or grant mastery', async () => {
  for (const awarded of [9, 10]) {
    const f = fixture({ awarded, level: 'A1' });
    const assessment = await f.service.createLanguagePlacementOnce(OWNER, f.createInput());
    const result = await f.service.submitLanguagePlacementOnce(OWNER, assessment.id, f.submitInput());
    assert.equal(result.submission.score, awarded * 10);
    const projected = shared.projectLanguagePlacementRound({ round: 1, skills: result.skills });
    assert.equal(projected.globalLevel, 'A1');
    assert.equal(projected.productLevel, 'BEGINNER');
    assert.equal(f.stats.completionWrites, 0);
  }
});

test('identical answers replay the existing submission and do not invoke the grader again', async () => {
  const f = fixture();
  const assessment = await f.service.createLanguagePlacementOnce(OWNER, f.createInput());
  const first = await f.service.submitLanguagePlacementOnce(OWNER, assessment.id, f.submitInput());
  const second = await f.service.submitLanguagePlacementOnce(OWNER, assessment.id, f.submitInput({ idempotencyKey: 'another-retry-key' }));
  assert.deepEqual(first, second);
  assert.equal(f.stats.grades, 1);
  assert.equal(f.rows.submissions.length, 1);
});

test('different answers after a persisted submission conflict without a second grading call', async () => {
  const f = fixture();
  const assessment = await f.service.createLanguagePlacementOnce(OWNER, f.createInput());
  await f.service.submitLanguagePlacementOnce(OWNER, assessment.id, f.submitInput());
  await assert.rejects(f.service.submitLanguagePlacementOnce(OWNER, assessment.id,
    f.submitInput({ answers: ['Changed', ...ANSWERS.slice(1)] })), httpStatus(409));
  assert.equal(f.stats.grades, 1);
});

test('the generic submit route cannot bypass placement claims and idempotence', async () => {
  const f = fixture();
  const assessment = await f.service.createLanguagePlacementOnce(OWNER, f.createInput());
  await assert.rejects(f.service.submit(OWNER, assessment.id, ANSWERS), httpStatus(409));
  assert.equal(f.stats.grades, 0);
  assert.equal(f.rows.submissions.length, 0);
});

test('read, result recovery and submit all enforce owner/profile/session scope', async () => {
  const f = fixture();
  const assessment = await f.service.createLanguagePlacementOnce(OWNER, f.createInput());
  for (const [owner, profileId, sessionId] of [
    ['other-owner', PROFILE, SESSION], [OWNER, 'other-profile', SESSION], [OWNER, PROFILE, 'other-session'],
  ]) {
    await assert.rejects(f.service.languagePlacementAssessment(owner, assessment.id, profileId, sessionId), httpStatus(404));
    await assert.rejects(f.service.languagePlacementSubmissionEvidence(owner, assessment.id, profileId, sessionId), httpStatus(404));
    await assert.rejects(f.service.submitLanguagePlacementOnce(owner, assessment.id,
      f.submitInput({ profileId, placementSessionId: sessionId })), httpStatus(404));
  }
  assert.equal(f.stats.grades, 0);
});

test('a persisted result is recovered by a fresh Examiner instance without another provider call', async () => {
  const f = fixture();
  const assessment = await f.service.createLanguagePlacementOnce(OWNER, f.createInput());
  const first = await f.service.submitLanguagePlacementOnce(OWNER, assessment.id, f.submitInput());
  // A fresh instance reads the same durable rows; its provider must never run.
  const fresh = new ExaminerService(f.service.prisma, { generate: async () => { throw new Error('Unexpected provider call on recovery.'); } });
  const recovered = await fresh.languagePlacementSubmissionEvidence(OWNER, assessment.id, PROFILE, SESSION);
  assert.deepEqual(recovered, first);
  const publicView = await fresh.languagePlacementAssessment(OWNER, assessment.id, PROFILE, SESSION);
  assert.equal(publicView.latestSubmission.id, first.submission.id);
  assert.equal(/answerKey|Private vocabulary/.test(JSON.stringify(publicView)), false);
});

test('ready-result recovery rejects a tampered quote, mismatched skill or malformed canonical result without regrading', async () => {
  for (const tamper of [
    (row) => { row.results[0].placement.evidenceQuote = 'An invented quotation absent from the real answer.'; },
    (row) => { row.results[1].placement.skill = 'vocabulary'; },
    (row) => { row.results[1].questionId = row.results[0].questionId; },
    (row) => { row.results[0].max = 999; },
  ]) {
    const f = fixture();
    const assessment = await f.service.createLanguagePlacementOnce(OWNER, f.createInput());
    await f.service.submitLanguagePlacementOnce(OWNER, assessment.id, f.submitInput());
    tamper(f.rows.submissions[0]);
    await assert.rejects(f.service.languagePlacementSubmissionEvidence(OWNER, assessment.id, PROFILE, SESSION), httpStatus(503));
    await assert.rejects(f.service.languagePlacementAssessment(OWNER, assessment.id, PROFILE, SESSION), httpStatus(503));
    assert.equal(f.stats.grades, 1);
    assert.equal(f.stats.completionWrites, 0);
  }
});

test('ready-result recovery and idempotent replay both refuse results discordant with the canonical saved answers', async () => {
  const f = fixture();
  const assessment = await f.service.createLanguagePlacementOnce(OWNER, f.createInput());
  await f.service.submitLanguagePlacementOnce(OWNER, assessment.id, f.submitInput());
  f.rows.submissions[0].answers = ['A discordant canonical answer.', ...ANSWERS.slice(1)];
  await assert.rejects(f.service.languagePlacementSubmissionEvidence(OWNER, assessment.id, PROFILE, SESSION), httpStatus(503));
  await assert.rejects(f.service.submitLanguagePlacementOnce(OWNER, assessment.id, f.submitInput()), httpStatus(503));
  assert.equal(f.stats.grades, 1);
  assert.equal(f.rows.submissions.length, 1);
  assert.equal(f.stats.completionWrites, 0);
});

test('incomplete grading cannot manufacture missing skill levels', async () => {
  await assertNotEvaluable({ grading: (payload) => payload.results.pop() });
});

test('duplicate question results cannot silently overwrite a diagnostic skill', async () => {
  await assertNotEvaluable({ grading: (payload) => { payload.results[1].questionId = payload.results[0].questionId; } });
});

test('missing CEFR descriptors, duplicate skills and null observations never acquire a default A1', async () => {
  for (const grading of [
    (payload) => { delete payload.results[0].placement.level; },
    (payload) => { payload.results[0].placement.level = null; },
    (payload) => { payload.results[0].placement.level = 'UNKNOWN'; },
    (payload) => { payload.results[1].placement.skill = 'vocabulary'; },
  ]) await assertNotEvaluable({ grading });
});

test('a fabricated quote absent from the submitted answer cannot support a level', async () => {
  await assertNotEvaluable({ grading: (payload) => { payload.results[0].placement.evidenceQuote = 'This phrase never occurred in the answer.'; } });
});

test('placement grading advertises one complete contract with evidence nested in every result', async () => {
  const f = fixture();
  const assessment = await f.service.createLanguagePlacementOnce(OWNER, f.createInput());
  await f.service.submitLanguagePlacementOnce(OWNER, assessment.id, f.submitInput());
  const prompt = f.calls[1].messages.find((message) => message.role === 'user').content;
  const contract = prompt.split('Return ONLY JSON: ')[1].split('Language placement policy:')[0];
  for (const field of ['questionId', 'awarded', 'verdict', 'placement', 'skill', 'level', 'reason', 'evidenceQuote']) {
    assert.ok(contract.includes(`"${field}"`), `The main results contract must include ${field}.`);
  }
  assert.equal((prompt.match(/Return ONLY JSON:/g) || []).length, 1);
  assert.ok(prompt.includes('Copy each input id verbatim into questionId'));
  assert.ok(prompt.includes('Do not translate JSON property names, skill identifiers or CEFR values'));
});

test('following the old advertised main JSON shape reproduces an explicit missing-evidence rejection', async () => {
  const f = fixture({ grading: (payload) => { payload.results.forEach((result) => { delete result.placement; }); } });
  const assessment = await f.service.createLanguagePlacementOnce(OWNER, f.createInput());
  await assert.rejects(f.service.submitLanguagePlacementOnce(OWNER, assessment.id, f.submitInput()), (error) => {
    assert.equal(error.getStatus(), 503);
    assert.equal(error.code, 'PLACEMENT_RESULT_SKILL_INVALID');
    return true;
  });
  assert.equal(f.rows.submissions[0].masteryGenerationStatus, 'failed');
  assert.deepEqual(f.rows.submissions[0].answers, ANSWERS);
  assert.equal(f.stats.grades, 1);
  assert.equal(f.stats.completionWrites, 0);
});

test('placement accepts complete JSON and fenced shuffled result order with exact canonical evidence', async () => {
  for (const gradingText of [
    (payload) => JSON.stringify(payload),
    (payload) => '```json\n' + JSON.stringify({ ...payload, results: [...payload.results].reverse() }) + '\n```',
  ]) {
    const f = fixture({ gradingText });
    const assessment = await f.service.createLanguagePlacementOnce(OWNER, f.createInput());
    const result = await f.service.submitLanguagePlacementOnce(OWNER, assessment.id, f.submitInput());
    assert.deepEqual(result.skills.map((item) => item.skill), SKILLS);
    assert.deepEqual(result.skills.map((item) => item.evidenceQuote), ANSWERS);
    assert.equal(shared.projectLanguagePlacementRound({ round: 1, skills: result.skills }).productLevel, 'BEGINNER');
    assert.equal(f.stats.grades, 1);
  }
});

test('every invalid placement provider contract has a precise safe reason and preserves the failed attempt', async () => {
  const cases = [
    ['PLACEMENT_RESULT_JSON_INVALID', { gradingText: () => '{"results":[' }],
    ['PLACEMENT_RESULT_STRUCTURE_INVALID', { gradingText: () => '{"results":{}}' }],
    ['PLACEMENT_RESULT_QUESTION_IDS_INVALID', { grading: (p) => { p.results.pop(); } }],
    ['PLACEMENT_RESULT_QUESTION_IDS_INVALID', { grading: (p) => { p.results[1].questionId = p.results[0].questionId; } }],
    ['PLACEMENT_RESULT_QUESTION_IDS_INVALID', { grading: (p) => { p.results[0].questionId = 'unrecognized-id'; } }],
    ['PLACEMENT_RESULT_SKILL_INVALID', { grading: (p) => { p.results[0].placement.skill = 'reading'; } }],
    ['PLACEMENT_RESULT_CEFR_INVALID', { grading: (p) => { delete p.results[0].placement.level; } }],
    ['PLACEMENT_RESULT_CEFR_INVALID', { grading: (p) => { p.results[0].placement.level = 'a1'; } }],
    ['PLACEMENT_RESULT_CEFR_ABOVE_CEILING', { grading: (p) => { p.results[0].placement.level = 'B1'; } }],
    ['PLACEMENT_RESULT_REASON_INVALID', { grading: (p) => { p.results[0].placement.reason = ''; } }],
    ['PLACEMENT_RESULT_EVIDENCE_INVALID', { grading: (p) => { p.results[0].placement.evidenceQuote = 'invented evidence'; } }],
    ['PLACEMENT_RESULT_EVIDENCE_INVALID', { grading: (p) => { p.results[0].placement.evidenceQuote = null; } }],
    ['PLACEMENT_RESULT_SCORE_INVALID', { grading: (p) => { p.results[0].awarded = '9'; } }],
    ['PLACEMENT_RESULT_SCORE_INVALID', { grading: (p) => { p.results[0].awarded = 10.1; } }],
    ['PLACEMENT_RESULT_VERDICT_INVALID', { grading: (p) => { p.results[0].verdict = 'passed'; } }],
  ];
  for (const [code, options] of cases) {
    const f = fixture(options);
    const assessment = await f.service.createLanguagePlacementOnce(OWNER, f.createInput());
    await assert.rejects(f.service.submitLanguagePlacementOnce(OWNER, assessment.id, f.submitInput()), (error) => {
      assert.equal(error.getStatus(), 503, code);
      assert.equal(error.code, code);
      assert.ok(!JSON.stringify(error.getResponse()).includes(ANSWERS[0]));
      return true;
    });
    assert.equal(f.rows.submissions[0].masteryGenerationStatus, 'failed');
    assert.deepEqual(f.rows.submissions[0].answers, ANSWERS);
    assert.equal(f.rows.submissions[0].results.length, 0);
    assert.equal(f.stats.grades, 1);
    assert.equal(f.stats.completionWrites, 0);
  }
});

test('placement provider failure exposes only a safe reason and never attempts another call', async () => {
  const f = fixture();
  const assessment = await f.service.createLanguagePlacementOnce(OWNER, f.createInput());
  let calls = 0;
  f.service.llm.generate = async () => { calls += 1; throw new Error('PRIVATE_PROVIDER_DETAIL'); };
  await assert.rejects(f.service.submitLanguagePlacementOnce(OWNER, assessment.id, f.submitInput()), (error) => {
    assert.equal(error.code, 'PLACEMENT_PROVIDER_UNAVAILABLE');
    assert.equal(JSON.stringify(error.getResponse()).includes('PRIVATE_PROVIDER_DETAIL'), false);
    return true;
  });
  assert.equal(calls, 1);
  assert.equal(f.rows.submissions[0].masteryGenerationStatus, 'failed');
  assert.deepEqual(f.rows.submissions[0].answers, ANSWERS);
});

test('a failed canonical result write has a persistence reason and preserves answers without a level', async () => {
  const f = fixture();
  const assessment = await f.service.createLanguagePlacementOnce(OWNER, f.createInput());
  const original = f.service.prisma.assessmentSubmission.updateMany;
  f.service.prisma.assessmentSubmission.updateMany = async (input) => {
    if (input.data.masteryGenerationStatus === 'ready') throw new Error('PRIVATE_DATABASE_DETAIL');
    return original(input);
  };
  await assert.rejects(f.service.submitLanguagePlacementOnce(OWNER, assessment.id, f.submitInput()), (error) => {
    assert.equal(error.code, 'PLACEMENT_PERSISTENCE_FAILED');
    assert.equal(JSON.stringify(error.getResponse()).includes('PRIVATE_DATABASE_DETAIL'), false);
    return true;
  });
  assert.equal(f.rows.submissions[0].masteryGenerationStatus, 'failed');
  assert.deepEqual(f.rows.submissions[0].answers, ANSWERS);
  assert.deepEqual(f.rows.submissions[0].results, []);
  assert.equal(f.stats.grades, 1);
  assert.equal(f.stats.completionWrites, 0);
});

test('canonical evidence corruption reports its own safe reason without regrading', async () => {
  for (const corrupt of [
    (row) => { row.results[0] = null; },
    (row) => { row.results[0].verdict = 'passed'; },
    (row) => { row.results[0].placement.evidenceQuote = 'absent quote'; },
  ]) {
    const f = fixture();
    const assessment = await f.service.createLanguagePlacementOnce(OWNER, f.createInput());
    await f.service.submitLanguagePlacementOnce(OWNER, assessment.id, f.submitInput());
    corrupt(f.rows.submissions[0]);
    await assert.rejects(f.service.languagePlacementSubmissionEvidence(OWNER, assessment.id, PROFILE, SESSION), (error) => {
      assert.equal(error.code, 'PLACEMENT_CANONICAL_EVIDENCE_INVALID');
      return true;
    });
    assert.equal(f.stats.grades, 1);
  }
});

test('diagnostic input requires exactly four answers and the correct round before grading', async () => {
  const f = fixture();
  const assessment = await f.service.createLanguagePlacementOnce(OWNER, f.createInput());
  for (const patch of [{ answers: ANSWERS.slice(1) }, { answers: [...ANSWERS, 'extra'] }, { round: 2 }]) {
    await assert.rejects(f.service.submitLanguagePlacementOnce(OWNER, assessment.id, f.submitInput(patch)), httpStatus(400));
  }
  assert.equal(f.stats.grades, 0);
});

test('language-placement uses the central LANGUAGE_TEXT/AI_TEXT meter and a zero-retry policy', () => {
  const service = new LlmService({}, {});
  assert.equal(service.policy('language-placement', 'openai').retries, 0);
  assert.equal(service.costFeatureFor('language-placement'), 'LANGUAGE_TEXT');
  assert.equal(service.resourceFor('language-placement'), 'AI_TEXT');
});

test('a transient provider failure on placement is attempted exactly once without a fallback', async () => {
  let providerCalls = 0;
  const provider = {
    name: 'openai',
    generate: async () => { providerCalls += 1; throw Object.assign(new Error('Provider overload'), { status: 503 }); },
  };
  const metrics = { recordAiCall() {}, captureError() {} };
  const service = new LlmService({ pickProvider: () => provider }, metrics);
  await assert.rejects(service.generate([{ role: 'user', content: 'Bounded diagnostic.' }], { operation: 'language-placement' }));
  assert.equal(providerCalls, 1);
});
