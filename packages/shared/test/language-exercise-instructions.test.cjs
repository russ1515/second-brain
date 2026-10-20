'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const shared = require('../dist/index.js');
const resolve = shared.resolveLanguageExercisePresentation;

const legacy = [
  "Listen and choose the correct name of the letter: What is the name of the letter 'B'?",
  "How do you spell the word 'cat' using letter names?",
  "Spell the name 'Ann' using English letter names.",
  "Which letter comes after 'M' in the English alphabet?",
  "What is the name of the letter 'W'?",
  "Spell the word 'dog' using letter names.",
  'What is the first letter of the English alphabet?',
  "How do you say the name of the letter 'Z' in American English?",
  "Spell the name 'Bob' using English letter names.",
  "Which letter is between 'S' and 'U' in the alphabet?",
];
const operands = ['B', 'cat', 'Ann', 'M', 'W', 'dog', null, 'Z', 'Bob', 'S'];
const expectedKeys = ['letterName', 'spellWord', 'spellName', 'letterAfter', 'letterName',
  'spellWord', 'alphabetFirst', 'letterNameVariant', 'spellName', 'letterBetween'];

test('the ten persisted instruction forms are repaired read-only, without changing learning operands or options', () => {
  legacy.forEach((question, index) => {
    const input = { question, type: 'qcm', options: ['choice-A', 'choice-B', 'choice-C'], answer: 'choice-B' };
    const original = JSON.stringify(input);
    const presentation = resolve(input, 'fr', 'en');
    assert.equal(presentation.normalized, true, question);
    assert.equal(presentation.instruction.key, expectedKeys[index]);
    assert.equal(presentation.prompt, presentation.instructionText);
    assert.ok(!/What is|How do you|Which letter|Spell the|Listen and/i.test(presentation.prompt));
    if (operands[index]) assert.ok(presentation.prompt.includes(operands[index]));
    if (index === 9) assert.ok(presentation.prompt.includes('U'));
    if (index === 7) assert.ok(presentation.prompt.includes('américain'));
    assert.equal(JSON.stringify(input), original);
  });
});

test('the observed untrusted Listen preface does not falsely claim a written MCQ had listening audio', () => {
  const written = resolve({ question: legacy[0], type: 'qcm' }, 'fr', 'en');
  assert.equal(written.normalized, true);
  assert.doesNotMatch(written.prompt, /[ée]cout/i);
  const actualAudio = resolve({ question: legacy[0], type: 'qcm',
    audioText: 'B', languageFormat: 'listening-discrimination' }, 'fr', 'en');
  assert.equal(actualAudio.normalized, true);
  assert.match(actualAudio.prompt, /[ée]cout/i);
});

test('legacy normalization is generic rather than specific to any acceptance letter, word, name or country', () => {
  for (const input of [
    { question: "Which letter comes before 'Q' in the English alphabet?", operand: 'Q', key: 'letterBefore' },
    { question: "Spell the word 'sunflower' using letter names.", operand: 'sunflower', key: 'spellWord' },
    { question: "Spell the name 'Jane Smith' using English letter names.", operand: 'Jane Smith', key: 'spellName' },
    { question: "How do you say the name of the letter 'Z' in British English?", operand: 'Z', key: 'letterNameVariant' },
    { question: "Which letter comes after 'C' in the French alphabet?", operand: 'C', key: 'letterAfter', target: 'fr' },
  ]) {
    const result = resolve({ question: input.question, type: 'qcm' }, 'ar', input.target ?? 'en');
    assert.equal(result.normalized, true, input.question);
    assert.equal(result.instruction.key, input.key);
    assert.ok(result.prompt.includes(input.operand));
  }
});

test('unrecognized legacy modifiers and conflicting explicit target languages are never silently discarded', () => {
  const unknown = [
    "Which letter comes after 'M' in the English alphabet? Explain two alternatives.",
    "What is the second letter of the English alphabet?",
    "Spell the word 'cat' backwards using letter names.",
    "Which letter comes after 'M' in the fictional alphabet?",
    "What is the first letter of the French alphabet?",
  ];
  for (const question of unknown) {
    const result = resolve({ question, type: 'qcm' }, 'fr', 'en');
    assert.deepEqual(result, { normalized: false, reason: 'NOT_NORMALIZABLE', prompt: question });
  }
});

test('all four existing exercise types use an owned instruction and retain their exact semantic target payload', () => {
  assert.deepEqual(Object.keys(shared.LANGUAGE_EXERCISE_TYPE_INSTRUCTIONS), ['qcm', 'open', 'exercise', 'case']);
  for (const type of Object.keys(shared.LANGUAGE_EXERCISE_TYPE_INSTRUCTIONS)) {
    for (const [support, target, semantic] of [
      ['fr', 'en', 'She ___ to school every day.'],
      ['ar', 'en', 'She ___ to school every day.'],
      ['en', 'fr', 'Elle ___ à l’école chaque jour.'],
      ['he', 'en', 'She ___ to school every day.'],
    ]) {
      const result = resolve({ question: 'unused-canonical-prompt', type, targetText: semantic }, support, target);
      assert.equal(result.normalized, true);
      assert.equal(result.instruction.key, shared.LANGUAGE_EXERCISE_TYPE_INSTRUCTIONS[type]);
      assert.equal(result.targetText, semantic);
      assert.equal(result.prompt, `${result.instructionText}\n${semantic}`);
    }
  }
});

