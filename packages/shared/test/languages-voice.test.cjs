'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const shared = require('../dist/index.js');

test('the supported language registry exposes exactly 27 meaningful native names', () => {
  assert.equal(shared.SUPPORTED_LANGUAGE_CODES.length, 27);
  assert.equal(new Set(shared.SUPPORTED_LANGUAGE_CODES).size, 27);
  for (const code of shared.SUPPORTED_LANGUAGE_CODES) {
    const language = shared.SUPPORTED_LANGUAGES[code];
    assert.equal(language.code, code);
    assert.ok(language.name.trim().length > 0);
    assert.ok(language.englishName.trim().length > 0);
  }
});

test('international languages use neutral symbols and Arabic exposes RTL', () => {
  for (const code of ['en', 'pt', 'zh', 'ar']) {
    assert.equal(shared.SUPPORTED_LANGUAGES[code].neutralIcon, true);
  }
  assert.equal(shared.SUPPORTED_LANGUAGES.ar.rtl, true);
  assert.equal(shared.SUPPORTED_LANGUAGES.fr.rtl, undefined);
});

test('language resolution accepts code variants and native names without creating variants', () => {
  assert.equal(shared.toSupportedLanguage('en-GB'), 'en');
  assert.equal(shared.toSupportedLanguage('pt_BR'), 'pt');
  assert.equal(shared.toSupportedLanguage('Français'), 'fr');
  assert.equal(shared.toSupportedLanguage('العربية'), 'ar');
  assert.equal(shared.toSupportedLanguage('Klingon'), null);
});

test('voice experience exposes every semantic state exactly once', () => {
  assert.deepEqual(shared.VOICE_EXPERIENCE_STATES, [
    'READY', 'LISTENING', 'TRANSCRIPTION', 'THINKING', 'RESPONSE', 'PAUSED', 'ERROR',
  ]);
  assert.equal(new Set(shared.VOICE_EXPERIENCE_STATES).size, 7);
});

test('language next action is deterministic and never invents progression', () => {
  const base = {
    id: 'language-1', language: 'English', languageCode: 'en', nativeLanguage: 'French',
    nativeLanguageCode: 'fr', mode: 'intermediate', cefrLevel: 'B1', goal: 'Travel',
    vocabDeckId: 'deck-1', vocabCount: 20, vocabDue: 12, lessonCount: 2, sessionCount: 3,
    lastActivityAt: null, cefrLevelSource: 'declared', evaluatedCefrLevel: null,
    createdAt: new Date(0).toISOString(), updatedAt: new Date(0).toISOString(),
  };
  const due = shared.languageNextAction(base);
  assert.equal(due.kind, 'review-vocabulary');
  assert.equal(due.count, 12);
  assert.equal(due.destination.params.languageProfileId, 'language-1');
  assert.equal(base.cefrLevelSource, 'declared');
  assert.equal(base.evaluatedCefrLevel, null);

  const first = shared.languageNextAction({ ...base, vocabDue: 0, sessionCount: 0 });
  assert.equal(first.kind, 'start-conversation');
  assert.equal(first.durationMinutes, 8);
});

test('UI language and learning language remain separate values', () => {
  const preference = { uiLanguage: 'fr', learningLanguage: 'en' };
  assert.notEqual(preference.uiLanguage, preference.learningLanguage);
  assert.equal(shared.SUPPORTED_LANGUAGES[preference.uiLanguage].name, 'Français');
  assert.equal(shared.SUPPORTED_LANGUAGES[preference.learningLanguage].name, 'English');
});
