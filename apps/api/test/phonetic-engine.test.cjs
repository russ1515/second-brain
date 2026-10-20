'use strict';
require('reflect-metadata');
const test = require('node:test');
const assert = require('node:assert/strict');
const { PhoneticAssessmentEngine, validatePhoneticEngineResult } = require('../dist/languages/phonetic-assessment.engine');
const input = { audio: Buffer.from('test'), mimeType: 'audio/wav', expectedText: 'She.',
  targetLanguage: 'en', locale: 'en', learnerLevel: 'A1', lessonId: 'owned', exerciseId: 'owned:0' };
function result() {
  return { status: 'EVIDENCE_AVAILABLE', language: 'en', locale: 'en-US', engineVersion: 'technical-test',
    expectedText: input.expectedText, overallAcousticScore: null, accuracyScore: null,
    completenessScore: null, fluencyScore: null, prosodyScore: null, confidence: null,
    calibrationStatus: 'UNCALIBRATED', masteryEligible: false, capability: 'ACOUSTIC_UNCALIBRATED',
    words: [{ index: 0, word: 'She', startMs: 0, endMs: 300, rawAcousticScore: -50,
      rawAcousticScorePerFrame: -2, confidence: null, phonemeIndexes: [0] }],
    phonemes: [{ index: 0, wordIndex: 0, expectedPhoneme: 'ʃ', observed: null, bestAlternative: null,
      startMs: 0, endMs: 100, rawAcousticScore: -50, rawAcousticScorePerFrame: -2, confidence: null }],
    errors: [], evidence: { audio: { durationMs: 500 }, normalization: { crossPhonemeComparable: false }, providerSecret: 'never-return' } };
}
test('engine default off does not spawn or invoke any provider', async () => {
  const engine = new PhoneticAssessmentEngine({ get: () => undefined });
  const response = await engine.assess(input);
  assert.equal(response.status, 'NOT_EVALUABLE');
  assert.equal(response.masteryEligible, false);
  assert.equal(response.accuracyScore, null);
  assert.equal(response.errors[0].code, 'LOCAL_ENGINE_NOT_CONFIGURED');
});
test('invalid and oversized input are rejected before worker startup', async () => {
  const engine = new PhoneticAssessmentEngine({ get: () => { throw new Error('must not load'); } });
  assert.equal((await engine.assess({ ...input, audio: Buffer.alloc(4 * 1024 * 1024 + 1) })).status, 'NOT_EVALUABLE');
});
test('real evidence shape is preserved, model labels and arbitrary provider fields are not exposed', () => {
  const raw = result(); raw.phonemes[0].expectedArpabet = 'SH';
  const output = validatePhoneticEngineResult(raw, input);
  assert.equal(output.phonemes[0].expectedPhoneme, 'ʃ');
  assert.equal(output.phonemes[0].expectedArpabet, undefined);
  assert.equal(output.evidence.providerSecret, undefined);
  assert.equal(output.masteryEligible, false);
});
test('adapter cannot claim calibration, grades, observed phonemes or wrong locale', () => {
  for (const patch of [{ masteryEligible: true }, { calibrationStatus: 'CALIBRATED' }, { accuracyScore: 100 },
    { confidence: 0.99 }, { locale: 'en-GB' }, { expectedText: 'someone else' }]) {
    assert.throws(() => validatePhoneticEngineResult({ ...result(), ...patch }, input));
  }
  const raw = result(); raw.phonemes[0].observed = 's';
  assert.throws(() => validatePhoneticEngineResult(raw, input));
});
test('unsupported language and corrupt timestamps cannot masquerade as evidence', () => {
  assert.throws(() => validatePhoneticEngineResult({ ...result(), language: 'fr' }, { ...input, targetLanguage: 'fr' }));
  const raw = result(); raw.phonemes[0].endMs = 40_000;
  assert.throws(() => validatePhoneticEngineResult(raw, input));
});
test('nested audio, secrets, provider bodies and numeric grades cannot be persisted as technical families', () => {
  const raw = result();
  for (const name of ['audio', 'model', 'completeness', 'fluency', 'prosody', 'normalization', 'timings']) {
    raw.evidence[name] = { ...raw.evidence[name], audioBase64: 'private-audio', apiKey: 'private-key',
      score: 100, payload: { token: 'private-token' }, overallAcousticScore: 100 };
  }
  raw.evidence.completeness.observedWords = ['unexpectedprivateword'];
  raw.evidence.completeness.substitutions = [{ expectedIndex: 0, observedIndex: 0, observedWord: 'unexpectedprivateword' }];
  const clean = validatePhoneticEngineResult(raw, input);
  assert.ok(!JSON.stringify(clean).includes('private-'));
  assert.ok(!JSON.stringify(clean.evidence).includes('100'));
  assert.ok(!JSON.stringify(clean.evidence).includes('unexpectedprivateword'));
});
test('phone timings and ownership must agree with their word, with no duplicate or detached phones', () => {
  const beyondWord = result(); beyondWord.phonemes[0].endMs = 400;
  assert.throws(() => validatePhoneticEngineResult(beyondWord, input));
  const detached = result(); detached.words[0].phonemeIndexes = [];
  assert.throws(() => validatePhoneticEngineResult(detached, input));
  const afterAudio = result(); afterAudio.evidence.audio.durationMs = 50;
  assert.throws(() => validatePhoneticEngineResult(afterAudio, input));
});

