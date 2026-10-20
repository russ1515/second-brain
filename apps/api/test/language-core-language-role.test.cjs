'use strict';
require('reflect-metadata');
const test = require('node:test');
const assert = require('node:assert/strict');
const { LessonService } = require('../dist/lessons/lesson.service.js');
const { SUPPORTED_LANGUAGES, toSupportedLanguage } = require('@second-brain/shared');
const { supportedLanguages, toISO2 } = require('tinyld');

const teaching = {
  fr: 'Dans cette leçon, tu vas apprendre à reconnaître les lettres et à les utiliser dans des mots simples. Lis chaque explication à ton rythme, puis observe les exemples avant de répondre aux exercices. Les corrections expliquent la règle et te permettent de comprendre tes erreurs.',
  en: 'In this lesson you will learn how to recognise letters and use them in simple words. Read each explanation carefully and study the examples before answering the independent exercises. Every correction explains the rule so that you can understand your mistakes and practise again.',
  ar: 'في هذا الدرس سوف تتعلم كيفية التعرف على الحروف واستخدامها في كلمات بسيطة. اقرأ الشرح بعناية ثم انظر إلى الأمثلة قبل الإجابة عن التمارين المستقلة. توضح التصحيحات القاعدة حتى تتمكن من فهم أخطائك والتدرب عليها من جديد.',
  he: 'בשיעור הזה נלמד כיצד לזהות את האותיות ולהשתמש בהן במילים פשוטות. קראו את ההסבר בעיון והסתכלו בדוגמאות לפני שתענו על התרגילים. כל תיקון מסביר את הכלל כדי שתוכלו להבין את הטעות ולנסות שוב באופן עצמאי.',
};
const previousIntro = 'Today, we will learn the English alphabet. The alphabet is a set of letters used to write words in English. Knowing the alphabet helps you read, write, and spell words correctly.';
const previousObjective = 'Recognize the 26 English letters and use their names to spell familiar names and everyday words.';
function roles(support, target) {
  return { supportLanguageCode: support, targetLanguageCode: target,
    targetLanguage: SUPPORTED_LANGUAGES[target].englishName,
    moduleId: 'basics', lessonObjective: 'Recognise and use the alphabet' };
}
function content(support = 'fr', target = 'en') {
  const targets = target === 'fr' ? ['Je suis étudiant.', 'Elle est étudiante.', 'Es-tu étudiant ?']
    : ['I am a student.', 'She is a student.', 'Are you a student?'];
  const glosses = {
    fr: ['Je suis étudiant.', 'Elle est étudiante.', 'Es-tu étudiant ?'],
    en: ['I am a student.', 'She is a student.', 'Are you a student?'],
    ar: ['أنا طالب.', 'هي طالبة.', 'هل أنت طالب؟'],
    he: ['אני תלמיד.', 'היא תלמידה.', 'האם אתה תלמיד?'],
  }[support];
  return { objective: teaching[support], intro: teaching[support], explanation: teaching[support].repeat(4),
    examples: targets.map((text, i) => `"${text}" — ${glosses[i]}`),
    commonMisconceptions: [teaching[support]], questions: [1, 2, 3].map(i => `${teaching[support]} (${i})`),
    exercises: Array.from({ length: 10 }, (_, i) => ({ type: 'qcm', question: `${teaching[support]} (${i})`,
      answer: `Letter ${i}`, options: [`Letter ${i}`, 'Wrong option', 'Other option'],
      correction: `${teaching[support]} "I am a student."` })),
    homework: teaching[support], summary: teaching[support], keyPoints: [1, 2, 3].map(i => `${teaching[support]} (${i})`),
    revisionSheet: teaching[support] };
}
function service(raw = content()) {
  const observed = [], traces = [];
  const lessons = new LessonService({}, { generate: async (messages, options) => {
    observed.push({ messages, options }); return { text: JSON.stringify(raw) };
  } }, {}, {}, {}, {}, {}, {}, {}, {});
  lessons.logger = { log: value => traces.push(value), error: value => traces.push(value), warn: () => {} };
  return { lessons, observed, traces };
}

test('actual previous unquoted English intro is detected with French support, without a word ban', () => {
  const { lessons } = service();
  const bad = content(); bad.intro = previousIntro; bad.objective = previousObjective;
  const violation = lessons.getLanguageRoleViolation(bad, roles('fr', 'en'));
  assert.equal(violation.code, 'LESSON_SUPPORT_LANGUAGE_CONTRACT_VIOLATION');
  assert.equal(violation.reason, 'PEDAGOGICAL_LANGUAGE_MISMATCH');
  assert.ok(violation.fields.includes('intro'));
  assert.equal(lessons.getLanguageRoleViolation(content(), roles('fr', 'en')), null);
});