test('all ten existing training formats resolve with no duplicate exercise-type enum', () => {
  assert.deepEqual(Object.keys(shared.LANGUAGE_TRAINING_FORMAT_INSTRUCTIONS), [...shared.LANGUAGE_TRAINING_FORMATS]);
  for (const languageFormat of shared.LANGUAGE_TRAINING_FORMATS) {
    for (const support of ['fr', 'ar', 'en', 'he']) {
      const targetText = "She ___ to school. A: Hello! B: Hi!";
      const result = resolve({ question: 'canonical-unchanged', type: 'exercise', languageFormat, targetText }, support, 'en');
      assert.equal(result.normalized, true, `${support}:${languageFormat}`);
      assert.equal(result.instruction.key, shared.LANGUAGE_TRAINING_FORMAT_INSTRUCTIONS[languageFormat]);
      assert.equal(result.targetText, targetText);
    }
  }
});

test('all 34 support-language dictionaries contain every instruction and preserve exact named interpolation contracts', () => {
  const copy = shared.LANGUAGE_EXERCISE_INSTRUCTION_COPY;
  assert.equal(Object.keys(copy).length, 34);
  assert.deepEqual(Object.keys(copy).sort(), [...shared.SUPPORTED_LANGUAGE_CODES].sort());
  for (const code of shared.SUPPORTED_LANGUAGE_CODES) {
    assert.deepEqual(Object.keys(copy[code]).sort(), [...shared.LANGUAGE_EXERCISE_INSTRUCTION_COPY_KEYS].sort(), code);
    for (const key of shared.LANGUAGE_EXERCISE_INSTRUCTION_KEYS) {
      const params = Object.fromEntries(shared.LANGUAGE_EXERCISE_INSTRUCTION_PARAMS[key].map(name =>
        [name, name === 'variant' ? 'american' : `target-${name}`]));
      const text = shared.getLanguageExerciseInstructionText({ key, params }, code);
      assert.equal(typeof text, 'string', `${code}:${key}`);
      assert.ok(text.trim());
      assert.doesNotMatch(text, /\{[a-zA-Z]+\}/);
      if (code !== 'en') assert.notEqual(copy[code][key], copy.en[key], `${code}:${key}: English fallback`);
    }
  }
});

test('instruction ownership is structural and independent of legacy raw text length (5, 20, 40, 60)', () => {
  for (const length of [5, 20, 40, 60]) {
    const question = 'x'.repeat(length);
    const exercise = { question, type: 'qcm', instruction: { key: 'choose' }, targetText: 'She ___ home.' };
    const result = resolve(exercise, 'fr', 'en');
    assert.equal(result.normalized, true);
    assert.equal(result.instructionText, shared.LANGUAGE_EXERCISE_INSTRUCTION_COPY.fr.choose);
    assert.equal(result.targetText, 'She ___ home.');
    assert.equal(exercise.question.length, length);
  }
});

test('RTL instructions isolate only interpolated target operands, keeping English target content and canonical source intact', () => {
  for (const support of ['ar', 'he']) {
    const input = { question: legacy[3], type: 'qcm' };
    const before = JSON.stringify(input);
    const result = resolve(input, support, 'en');
    assert.equal(result.normalized, true);
    assert.ok(result.instructionText.includes('\u2068M\u2069'));
    assert.equal(JSON.stringify(input), before);
    const semantic = 'She ___ to school.';
    const target = resolve({ question: 'canonical', instruction: { key: 'fillBlank' }, targetText: semantic }, support, 'en');
    assert.equal(target.targetText, semantic);
    assert.doesNotMatch(target.targetText, /[\u2066-\u2069]/);
  }
});

test('unsupported language, invalid descriptor, unknown parameters and arbitrary variant prose fail closed', () => {
  assert.equal(resolve({ question: 'original', instruction: { key: 'choose' } }, 'xx', 'en').reason, 'UNSUPPORTED_SUPPORT_LANGUAGE');
  for (const instruction of [
    { key: 'not-an-instruction' }, { key: 'american' }, { key: 'letterName' },
    { key: 'choose', params: { prose: 'Provider-authored full instruction' } },
    { key: 'letterName', params: { letter: ' ' } },
    { key: 'letterNameVariant', params: { letter: 'Z', variant: 'American English prose' } },
    { key: 'choose', params: {}, arbitrary: 'ignored-unsafe-field' },
  ]) {
    const result = resolve({ question: 'original', instruction }, 'fr', 'en');
    assert.deepEqual(result, { normalized: false, reason: 'INVALID_DESCRIPTOR', prompt: 'original' });
  }
});

