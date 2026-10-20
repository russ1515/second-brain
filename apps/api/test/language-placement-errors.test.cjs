'use strict';

require('reflect-metadata');
const test = require('node:test');
const assert = require('node:assert/strict');
const { ServiceUnavailableException } = require('@nestjs/common');
const { validate } = require('class-validator');
const { PlacementRuntimeException, LANGUAGE_PLACEMENT_FAILURE_CODES } = require('../dist/common/language-placement-error.js');
const { TelemetryExceptionFilter } = require('../dist/diagnostics/telemetry-exception.filter.js');
const { SaveLanguagePlacementProgressDto } = require('../dist/languages/dto/language-placement.dto.js');
const { LanguagePlacementController } = require('../dist/languages/language-placement.controller.js');
const { ConflictException } = require('@nestjs/common');

function render(exception) {
  const captured = [];
  const logs = [];
  let payload;
  let httpStatus;
  const filter = new TelemetryExceptionFilter({ httpAdapter: {} }, {
    captureException: (error, context) => captured.push({ error, context }),
  });
  filter.logger = { error: (message) => logs.push(message) };
  const response = { headersSent: false, status(value) { httpStatus = value; return this; }, json(value) { payload = value; } };
  filter.catch(exception, {
    getType: () => 'http',
    switchToHttp: () => ({
      getRequest: () => ({ originalUrl: '/api/languages/technical/placement/submit', headers: { 'x-request-id': 'technical-request' } }),
      getResponse: () => response,
    }),
  });
  return { captured, logs, payload, httpStatus };
}

test('every placement failure retains its exact safe code through HTTP and telemetry without raw data', () => {
  for (const code of LANGUAGE_PLACEMENT_FAILURE_CODES) {
    const error = new PlacementRuntimeException(code);
    const result = render(error);
    assert.equal(result.httpStatus, 503);
    assert.equal(result.payload.code, code);
    assert.equal(result.payload.stage, error.stage);
    assert.equal(result.payload.requestId, 'technical-request');
    assert.equal(result.captured[0].error.code, code);
    assert.equal(result.captured[0].context.source, 'backend');
    assert.deepEqual(result.logs, [`Language placement failed: ${code}`]);
    assert.deepEqual(Object.keys(result.payload).sort(), ['code', 'message', 'requestId', 'stage', 'statusCode'].sort());
  }
});

test('untrusted codes and arbitrary 5xx payloads cannot escape the opaque exception filter', () => {
  const secretLikeFixture = 'PRIVATE_TEST_CONTENT_DO_NOT_LOG';
  const invalid = new PlacementRuntimeException(secretLikeFixture);
  const safe = render(invalid);
  assert.equal(safe.payload.code, 'PLACEMENT_UNKNOWN_RUNTIME_ERROR');
  assert.ok(!JSON.stringify([safe.payload, safe.logs]).includes(secretLikeFixture));
  for (const error of [
    new Error(secretLikeFixture),
    new ServiceUnavailableException({ code: 'PLACEMENT_RESULT_SCORE_INVALID', stage: secretLikeFixture, message: secretLikeFixture }),
  ]) {
    const result = render(error);
    assert.equal(result.payload.code, 'INTERNAL_ERROR');
    assert.equal(result.payload.stage, undefined);
    assert.deepEqual(result.logs, []);
    assert.ok(!JSON.stringify(result.payload).includes(secretLikeFixture));
  }
});

test('safe placement stages distinguish provider, parsing, validation and persistence failure', () => {
  const cases = {
    PLACEMENT_PROVIDER_UNAVAILABLE: 'provider', PLACEMENT_RESULT_JSON_INVALID: 'parser',
    PLACEMENT_RESULT_QUESTION_IDS_INVALID: 'parser', PLACEMENT_RESULT_SCORE_INVALID: 'validation',
    PLACEMENT_PASSPORT_WRITE_FAILED: 'persistence', PLACEMENT_LEVEL_MAPPING_FAILED: 'mapping',
    PLACEMENT_STATE_CONFLICT: 'state', PLACEMENT_UNKNOWN_RUNTIME_ERROR: 'runtime',
  };
  for (const [code, stage] of Object.entries(cases)) assert.equal(render(new PlacementRuntimeException(code)).payload.stage, stage);
});

test('placement controller keeps known reasons and 4xx but names unexpected runtime failures safely', async () => {
  for (const method of ['get', 'start', 'submit', 'progress']) {
    for (const error of [new Error('PRIVATE_TEST_CONTENT'), new PlacementRuntimeException('PLACEMENT_RESULT_SCORE_INVALID'), new ConflictException('Existing state rejection')]) {
      const service = Object.fromEntries(['get', 'start', 'submit', 'saveProgress'].map((name) => [name, async () => { throw error; }]));
      const controller = new LanguagePlacementController(service);
      await assert.rejects(controller[method]({ userId: 'technical' }, 'technical-profile', {}), (caught) => {
        if (error instanceof ConflictException) return caught === error;
        return caught.code === (error instanceof PlacementRuntimeException ? error.code : 'PLACEMENT_UNKNOWN_RUNTIME_ERROR');
      });
    }
  }
});

test('draft autosave DTO permits only four bounded answers, a valid cursor and an optimistic version', async () => {
  const valid = { assessmentId: 'technical-assessment', answers: ['a', '', '', ''], currentQuestionIndex: 2, expectedVersion: 0 };
  assert.equal((await validate(Object.assign(new SaveLanguagePlacementProgressDto(), valid))).length, 0);
  for (const patch of [
    { assessmentId: 12 }, { answers: [] }, { answers: ['a', 'b', 'c', 'd', 'e'] },
    { answers: [null, '', '', ''] }, { answers: ['x'.repeat(4001), '', '', ''] },
    { currentQuestionIndex: -1 }, { currentQuestionIndex: 4 }, { currentQuestionIndex: 1.5 },
    { expectedVersion: -1 }, { expectedVersion: 0.5 }, { expectedVersion: '0' },
  ]) assert.ok((await validate(Object.assign(new SaveLanguagePlacementProgressDto(), valid, patch))).length > 0);
});
