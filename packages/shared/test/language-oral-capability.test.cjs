'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const shared = require('../dist/index.js');

const provider = { transcription: true, synthesis: true, audioAnalysis: true };
const fullCoverage = {
  transcriptionLanguageCodes: ['fr'],
  synthesisLanguageCodes: ['fr'],
  pronunciationAssessmentLanguageCodes: ['fr'],
};

test('strict language mastery is legacy and off by default', () => {
  assert.equal(shared.DISABLED_UX_FEATURE_FLAGS.languageMasteryV1, false);
  assert.equal(shared.resolveUXFeatureFlags({ languageMasteryV1: 'TRUE' }).languageMasteryV1, false);
  assert.equal(shared.resolveUXFeatureFlags({ languageMasteryV1: 'true' }).languageMasteryV1, true);
  const matrix = shared.languageOralCapabilityMatrix({
    featureEnabled: false,
    languageCode: 'fr',
    provider,
    coverage: fullCoverage,
  });
  assert.equal(matrix.activation, 'legacy');
});

test('transcription and written evidence cannot substitute acoustic pronunciation', () => {
  const matrix = shared.languageOralCapabilityMatrix({
    featureEnabled: true,
    languageCode: 'fr',
    provider: { ...provider, audioAnalysis: false },
    coverage: { ...fullCoverage, pronunciationAssessmentLanguageCodes: [] },
    audioCapture: true,
  });
  assert.equal(matrix.audioCapture, 'available');
  assert.equal(matrix.transcription, 'available');
  assert.equal(matrix.spokenContentEvaluation, 'available');
  assert.equal(matrix.orthographyGraphyEvaluation, 'available');
  assert.equal(matrix.pronunciationAssessment, 'not-evaluable');
  assert.equal(matrix.activation, 'blocked-capability');
  assert.equal(matrix.fullPathCanBeCompleted, false);
  assert.ok(matrix.blockers.includes('acoustic-analysis-provider-unavailable'));
});

test('coverage is explicit per language and capture remains a runtime check', () => {
  const unverified = shared.languageOralCapabilityMatrix({
    featureEnabled: true,
    languageCode: 'de',
    provider,
    coverage: fullCoverage,
  });
  assert.equal(unverified.audioCapture, 'runtime-required');
  assert.equal(unverified.transcription, 'not-evaluable');
  assert.equal(unverified.listeningComprehensionEvaluation, 'not-evaluable');
  assert.equal(unverified.pronunciationAssessment, 'not-evaluable');
  assert.equal(unverified.activation, 'blocked-capability');

  const verified = shared.languageOralCapabilityMatrix({
    featureEnabled: true,
    languageCode: 'fr',
    provider,
    coverage: fullCoverage,
  });
  assert.equal(verified.audioCapture, 'runtime-required');
  assert.equal(verified.activation, 'available');
  assert.equal(verified.fullPathCanBeCompleted, false);

  const verifiedWithCapture = shared.languageOralCapabilityMatrix({
    featureEnabled: true,
    languageCode: 'fr',
    provider,
    coverage: fullCoverage,
    audioCapture: true,
  });
  assert.equal(verifiedWithCapture.fullPathCanBeCompleted, true);

  const noDeviceCapture = shared.languageOralCapabilityMatrix({
    featureEnabled: true,
    languageCode: 'fr',
    provider,
    coverage: fullCoverage,
    audioCapture: false,
  });
  assert.equal(noDeviceCapture.activation, 'available');
  assert.equal(noDeviceCapture.fullPathCanBeCompleted, false);
  assert.ok(noDeviceCapture.blockers.includes('audio-capture-unavailable'));
});

test('not-evaluable oral evidence is neutral and never unlocks or triggers remediation', () => {
  const training = shared.LANGUAGE_TRAINING_FORMATS.map((format, index) => ({
    id: 'e-' + index,
    format,
    state: format === 'voice-pronunciation' ? 'not-evaluable' : 'completed',
    helpUsed: false,
  }));
  const decision = shared.decideLanguageMilestoneMastery({ training, autonomy: null });
  assert.equal(decision.verdict, 'not-evaluable');
  assert.equal(decision.rawScore, null);
  assert.ok(decision.missingTrainingFormats.includes('voice-pronunciation'));
  assert.equal(shared.languageRemediationReady({ evidence: training }), false);
});

test('verified language parser rejects aliases and unknown values instead of claiming coverage', () => {
  assert.deepEqual(shared.verifiedLanguageCodes('fr,fr,de,no,unknown'), ['fr', 'de']);
});
