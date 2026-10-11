'use strict';

require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');
const { PrivacyService } = require('../dist/privacy/privacy.service.js');

function selected(row, select) {
  if (!select) return { ...row };
  return Object.fromEntries(
    Object.entries(select)
      .filter(([, enabled]) => enabled === true)
      .map(([key]) => [key, row[key]]),
  );
}

function allowedByGeneration(where, row) {
  return (where.OR ?? []).some((branch) => branch.masteryGenerationStatus === row.masteryGenerationStatus);
}

test('privacy export excludes mastery placeholders and never exposes claim/fencing fields', async () => {
  const observed = {};
  const assessmentRows = [
    { id: 'legacy', userId: 'owner', topic: 'Legacy', masteryGenerationStatus: null, masteryCreationHash: 'hidden-legacy' },
    { id: 'ready', userId: 'owner', topic: 'Ready', masteryGenerationStatus: 'ready', masteryCreationHash: 'hidden-ready' },
    { id: 'generating', userId: 'owner', topic: 'Generating', masteryGenerationStatus: 'generating', masteryCreationHash: 'hidden-generating' },
    { id: 'failed', userId: 'owner', topic: 'Failed', masteryGenerationStatus: 'failed', masteryCreationHash: 'hidden-failed' },
  ];
  const submissionRows = [
    { id: 'legacy-sub', userId: 'owner', assessmentId: 'legacy', answers: [], score: 80, results: [], summary: '', advice: '', createdAt: new Date(), masteryGenerationStatus: null, masterySubmissionHash: 'hidden-legacy' },
    { id: 'ready-sub', userId: 'owner', assessmentId: 'ready', answers: [], score: 90, results: [], summary: '', advice: '', createdAt: new Date(), masteryGenerationStatus: 'ready', masterySubmissionHash: 'hidden-ready' },
    { id: 'grading-sub', userId: 'owner', assessmentId: 'ready', answers: [], score: 0, results: [], summary: '', advice: '', createdAt: new Date(), masteryGenerationStatus: 'grading', masterySubmissionHash: 'hidden-grading' },
    { id: 'failed-sub', userId: 'owner', assessmentId: 'ready', answers: [], score: 0, results: [], summary: '', advice: '', createdAt: new Date(), masteryGenerationStatus: 'failed', masterySubmissionHash: 'hidden-failed' },
  ];
  const emptyModel = {
    findMany: async () => [],
    findUnique: async () => null,
    findFirst: async () => null,
  };
  const prisma = new Proxy({}, {
    get(_target, model) {
      if (model === 'assessment') {
        return {
          findMany: async (args) => {
            observed.assessment = args;
            return assessmentRows
              .filter((row) => row.userId === args.where.userId && allowedByGeneration(args.where, row))
              .map((row) => selected(row, args.select));
          },
        };
      }
      if (model === 'assessmentSubmission') {
        return {
          findMany: async (args) => {
            observed.submission = args;
            return submissionRows
              .filter((row) => row.userId === args.where.userId && allowedByGeneration(args.where, row))
              .map((row) => selected(row, args.select));
          },
        };
      }
      return emptyModel;
    },
  });
  const service = new PrivacyService(
    prisma,
    {},
    { exportUserMedia: async () => [] },
  );
  const exported = await service.exportData('owner');
  assert.deepEqual(exported.data.assessments.map((row) => row.id), ['legacy', 'ready']);
  assert.deepEqual(exported.data.assessmentSubmissions.map((row) => row.id), ['legacy-sub', 'ready-sub']);
  assert.deepEqual(observed.assessment.where.OR, [
    { masteryGenerationStatus: null },
    { masteryGenerationStatus: 'ready' },
  ]);
  assert.deepEqual(observed.submission.where.OR, observed.assessment.where.OR);
  assert.equal(observed.assessment.select.masteryGenerationStatus, undefined);
  assert.equal(observed.submission.select.masteryGenerationStatus, undefined);
  assert.equal(observed.submission.select.masterySubmissionHash, undefined);
  for (const row of [...exported.data.assessments, ...exported.data.assessmentSubmissions]) {
    assert.equal(Object.keys(row).some((key) => key.startsWith('mastery')), false);
  }
});
