'use strict';

require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');
const { ExaminerService } = require('../dist/examiner/examiner.service.js');

const STALE_CLAIM = new Date('2000-01-01T00:00:00.000Z');

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, resolve, reject };
}

async function eventually(predicate, message) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setImmediate(resolve));
  }
  assert.fail(message);
}

function generationPayload(prompt) {
  return JSON.stringify({
    questions: [{
      prompt,
      format: 'open',
      points: 1,
      answerKey: 'Server-only answer key',
      rubric: 'Award one point for an independent answer.',
    }],
  });
}

function gradingPayload(summary) {
  return JSON.stringify({ results: [], summary, advice: summary + ' advice' });
}

function masteryMetadata() {
  return {
    policyVersion: 'mastery-policy-test-v1',
    profileId: 'profile-1',
    courseSessionId: 'course-session-1',
    unitId: 'unit-1',
    lessonId: 'lesson-1',
    attemptId: 'attempt-1',
    criterionIds: ['criterion-1'],
  };
}

function createRequest() {
  return {
    userId: 'user-1',
    dto: { type: 'open', topic: 'Independent production', questionCount: 1 },
    internal: {
      languageMastery: masteryMetadata(),
      lessonId: 'lesson-1',
      contentVersion: 4,
      masteryCreationKey: 'attempt-1',
    },
  };
}

function matches(row, where) {
  return Object.entries(where ?? {}).every(([key, expected]) => {
    if (key === 'OR') return expected.some((candidate) => matches(row, candidate));
    const actual = row[key];
    if (expected instanceof Date) {
      return actual instanceof Date && actual.getTime() === expected.getTime();
    }
    return actual === expected;
  });
}

function memoryFixture(options = {}) {
  const rows = { assessments: [], submissions: [] };
  const stats = {
    advisoryLocks: 0,
    assessmentCreates: 0,
    submissionCreates: 0,
    assessmentGenerations: 0,
    gradingCalls: 0,
    fencedAssessmentWrites: 0,
    fencedSubmissionWrites: 0,
  };
  let assessmentSequence = 0;
  let submissionSequence = 0;
  let transactionTail = Promise.resolve();

  const clone = (row) => row ? { ...row } : null;
  const prisma = {
    $executeRaw: async () => {
      stats.advisoryLocks += 1;
      return 0;
    },
    lesson: {
      findFirst: async ({ where }) => (
        where.id === 'lesson-1' && where.userId === 'user-1'
          ? { id: 'lesson-1', contentVersion: 4 }
          : null
      ),
    },
    profile: { findUnique: async () => ({ preferredLanguage: 'en' }) },
    onboardingProfile: { findUnique: async () => null },
    assessment: {
      create: async ({ data }) => {
        stats.assessmentCreates += 1;
        const row = {
          id: 'assessment-' + (++assessmentSequence),
          createdAt: new Date(),
          ...data,
          masteryGenerationClaimedAt: options.staleAssessmentClaim
            ? STALE_CLAIM
            : data.masteryGenerationClaimedAt,
        };
        rows.assessments.push(row);
        return clone(row);
      },
      findFirst: async ({ where }) => clone(
        rows.assessments.find((row) => matches(row, where)) ?? null,
      ),
      findUnique: async ({ where }) => clone(
        rows.assessments.find((row) => matches(row, where)) ?? null,
      ),
      update: async ({ where, data }) => {
        const row = rows.assessments.find((candidate) => matches(candidate, where));
        if (!row) throw new Error('assessment not found');
        Object.assign(row, data);
        return clone(row);
      },
      updateMany: async ({ where, data }) => {
        const found = rows.assessments.filter((row) => matches(row, where));
        found.forEach((row) => Object.assign(row, data));
        if (data.masteryGenerationStatus === 'ready' && found.length === 0) {
          stats.fencedAssessmentWrites += 1;
        }
        return { count: found.length };
      },
    },
    assessmentSubmission: {
      create: async ({ data }) => {
        stats.submissionCreates += 1;
        const row = {
          id: 'submission-' + (++submissionSequence),
          createdAt: new Date(),
          ...data,
          masteryGenerationClaimedAt: options.staleSubmissionClaim
            ? STALE_CLAIM
            : data.masteryGenerationClaimedAt,
        };
        rows.submissions.push(row);
        return clone(row);
      },
      findFirst: async ({ where }) => clone(
        rows.submissions.find((row) => matches(row, where)) ?? null,
      ),
      update: async ({ where, data }) => {
        const row = rows.submissions.find((candidate) => matches(candidate, where));
        if (!row) throw new Error('submission not found');
        Object.assign(row, data);
        return clone(row);
      },
      updateMany: async ({ where, data }) => {
        const found = rows.submissions.filter((row) => matches(row, where));
        found.forEach((row) => Object.assign(row, data));
        if (data.masteryGenerationStatus === 'ready' && found.length === 0) {
          stats.fencedSubmissionWrites += 1;
        }
        return { count: found.length };
      },
    },
  };
  prisma.$transaction = (callback) => {
    const run = transactionTail.then(() => callback(prisma));
    transactionTail = run.then(() => undefined, () => undefined);
    return run;
  };

  const llm = {
    generate: async (_messages, callOptions) => {
      if (callOptions.operation === 'assessment') {
        stats.assessmentGenerations += 1;
        const text = options.generateAssessment
          ? await options.generateAssessment(stats.assessmentGenerations)
          : generationPayload('Generated production question');
        return { text };
      }
      if (callOptions.operation === 'grading') {
        stats.gradingCalls += 1;
        const text = options.gradeSubmission
          ? await options.gradeSubmission(stats.gradingCalls)
          : gradingPayload('Graded once');
        return { text };
      }
      throw new Error('Unexpected LLM operation: ' + callOptions.operation);
    },
  };

  return { service: new ExaminerService(prisma, llm), rows, stats };
}