test('French→English, Arabic→English, English→French and Hebrew RTL retain their role contracts', () => {
  const { lessons } = service();
  for (const [support, target] of [['fr', 'en'], ['ar', 'en'], ['en', 'fr'], ['he', 'en']]) {
    const raw = content(support, target);
    assert.equal(lessons.getLanguageRoleViolation(raw, roles(support, target)), null, `${support}/${target}`);
    const wrong = content(support, target);
    wrong.intro = support === 'en'
      ? 'Dans cette leçon, tu vas apprendre à reconnaître les lettres et à les utiliser dans des mots simples. Les corrections expliquent la règle et te permettent de comprendre tes erreurs.'
      : teaching.en;
    assert.ok(lessons.getLanguageRoleViolation(wrong, roles(support, target))?.fields.includes('intro'), `${support}/${target} wrong intro`);
  }
});

test('all pedagogical fields and remediation corrections share one reliable check', () => {
  const { lessons } = service();
  for (const field of ['objective', 'intro', 'explanation', 'homework', 'summary', 'revisionSheet']) {
    const raw = content(); raw[field] = teaching.en;
    assert.ok(lessons.getLanguageRoleViolation(raw, roles('fr', 'en'))?.fields.includes(field), field);
  }
  for (const field of ['commonMisconceptions', 'questions', 'keyPoints']) {
    const raw = content(); raw[field][0] = teaching.en;
    assert.ok(lessons.getLanguageRoleViolation(raw, roles('fr', 'en'))?.fields.includes(field), field);
  }
  for (const field of ['question', 'correction']) {
    const raw = content(); raw.exercises[0][field] = teaching.en;
    assert.ok(lessons.getLanguageRoleViolation(raw, roles('fr', 'en'))?.fields.includes(`exercises.${field}`));
  }
  const remediation = content(); remediation.exercises[0].correction = `${teaching.fr} "She is a student."`;
  assert.equal(lessons.getLanguageRoleViolation(remediation, roles('fr', 'en')), null);
});

test('legitimate quoted/unquoted bilingual teaching, alphabet and natural apostrophes are not rejected', () => {
  const { lessons } = service();
  for (const text of [
    `En anglais, pour dire que tu es étudiant :\nI am a student.\nAvec he/she :\nShe is a student.`,
    `${teaching.fr}\n"${teaching.en}"\n\`${teaching.en}\``,
    `${teaching.fr}\nI am a student.\nShe is a student.\nAre you a student?`,
    `J’apprends l’anglais et je reconnais les lettres dans l’alphabet. L’explication est en français, et j’utilise ensuite les lettres pour écrire des mots familiers. ${teaching.fr}`,
    'A B C D E F G H I J K L M N O P Q R S T U V W X Y Z',
  ]) assert.equal(lessons.getLanguageTeachingTextViolation(text, roles('fr', 'en')), null);
  const raw = content(); raw.examples = [teaching.en, teaching.en, teaching.en];
  raw.exercises[0].answer = teaching.en; raw.exercises[0].options = [teaching.en];
  assert.equal(lessons.getLanguageRoleViolation(raw, roles('fr', 'en')), null, 'target-only fields are not teaching samples');
});

test('one support-language sentence cannot excuse overwhelmingly wrong teaching paragraphs', () => {
  const { lessons } = service();
  for (const repeats of [4, 5]) {
    const wrong = `${teaching.fr}\n${teaching.en.repeat(repeats)}`;
    assert.equal(lessons.getLanguageTeachingTextViolation(wrong, roles('fr', 'en'))?.code,
      'LESSON_SUPPORT_LANGUAGE_CONTRACT_VIOLATION');
  }
  const balanced = `${teaching.fr}\n${teaching.en}`;
  assert.equal(lessons.getLanguageTeachingTextViolation(balanced, roles('fr', 'en')), null,
    'balanced mixed prose is uncertain, never falsely certified or rejected');
  const quoted = `${teaching.fr}\n"${teaching.en.repeat(5)}"`;
  assert.equal(lessons.getLanguageTeachingTextViolation(quoted, roles('fr', 'en')), null,
    'an explicit target-language excerpt retains its learning role');
});

