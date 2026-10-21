'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { LANGUAGE_CURRICULUM_PROFILES, getLanguageCurriculumProfile } = require('../dist/language-curriculum-profiles.js');
const { SUPPORTED_LANGUAGE_CODES, toSupportedLanguage } = require('../dist/languages.js');

const stages = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const families = ['basics', 'grammar', 'morphology', 'pronunciation', 'register', 'discourse'];
const listFields = ['writingSystems', 'wordOrder', 'morphology', 'verbSystem', 'nounSystem', 'agreement', 'determiners', 'pronouns', 'questions', 'negation', 'register', 'learnerDifficulties', 'pragmatics', 'reviewSections', 'sources', 'varietyNotes'];

test('curriculum profiles use exactly the 34 canonical target IDs without alias duplicates', () => {
  assert.equal(SUPPORTED_LANGUAGE_CODES.length, 34);
  assert.deepEqual(Object.keys(LANGUAGE_CURRICULUM_PROFILES), SUPPORTED_LANGUAGE_CODES);
  assert.equal(toSupportedLanguage('no'), 'nb');
  assert.equal(LANGUAGE_CURRICULUM_PROFILES.no, undefined);
  assert.equal(LANGUAGE_CURRICULUM_PROFILES['zh-Hans'], undefined);
  for (const code of SUPPORTED_LANGUAGE_CODES) {
    const profile = getLanguageCurriculumProfile(code);
    assert.equal(profile.languageCode, code);
    assert.equal(profile.languageId, code);
    assert.equal(profile.pronunciationMetadataReference, `language-oral-capability:${code}`);
    for (const field of listFields) assert.ok(profile[field].length > 0, `${code}.${field}`);
  }
});

test('all six stages have substantive language-specific targets in all six blueprint families', () => {
  for (const code of SUPPORTED_LANGUAGE_CODES) {
    const profile = getLanguageCurriculumProfile(code);
    assert.deepEqual(Object.keys(profile.stageTargets), stages);
    for (const stage of stages) {
      const targets = profile.stageTargets[stage];
      assert.deepEqual(Object.keys(targets), families);
      for (const family of families) {
        assert.equal(targets[family].length, 3, `${code}/${stage}/${family}`);
        assert.equal(new Set(targets[family]).size, 3);
        assert.ok(targets[family].every((target) => target.length >= 40 && !/\bTODO\b|\bTBD\b|placeholder/i.test(target)), `${code}/${stage}/${family}`);
      }
    }
    for (const family of families) {
      assert.equal(new Set(stages.map((stage) => JSON.stringify(profile.stageTargets[stage][family]))).size, 6,
        `${code}/${family}: CEFR stages must not repeat an identical objective`);
    }
    assert.match(profile.stageTargets.A1.discourse[0], /personal facts/);
    assert.match(profile.stageTargets.C1.discourse[0], /Synthesise complex sources/);
    assert.match(profile.stageTargets.C2.discourse[0], /implicit assumptions/);
  }
});

test('scripts, direction and literacy targets reflect real catalogue differences', () => {
  assert.equal(getLanguageCurriculumProfile('ar').direction, 'rtl');
  assert.equal(getLanguageCurriculumProfile('he').direction, 'rtl');
  assert.ok(SUPPORTED_LANGUAGE_CODES.filter((code) => !['ar', 'he'].includes(code))
    .every((code) => getLanguageCurriculumProfile(code).direction === 'ltr'));
  const expectedScripts = { en: 'Latn', ar: 'Arab', he: 'Hebr', zh: 'Hans', 'zh-Hant': 'Hant', ja: 'Jpan', ko: 'Kore', hi: 'Deva', bn: 'Beng', th: 'Thai', el: 'Grek', ru: 'Cyrl', uk: 'Cyrl' };
  for (const [code, script] of Object.entries(expectedScripts)) assert.equal(getLanguageCurriculumProfile(code).script, script);
  assert.match(getLanguageCurriculumProfile('ar').stageTargets.A1.basics.join(' '), /positional letter forms/);
  assert.match(getLanguageCurriculumProfile('ja').stageTargets.A1.basics.join(' '), /hiragana.*katakana.*kanji/);
  assert.match(getLanguageCurriculumProfile('zh-Hant').stageTargets.A1.basics.join(' '), /traditional character/);
  assert.doesNotMatch(getLanguageCurriculumProfile('zh-Hant').stageTargets.A1.basics.join(' '), /simplified character/);
});