function configuredEngine() {
  const path = require('node:path');
  const values = { PHONETIC_ENGINE_ENABLED: 'true',
    PHONETIC_ENGINE_PYTHON: path.resolve('technical-python'),
    PHONETIC_ENGINE_SCRIPT: path.resolve('technical-engine.py') };
  return new PhoneticAssessmentEngine({ get: key => values[key] });
}
function readiness() {
  return { operation: 'capabilities', available: true,
    engineVersion: 'sb-phonetic-v1-pocketsphinx-5.0.4', language: 'en', locale: 'en-US',
    masteryEligible: false, calibrationStatus: 'UNCALIBRATED',
    modelArtifactSha256: '1d60fb00c87c143d94a49ebd275f4aeec78996596b183655b8d01c3cdab20870',
    lexiconSha256: 'b5ef92f6b9584f30fb8552acce799e5ff432d0b19bd81488a9a6b20a6bd2d644',
    supportedFormats: ['audio/wav', 'audio/webm', 'unsafe/provider-data'] };
}
test('capability default off and relative configuration never start a worker', async () => {
  for (const values of [{}, { PHONETIC_ENGINE_ENABLED: 'true', PHONETIC_ENGINE_PYTHON: 'relative',
    PHONETIC_ENGINE_SCRIPT: 'relative' }]) {
    const engine = new PhoneticAssessmentEngine({ get: key => values[key] });
    engine.run = () => { throw new Error('must not start'); };
    const value = await engine.capabilities();
    assert.equal(value.available, false);
    assert.equal(value.capability, 'PRACTICE_ONLY');
  }
});
test('readiness proves exact artifacts, caches a bounded no-audio probe and rejects optimistic declarations', async () => {
  const engine = configuredEngine(); let calls = 0;
  engine.run = async (_python, _script, audioInput) => { calls++; assert.equal(audioInput, null); return readiness(); };
  const value = await engine.capabilities();
  assert.equal(value.available, true);
  assert.equal(value.diagnosticStatus, 'INSUFFICIENT_ACOUSTIC_CONFIDENCE');
  assert.deepEqual(value.supportedFormats, ['audio/wav', 'audio/webm']);
  assert.deepEqual(await engine.capabilities(), value);
  assert.equal(calls, 1);
  for (const patch of [{ modelArtifactSha256: '0'.repeat(64) }, { masteryEligible: true },
    { calibrationStatus: 'CALIBRATED' }, { engineVersion: 'other' }, { language: 'fr' }]) {
    const invalid = configuredEngine(); invalid.run = async () => ({ ...readiness(), ...patch });
    assert.equal((await invalid.capabilities()).available, false);
  }
  const unavailable = configuredEngine(); unavailable.run = async () => { throw new Error('private detail'); };
  assert.equal((await unavailable.capabilities()).reason, 'ENGINE_READINESS_FAILED');
});
test('one, two and three overlapping API acoustic jobs have exactly one worker and explicit busy failures', async () => {
  for (const jobs of [1, 2, 3]) {
    const engine = configuredEngine(); let calls = 0; let finish;
    engine.run = () => { calls++; return new Promise(resolve => { finish = resolve; }); };
    const running = engine.assess(input);
    const rejected = await Promise.all(Array.from({ length: jobs - 1 }, () => engine.assess(input)));
    for (const value of rejected) assert.equal(value.errors[0].code, 'LOCAL_ENGINE_BUSY');
    assert.equal((await engine.capabilities()).reason, 'LOCAL_ENGINE_BUSY');
    assert.equal(calls, 1);
    finish(result());
    assert.equal((await running).status, 'EVIDENCE_AVAILABLE');
  }
});
test('unvalidated diagnostic warnings and confidence are replaced with explicit uncertainty, including legacy omissions', () => {
  for (const diagnostic of [undefined, { status: 'HIGH_CONFIDENCE', confidence: 0.99,
    weakEvidenceCount: 10, weakPhonemes: ['fabricated'], highConfidenceIssues: ['fabricated'] }]) {
    const raw = result();
    if (diagnostic) raw.evidence.pronunciationDiagnostic = diagnostic;
    const value = validatePhoneticEngineResult(raw, input).evidence.pronunciationDiagnostic;
    assert.equal(value.status, 'INSUFFICIENT_ACOUSTIC_CONFIDENCE');
    assert.equal(value.confidence, null);
    assert.equal(value.weakEvidenceCount, 0);
    assert.deepEqual(value.highConfidenceIssues, []);
  }
});
test('adapter cannot replace canonical reference words with a transcript or omit expected aligned words', () => {
  const transcript = result(); transcript.words[0].word = 'different-private-transcript';
  assert.throws(() => validatePhoneticEngineResult(transcript, input), /PHONETIC_WORD_INVALID/);
  assert.throws(() => validatePhoneticEngineResult({ ...result(), expectedText: 'She works.' },
    { ...input, expectedText: 'She works.' }), /PHONETIC_CAPABILITY_INVALID/);
  assert.equal(validatePhoneticEngineResult(result(), input).words[0].word, 'she');
});