test('short, ambiguous and unsupported language samples stay UNKNOWN rather than false failures', () => {
  const { lessons } = service();
  for (const support of ['ln', 'sw', 'wo', 'ha']) {
    assert.equal(lessons.getLanguageTeachingTextViolation(teaching.en, roles(support, 'en')), null);
  }
  for (const text of ['English alphabet', 'ABC', 'chat', 'OK']) {
    assert.equal(lessons.getLanguageTeachingTextViolation(text, roles('fr', 'en')), null);
  }
  assert.equal(lessons.getLanguageTeachingTextViolation(teaching.fr, roles('en', 'fr')), null,
    'uncorroborated letters in a borderline language-ID sample remain UNKNOWN');
  const detectorCodes = new Set(supportedLanguages.map(code => toSupportedLanguage(toISO2(code))));
  const missing = Object.keys(SUPPORTED_LANGUAGES).filter(code => !detectorCodes.has(code)
    && !(code === 'zh-Hant' && detectorCodes.has('zh')));
  assert.deepEqual(missing.sort(), ['ha', 'ln', 'sw', 'wo']);
});

test('final role directive follows teacher preferences and classifies every generated field', async () => {
  for (const [support, target] of [['fr', 'en'], ['ar', 'en'], ['en', 'fr'], ['he', 'en']]) {
    const { lessons, observed } = service(content(support, target));
    const result = await lessons.generateLesson('Alphabet', '', { language: SUPPORTED_LANGUAGES[target].englishName, level: 'beginner' },
      'General teacher preference: use the learning target language.', false, undefined, undefined, true, undefined, roles(support, target));
    assert.equal(result.examples[0], content(support, target).examples[0]);
    const system = observed[0].messages[0].content;
    assert(system.lastIndexOf('FINAL AUTHORITATIVE LANGUAGE ROLE CONTRACT') > system.indexOf('General teacher preference'));
    assert(system.includes(`"supportLanguageCode":"${support}"`));
    assert(system.includes(`"targetLanguageCode":"${target}"`));
    for (const field of ['objective', 'intro', 'explanation', 'commonMisconceptions', 'questions',
      'correction', 'homework', 'summary', 'keyPoints', 'revisionSheet']) assert(system.includes(field));
    const schema = observed[0].options.jsonSchema.schema;
    assert(schema.properties.objective.description.includes(SUPPORTED_LANGUAGES[support].englishName));
    assert(schema.properties.examples.description.includes(SUPPORTED_LANGUAGES[target].englishName));
  }
});

test('34 configured language roles are data-driven even when semantic detector coverage is partial', () => {
  const { lessons } = service();
  assert.equal(Object.keys(SUPPORTED_LANGUAGES).length, 34);
  for (const [support, meta] of Object.entries(SUPPORTED_LANGUAGES)) {
    const schema = lessons.languageCoreLessonJsonSchema(roles(support, 'en'));
    assert(schema.schema.properties.intro.description.includes(meta.englishName));
    assert(lessons.languageRoleDirective(roles(support, 'en'), 'beginner').includes(`"supportLanguageCode":"${support}"`));
  }
});

test('wrong-language generated content fails before persistence with only safe field metadata', async () => {
  const bad = content(); bad.intro = previousIntro;
  const { lessons, observed, traces } = service(bad);
  await assert.rejects(() => lessons.generateLesson('Alphabet', '', { language: 'English', level: 'beginner' },
    undefined, false, undefined, undefined, true, undefined, roles('fr', 'en')), error => {
    const response = error.getResponse();
    assert.equal(error.getStatus(), 422);
    assert.equal(response.code, 'LESSON_SUPPORT_LANGUAGE_CONTRACT_VIOLATION');
    assert.equal(response.reason, 'PEDAGOGICAL_LANGUAGE_MISMATCH');
    assert.ok(response.fields.includes('intro'));
    assert(!JSON.stringify(response).includes(previousIntro));
    return true;
  });
  assert.equal(observed.length, 1, 'one fixture response, never a retry');
  assert(!traces.join('\n').includes(previousIntro));
  assert(!traces.join('\n').includes(bad.examples[0]));
});

test('Help uses the same checker without mutating learning or target text', () => {
  const { lessons } = service();
  const raw = content(), before = structuredClone(raw);
  assert.equal(lessons.getLanguageTeachingTextViolation(`${teaching.fr}\n"I am a student."`, roles('fr', 'en')), null);
  assert.equal(lessons.getLanguageTeachingTextViolation(previousIntro, roles('fr', 'en')).code,
    'LESSON_SUPPORT_LANGUAGE_CONTRACT_VIOLATION');
  assert.deepEqual(raw, before);
});