async function createMasteryAssessment(service) {
  const request = createRequest();
  return service.create(request.userId, request.dto, request.internal);
}

test('concurrent mastery create performs one generation and persists one Assessment', async () => {
  const generationStarted = deferred();
  const releaseGeneration = deferred();
  const fixture = memoryFixture({
    generateAssessment: async () => {
      generationStarted.resolve();
      await releaseGeneration.promise;
      return generationPayload('Generated exactly once');
    },
  });

  const firstPromise = createMasteryAssessment(fixture.service);
  await generationStarted.promise;
  const secondPromise = createMasteryAssessment(fixture.service);
  await eventually(
    () => fixture.stats.advisoryLocks === 2,
    'both concurrent create calls should have attempted the serialized claim',
  );
  releaseGeneration.resolve();

  const [first, second] = await Promise.all([firstPromise, secondPromise]);
  assert.equal(fixture.stats.assessmentGenerations, 1);
  assert.equal(fixture.stats.assessmentCreates, 1);
  assert.equal(fixture.rows.assessments.length, 1);
  assert.equal(first.id, second.id);
  assert.equal(first.questions[0].prompt, 'Generated exactly once');
  assert.deepEqual(first.questions, second.questions);
});

test('concurrent mastery submit performs one grading and persists one submission', async () => {
  const gradingStarted = deferred();
  const releaseGrading = deferred();
  const fixture = memoryFixture({
    gradeSubmission: async () => {
      gradingStarted.resolve();
      await releaseGrading.promise;
      return gradingPayload('Concurrent winner');
    },
  });
  const assessment = await createMasteryAssessment(fixture.service);

  const firstPromise = fixture.service.submitLanguageMasteryOnce(
    'user-1', assessment.id, 'attempt-1', ['Independent answer'],
  );
  await gradingStarted.promise;
  const secondPromise = fixture.service.submitLanguageMasteryOnce(
    'user-1', assessment.id, 'attempt-1', ['Independent answer'],
  );
  await eventually(
    () => fixture.stats.advisoryLocks === 3,
    'both concurrent submit calls should have attempted the serialized claim',
  );
  releaseGrading.resolve();

  const [first, second] = await Promise.all([firstPromise, secondPromise]);
  assert.equal(fixture.stats.gradingCalls, 1);
  assert.equal(fixture.stats.submissionCreates, 1);
  assert.equal(fixture.rows.submissions.length, 1);
  assert.equal(first.id, second.id);
  assert.equal(first.summary, 'Concurrent winner');
  assert.deepEqual(first, second);
});

test('a stale assessment claim can be recovered but its late generation is fenced out', async () => {
  const staleGenerationStarted = deferred();
  const releaseStaleGeneration = deferred();
  const fixture = memoryFixture({
    staleAssessmentClaim: true,
    generateAssessment: async (call) => {
      if (call === 1) {
        staleGenerationStarted.resolve();
        await releaseStaleGeneration.promise;
        return generationPayload('Late stale generation');
      }
      return generationPayload('Recovered generation winner');
    },
  });

  const staleOwner = createMasteryAssessment(fixture.service);
  await staleGenerationStarted.promise;
  const recoveredOwner = createMasteryAssessment(fixture.service);
  const recovered = await recoveredOwner;
  releaseStaleGeneration.resolve();
  const staleReplay = await staleOwner;

  assert.equal(fixture.stats.assessmentGenerations, 2);
  assert.equal(fixture.stats.assessmentCreates, 1);
  assert.equal(fixture.stats.fencedAssessmentWrites, 1);
  assert.equal(recovered.questions[0].prompt, 'Recovered generation winner');
  assert.equal(staleReplay.questions[0].prompt, 'Recovered generation winner');
  assert.equal(
    fixture.rows.assessments[0].questions.questions[0].prompt,
    'Recovered generation winner',
  );
});

test('a stale submission claim can be recovered but its late grading is fenced out', async () => {
  const staleGradingStarted = deferred();
  const releaseStaleGrading = deferred();
  const fixture = memoryFixture({
    staleSubmissionClaim: true,
    gradeSubmission: async (call) => {
      if (call === 1) {
        staleGradingStarted.resolve();
        await releaseStaleGrading.promise;
        return gradingPayload('Late stale grading');
      }
      return gradingPayload('Recovered grading winner');
    },
  });
  const assessment = await createMasteryAssessment(fixture.service);

  const staleOwner = fixture.service.submitLanguageMasteryOnce(
    'user-1', assessment.id, 'attempt-1', ['Independent answer'],
  );
  await staleGradingStarted.promise;
  const recoveredOwner = fixture.service.submitLanguageMasteryOnce(
    'user-1', assessment.id, 'attempt-1', ['Independent answer'],
  );
  const recovered = await recoveredOwner;
  releaseStaleGrading.resolve();
  const staleReplay = await staleOwner;

  assert.equal(fixture.stats.gradingCalls, 2);
  assert.equal(fixture.stats.submissionCreates, 1);
  assert.equal(fixture.stats.fencedSubmissionWrites, 1);
  assert.equal(recovered.summary, 'Recovered grading winner');
  assert.equal(staleReplay.summary, 'Recovered grading winner');
  assert.equal(fixture.rows.submissions[0].summary, 'Recovered grading winner');
});