test('completeness counters must be nonnegative integers consistent with the canonical reference', () => {
  const observation = { status: 'EVIDENCE_AVAILABLE', method: 'SECONDARY_ASR_WORD_ALIGNMENT',
    tentative: true, confidence: null, qualityScore: null,
    expectedCount: 1, observedCount: 1, matchedCount: 1 };
  for (const patch of [{ matchedCount: 999 }, { matchedCount: -1 }, { matchedCount: 0.5 },
    { expectedCount: 2 }, { observedCount: -1 }, { observedCount: 0 }, { observedCount: 385 },
    { observedCount: 0.5 }, { expectedCount: undefined }]) {
    const raw = result(); raw.evidence.completeness = { ...observation, ...patch };
    assert.throws(() => validatePhoneticEngineResult(raw, input), /PHONETIC_COMPLETENESS_INVALID/);
  }
  const valid = result(); valid.evidence.completeness = observation;
  assert.equal(validatePhoneticEngineResult(valid, input).evidence.completeness.matchedCount, 1);
  const unavailable = result(); unavailable.evidence.completeness = { ...observation, status: 'NOT_EVALUABLE', matchedCount: 999 };
  const unavailableClean = validatePhoneticEngineResult(unavailable, input).evidence.completeness;
  assert.equal(unavailableClean.status, 'NOT_EVALUABLE');
  assert.equal(unavailableClean.matchedCount, undefined);
});