test('representative languages do not receive an English tense taxonomy', () => {
  assert.match(getLanguageCurriculumProfile('en').stageTargets.B1.grammar.join(' '), /auxiliary do/);
  assert.match(getLanguageCurriculumProfile('fr').stageTargets.B1.grammar.join(' '), /clitic/);
  assert.match(getLanguageCurriculumProfile('ar').stageTargets.A1.morphology.join(' '), /root-pattern/);
  assert.match(getLanguageCurriculumProfile('zh').stageTargets.A1.morphology.join(' '), /aspect particles/);
  assert.match(getLanguageCurriculumProfile('ja').stageTargets.A1.grammar.join(' '), /は.*が.*を/);
  assert.match(getLanguageCurriculumProfile('ln').stageTargets.A1.basics.join(' '), /noun-class/);
  assert.match(getLanguageCurriculumProfile('ln').stageTargets.B1.morphology.join(' '), /tone interactions/);
  for (const code of SUPPORTED_LANGUAGE_CODES.filter((code) => code !== 'en')) {
    assert.doesNotMatch(JSON.stringify(getLanguageCurriculumProfile(code).stageTargets), /present simple|present perfect|do-support|English alphabet/i);
  }
  assert.notDeepEqual(getLanguageCurriculumProfile('wo').stageTargets.A2.morphology,
    getLanguageCurriculumProfile('sw').stageTargets.A2.morphology);
  assert.notDeepEqual(getLanguageCurriculumProfile('hu').stageTargets.B2.grammar,
    getLanguageCurriculumProfile('fi').stageTargets.B2.grammar);
  for (const code of SUPPORTED_LANGUAGE_CODES) {
    assert.doesNotMatch(getLanguageCurriculumProfile(code).stageTargets.A1.register.join(' '), /academic stance|formal argument|professional synthesis/i);
    assert.doesNotMatch(getLanguageCurriculumProfile(code).stageTargets.A1.grammar.join(' '), /subordinate clauses|relative clauses|conditional forms/i);
  }
});

test('authored coverage never masquerades as expert linguistic or acoustic certification', () => {
  for (const code of SUPPORTED_LANGUAGE_CODES) {
    const profile = getLanguageCurriculumProfile(code);
    assert.equal(profile.reviewStatus, 'NEEDS_LINGUISTIC_REVIEW');
    assert.equal(profile.supportStatus, 'AUTHORED_NOT_EXPERT_VALIDATED');
    assert.match(profile.reviewSections.join(' '), /not official CEFR Reference Level Descriptions/);
    assert.ok(profile.sources.every((source) => /^https:\/\//.test(source.url) && source.scope.length > 20));
    assert.match(profile.stageTargets.A1.pronunciation[2], /without claiming acoustic certification/);
    assert.equal(profile.acousticCertified, undefined);
    assert.equal(profile.masteryEligible, undefined);
  }
  for (const code of ['ln', 'wo', 'ha']) {
    assert.match(getLanguageCurriculumProfile(code).reviewSections.join(' '), /B2\/C1\/C2/);
  }
  assert.match(getLanguageCurriculumProfile('ar').varietyNotes.join(' '), /Modern Standard Arabic/);
  assert.match(getLanguageCurriculumProfile('zh-Hant').varietyNotes.join(' '), /does not silently assert Cantonese/);
  assert.match(getLanguageCurriculumProfile('nb').varietyNotes.join(' '), /written standard/);
});