test('a generic instruction cannot erase a task when its semantic target payload is empty', () => {
  for (const key of Object.values(shared.LANGUAGE_EXERCISE_TYPE_INSTRUCTIONS)) {
    const result = resolve({ question: 'A meaningful canonical task', instruction: { key }, targetText: '' }, 'fr', 'en');
    assert.equal(result.normalized, false);
    assert.equal(result.prompt, 'A meaningful canonical task');
  }
  const complete = resolve({ question: 'original', instruction: { key: 'alphabetFirst' }, targetText: '' }, 'fr', 'en');
  assert.equal(complete.normalized, true);
});

test('a localized banner cannot disguise any proven legacy instruction as semantic target text', () => {
  for (const targetText of legacy) {
    for (const support of ['fr', 'ar', 'en', 'he']) {
      const source = { question: 'canonical-semantic-id', type: 'qcm', instruction: { key: 'choose' }, targetText };
      const original = JSON.stringify(source);
      const result = resolve(source, support, 'en');
      assert.deepEqual(result, { normalized: false, reason: 'INVALID_DESCRIPTOR', prompt: 'canonical-semantic-id' });
      assert.equal(JSON.stringify(source), original);
    }
  }
  // A conflicting explicit language is not an escape hatch for known prose.
  assert.equal(resolve({ question: 'canonical', instruction: { key: 'choose' }, targetText: legacy[3] }, 'en', 'fr').reason,
    'INVALID_DESCRIPTOR');
});

test('typed semantic families cannot append another instruction beneath the localized shell either', () => {
  for (const instruction of [
    { key: 'letterName', params: { letter: 'B' } },
    { key: 'spellWord', params: { word: 'cat' } },
    { key: 'letterNameVariant', params: { letter: 'Z', variant: 'american' } },
    { key: 'alphabetFirst', params: {} },
  ]) {
    for (const targetText of [legacy[4], shared.LANGUAGE_EXERCISE_INSTRUCTION_COPY.fr.choose]) {
      const result = resolve({ question: 'canonical', instruction, targetText }, 'fr', 'en');
      assert.deepEqual(result, { normalized: false, reason: 'INVALID_DESCRIPTOR', prompt: 'canonical' });
    }
  }
});

test('legitimate target-language interrogative learning material is not rejected as a standard instruction', () => {
  for (const targetText of ['Where is the library?', 'What is your name?', 'How are you?', 'Comment allez-vous ?', 'أين المكتبة؟']) {
    const result = resolve({ question: 'canonical', instruction: { key: 'choose' }, targetText }, 'fr', 'en');
    assert.equal(result.normalized, true, targetText);
    assert.equal(result.targetText, targetText);
  }
});

test('exact or prefixed application-owned instruction shells cannot hide in semantic target text in any catalogue', () => {
  for (const code of shared.SUPPORTED_LANGUAGE_CODES) {
    for (const key of shared.LANGUAGE_EXERCISE_INSTRUCTION_KEYS.filter(key =>
      shared.LANGUAGE_EXERCISE_INSTRUCTION_PARAMS[key].length === 0)) {
      const shell = shared.LANGUAGE_EXERCISE_INSTRUCTION_COPY[code][key];
      for (const targetText of [shell, `${shell}\nSome target-language learning material.`]) {
        const result = resolve({ question: 'canonical', instruction: { key: 'choose' }, targetText }, 'fr', code);
        assert.equal(result.normalized, false, `${code}:${key}`);
        assert.equal(result.reason, 'INVALID_DESCRIPTOR');
      }
      // A quoted learning example is not an instruction at the start of the
      // field and must retain its exact target-language content.
      const quoted = `“${shell}”`;
      const example = resolve({ question: 'canonical', instruction: { key: 'choose' }, targetText: quoted }, 'fr', code);
      assert.equal(example.normalized, true, `quoted:${code}:${key}`);
      assert.equal(example.targetText, quoted);
    }
  }
});

test('support language aliases resolve explicitly, never from target or current UI locale', () => {
  const exercise = { question: 'canonical', instruction: { key: 'choose' }, targetText: 'cat' };
  assert.equal(resolve(exercise, 'ar-SA', 'en').instructionText, shared.LANGUAGE_EXERCISE_INSTRUCTION_COPY.ar.choose);
  assert.equal(resolve(exercise, 'iw', 'en').instructionText, shared.LANGUAGE_EXERCISE_INSTRUCTION_COPY.he.choose);
  assert.equal(resolve(exercise, 'no', 'en').instructionText, shared.LANGUAGE_EXERCISE_INSTRUCTION_COPY.nb.choose);
});

test('schema parameter inventory is exhaustive and variant labels cannot masquerade as instruction types', () => {
  assert.equal(shared.LANGUAGE_EXERCISE_INSTRUCTION_KEYS.length, 21);
  assert.equal(shared.LANGUAGE_EXERCISE_INSTRUCTION_COPY_KEYS.length, 23);
  assert.deepEqual(Object.keys(shared.LANGUAGE_EXERCISE_INSTRUCTION_PARAMS), [...shared.LANGUAGE_EXERCISE_INSTRUCTION_KEYS]);
  assert.equal(shared.getLanguageExerciseInstructionText({ key: 'british' }, 'fr'), null);
});
