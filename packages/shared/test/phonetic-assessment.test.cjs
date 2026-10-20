'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const shared = require('../dist');

test('registry has all 34 product codes, no locale inferred from translation coverage', () => {
  const entries = new shared.PhoneticCapabilityRegistry().all();
  assert.equal(entries.length, 34);
  assert.equal(new Set(entries.map(e => e.language)).size, 34);
  assert.ok(entries.every(e => e.capability === 'PRACTICE_ONLY' && e.calibrationDataStatus === 'MISSING'));
  const ready = new shared.PhoneticCapabilityRegistry(true);
  assert.equal(ready.get('en', 'en').capability, 'ACOUSTIC_UNCALIBRATED');
  assert.equal(ready.get('en', 'en-US').capability, 'ACOUSTIC_UNCALIBRATED');
  assert.equal(ready.get('en', 'en-GB').capability, 'PRACTICE_ONLY');
  assert.equal(ready.get('fr').capability, 'PRACTICE_ONLY');
  assert.equal(ready.all().filter(e => e.capability === 'ACOUSTIC_UNCALIBRATED').length, 1);
  assert.ok(ready.all().every(e => e.calibrationStatus === 'UNCALIBRATED'));
});

test('raw values, correct STT or forged percentages never certify mastery', () => {
  for (const evidence of [null, { transcript: 'perfect', confidence: 1 },
    { overallAcousticScore: 100 }, { calibrationStatus: 'CALIBRATED', masteryEligible: true, score: 100 }]) {
    assert.deepEqual(shared.phoneticV1MasteryDecision(evidence), {
      verdict: 'NOT_EVALUABLE', score: null, masteryEligible: false, masteryStatus: 'MASTERY_NOT_VERIFIED',
    });
  }
});

test('feedback targets tentative missing words, never ranks different raw phonemes', () => {
  const result = { status: 'EVIDENCE_AVAILABLE', expectedText: 'She works every day.',
    errors: [{ code: 'POSSIBLE_OMITTED_WORD', wordIndex: 3, tentative: true }],
    phonemes: [{ expectedPhoneme: 's', rawAcousticScore: -999999 }] };
  const feedback = shared.buildPronunciationFeedback(result);
  assert.deepEqual(feedback, [
    { kind: 'UNCALIBRATED_NOTICE', certainty: 'TECHNICAL_OBSERVATION' },
    { kind: 'CHECK_MISSING_WORD', word: 'day', wordIndex: 3, certainty: 'TENTATIVE' },
  ]);
  assert.ok(!JSON.stringify(feedback).includes('999999'));
});

test('neutral outcome asks to record again, not to redo mastered learning', () => {
  const feedback = shared.buildPronunciationFeedback({ status: 'NOT_EVALUABLE' });
  assert.deepEqual(feedback.map(f => f.kind), ['UNCALIBRATED_NOTICE', 'RECORD_AGAIN']);
});

test('hyphens and apostrophes use the same word indexes as the acoustic lexicon', () => {
  const feedback = shared.buildPronunciationFeedback({ status: 'EVIDENCE_AVAILABLE',
    expectedText: 'well-known phrase', errors: [{ code: 'POSSIBLE_OMITTED_WORD', wordIndex: 1 }] });
  assert.equal(feedback[1].word, 'known');
});

test('basic feedback is app-owned in all 34 languages, keeps the target word and never invents a grade', () => {
  const builder = new shared.PronunciationFeedbackBuilder();
  assert.equal(Object.keys(shared.PHONETIC_FEEDBACK_COPY).length, 34);
  const result = { status: 'EVIDENCE_AVAILABLE', expectedText: 'She works every day.',
    errors: [{ code: 'POSSIBLE_OMITTED_WORD', wordIndex: 1 }] };
  for (const code of Object.keys(shared.SUPPORTED_LANGUAGES)) {
    const catalogue = shared.PHONETIC_FEEDBACK_COPY[code];
    assert.deepEqual(Object.keys(catalogue).sort(), ['UNCALIBRATED_NOTICE', 'RECORD_AGAIN', 'CHECK_MISSING_WORD', 'PRACTISE_PAUSE', 'REPEAT_WORD'].sort());
    if (code !== 'en') assert.notEqual(catalogue.UNCALIBRATED_NOTICE, shared.PHONETIC_FEEDBACK_COPY.en.UNCALIBRATED_NOTICE);
    const feedback = builder.build(result, { supportLanguageCode: code, targetLanguage: 'en' });
    assert.ok(feedback[1].message.includes('works'));
    assert.ok(feedback.every(item => typeof item.message === 'string' && item.message.length > 10));
    assert.ok(!JSON.stringify(feedback).includes('{word}'));
  }
  const french = builder.build(result, { supportLanguageCode: 'fr', targetLanguage: 'en' });
  assert.notEqual(french[0].message, shared.PHONETIC_FEEDBACK_COPY.en.UNCALIBRATED_NOTICE);
});
