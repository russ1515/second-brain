'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const runnerPath = path.resolve(
  __dirname,
  '../components/language/practice-runner.tsx',
);
const source = fs.readFileSync(runnerPath, 'utf8');
const lessonScreen = fs.readFileSync(
  path.resolve(__dirname, '../app/lesson/[id].tsx'),
  'utf8',
);
const courseLessonScreen = fs.readFileSync(
  path.resolve(__dirname, '../app/languages/[id]/course/lesson.tsx'),
  'utf8',
);

const formats = [
  'recognition-mcq',
  'contextual-discrimination',
  'fill-blank-no-hint',
  'sentence-reconstruction',
  'register-matching',
  'error-correction',
  'listening-discrimination',
  'guided-writing',
  'voice-pronunciation',
  'mini-dialogue',
];

test('the language practice runner names and renders all ten training formats', () => {
  for (const format of formats) {
    assert.match(source, new RegExp(`['"]${format}['"]`), format);
    assert.match(
      source,
      new RegExp(`rlle\\.ui\\.training\\.format\\.${format}`),
      `${format} has a learner-facing label`,
    );
  }

  assert.match(source, /OPTION_FORMATS[\s\S]*recognition-mcq[\s\S]*contextual-discrimination/);
  assert.match(source, /OPTION_FORMATS[\s\S]*register-matching[\s\S]*listening-discrimination/);
  assert.match(source, /case 'fill-blank-no-hint':[\s\S]*renderTextAnswer\(false\)/);
  assert.match(source, /case 'error-correction':[\s\S]*case 'guided-writing':[\s\S]*renderTextAnswer\(true\)/);
  assert.match(source, /case 'mini-dialogue':[\s\S]*dialogueTurns\?\.map[\s\S]*renderTextAnswer\(true\)/);
});

test('touch choices, reconstruction, listening and voice keep keyboard/text equivalents', () => {
  assert.match(source, /accessibilityRole="radiogroup"/);
  assert.match(source, /accessibilityRole="radio"/);
  assert.match(source, /accessibilityState=\{\{ checked: selected, disabled: busy \}\}/);
  assert.match(source, /focusable=\{!busy\}/);

  assert.match(source, /case 'sentence-reconstruction':[\s\S]*renderReconstruction\(\)/);
  assert.match(source, /tokens\.map/);
  assert.match(source, /renderReconstruction[\s\S]*renderTextAnswer\(false\)/);
  assert.match(source, /<TextInput[\s\S]*onChangeText=\{changeAnswer\}[\s\S]*value=\{answer\}/);

  assert.match(source, /format === 'listening-discrimination'[\s\S]*<SpeakButton/);
  assert.match(source, /text=\{exercise\.audioText\}/);
  assert.match(source, /case 'voice-pronunciation':[\s\S]*onVoice\?\.\(\)/);
  assert.match(source, /format !== 'voice-pronunciation'[\s\S]*language-submit/);
  assert.match(source, /language=\{language \?\? undefined\}/);
});

test('submission is delegated without client transport, answer leakage or pass logic', () => {
  assert.match(source, /onSubmit: \(answer: string\) => void/);
  assert.match(source, /onSubmit\(submittedAnswer\)/);
  assert.doesNotMatch(source, /\bfetch\s*\(/);
  assert.doesNotMatch(source, /\bapi\s*(?:<[^>]+>)?\s*\(/);
  assert.doesNotMatch(source, /exercise\.answer/);
  assert.doesNotMatch(source, /\bpass(?:ed|ing)?\b/i);
  assert.doesNotMatch(source, /\bmaster(?:y|ed)?\b/i);
});

test('Lesson persists written and audio-native practice while returning to the RLLE course', () => {
  assert.match(lessonScreen, /exercise\.languageFormat\s*\?/);
  assert.match(lessonScreen, /<LanguagePracticeRunner/);
  assert.match(lessonScreen, /\/lessons\/\$\{lesson\.id\}\/exercises\/\$\{index\}\/attempt/);
  assert.match(lessonScreen, /submitRllePronunciationTraining/);
  assert.match(lessonScreen, /languageProfileId && experienceSessionId/);
  assert.doesNotMatch(lessonScreen, /decideLanguageMilestoneMastery/);

  assert.match(courseLessonScreen, /returnTo=\$\{encodeURIComponent\(returnTo\)\}/);
  assert.match(courseLessonScreen, /startRlleAutonomy/);
  assert.match(courseLessonScreen, /startRlleRemediation/);
});
