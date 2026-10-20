'use strict';
require('reflect-metadata');
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { PhoneticAssessmentEngine } = require('../dist/languages/phonetic-assessment.engine');

const ready = process.env.SB_PHONETIC_TEST_WAV && process.env.PHONETIC_ENGINE_PYTHON;
test('real local PCM -> private IPC -> phoneme evidence -> uncalibrated response, no provider', { skip: !ready }, async () => {
  const configuration = {
    PHONETIC_ENGINE_ENABLED: 'true', PHONETIC_ENGINE_PYTHON: process.env.PHONETIC_ENGINE_PYTHON,
    PHONETIC_ENGINE_PYTHONPATH: process.env.PHONETIC_ENGINE_PYTHONPATH,
    PHONETIC_ENGINE_SCRIPT: path.resolve(__dirname, '../../..', 'services/phonetic-engine/phonetic_engine.py'),
  };
  const engine = new PhoneticAssessmentEngine({ get: key => configuration[key] });
  const runtime = await engine.capabilities();
  assert.equal(runtime.available, true);
  assert.equal(runtime.capability, 'ACOUSTIC_UNCALIBRATED');
  assert.equal(runtime.diagnosticStatus, 'INSUFFICIENT_ACOUSTIC_CONFIDENCE');
  const started = performance.now();
  const result = await engine.assess({
    audio: fs.readFileSync(process.env.SB_PHONETIC_TEST_WAV), mimeType: 'audio/wav',
    expectedText: 'She works every day.', targetLanguage: 'en', locale: 'en',
    learnerLevel: 'A1', lessonId: 'synthetic-lesson-fixture', exerciseId: 'synthetic-exercise-fixture',
  });
  assert.equal(result.status, 'EVIDENCE_AVAILABLE', JSON.stringify(result.errors));
  assert.equal(result.words.length, 4);
  assert.ok(result.phonemes.length >= 8);
  assert.equal(result.locale, 'en-US');
  assert.equal(result.masteryEligible, false);
  assert.equal(result.calibrationStatus, 'UNCALIBRATED');
  assert.ok(result.phonemes.every(phone => phone.observed === null && phone.confidence === null));
  assert.equal(result.overallAcousticScore, null);
  assert.equal(result.accuracyScore, null);
  assert.equal(result.evidence.normalization.crossPhonemeComparable, false);
  assert.equal(result.evidence.normalization.percentage, false);
  assert.equal(result.evidence.pronunciationDiagnostic.status, 'INSUFFICIENT_ACOUSTIC_CONFIDENCE');
  assert.equal(result.evidence.pronunciationDiagnostic.confidence, null);
  assert.deepEqual(result.evidence.pronunciationDiagnostic.weakPhonemes, []);
  assert.match(result.evidence.model.modelArtifactSha256, /^[a-f0-9]{64}$/);
  assert.match(result.evidence.model.lexiconSha256, /^[a-f0-9]{64}$/);
  assert.ok(!JSON.stringify(result).includes('audioBase64'));
  console.log(JSON.stringify({ technicalValidation: 'REAL_LOCAL_IPC_NOT_PUBLIC_BROWSER',
    elapsedMs: Math.round(performance.now() - started), words: result.words.length,
    phones: result.phonemes.length, metrics: result.evidence.timings,
    calibrationStatus: result.calibrationStatus, masteryEligible: false, paidCalls: 0 }));
});
