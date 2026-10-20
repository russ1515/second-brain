'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const test = require('node:test');
const ts = require('typescript');
const { SUPPORTED_LANGUAGE_CODES, SUPPORTED_LANGUAGES } = require('@second-brain/shared');
const root = path.resolve(__dirname, '../../..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
function load(file, imports) {
  const filename = path.join(root, file);
  const js = ts.transpileModule(read(file), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const compiled = new Module(filename, module);
  compiled.filename = filename;
  compiled.paths = Module._nodeModulePaths(path.dirname(filename));
  const normal = compiled.require.bind(compiled);
  compiled.require = (id) => Object.hasOwn(imports, id) ? imports[id] : normal(id);
  compiled._compile(js, filename);
  return compiled.exports;
}
function harness(exportName, props, transport = {}) {
  const slots = [], effects = [], calls = [];
  let index = 0, tree;
  const same = (a, b) => a && b && a.length === b.length && a.every((value, i) => value === b[i]);
  const react = {
    useState(value) { const n = index++; if (!(n in slots)) slots[n] = typeof value === 'function' ? value() : value; return [slots[n], (next) => { slots[n] = typeof next === 'function' ? next(slots[n]) : next; }]; },
    useRef(value) { const n = index++; if (!(n in slots)) slots[n] = { current: value }; return slots[n]; },
    useCallback(fn, deps) { const n = index++; if (!slots[n] || !same(slots[n].deps, deps)) slots[n] = { fn, deps }; return slots[n].fn; },
    useEffect(fn, deps) { const n = index++; if (!slots[n] || !same(slots[n].deps, deps)) { slots[n]?.cleanup?.(); slots[n] = { deps }; effects.push(() => { slots[n].cleanup = fn(); }); } },
  };
  const jsx = (type, p) => ({ type, props: p ?? {} });
  const api = new Proxy(transport, { get(target, key) { return async (...args) => { calls.push([key, ...args]); return key in target ? target[key](...args) : {}; }; } });
  const exported = load('apps/mobile/components/language/learning-core.tsx', {
    react, 'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'react-native': Object.fromEntries(['Text', 'View', 'Pressable', 'TextInput'].map((key) => [key, key])),
    'expo-router': { useRouter: () => ({ push() {} }) },
    '../../lib/design/theme': { useTokens: () => ({ colors: {}, spacing: {}, typography: {} }) },
    '../../lib/language-rll-i18n': { useRlleCopy: () => ({ copy: (key) => key }) },
    '../../lib/language-placement-presentation': { LANGUAGE_PRODUCT_LEVEL_COPY: { BEGINNER: 'beginner' } },
    '../../lib/language-learning-core-client': api,
    '../ds/core': Object.fromEntries(['Alert', 'Badge', 'Button', 'Card', 'Progress'].map((key) => [key, key])),
    '../ds/states': { SmartErrorState: 'SmartErrorState', SmartLoadingState: 'SmartLoadingState' },
    '../markdown': { Markdown: 'Markdown' }, '../speak-button': { SpeakButton: 'SpeakButton' },
  });
  const render = () => { index = 0; tree = exported[exportName](props); while (effects.length) effects.shift()(); return tree; };
  const nodes = () => { const walk = (node) => !node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(walk) : [node, ...walk(node.props?.children)]; return walk(tree); };
  render();
  return { calls, exported, render, nodes, byId: (id) => nodes().find((node) => node.props?.testID === id), settle: async () => { await new Promise(setImmediate); render(); }, cleanup: () => { for (const slot of slots) slot?.cleanup?.(); } };
}
const session = () => ({
  core: { modules: [], currentModuleId: null, currentLessonId: 'lesson-1', nextAction: {}, curriculumStatus: 'COMPLETE', productLevel: 'BEGINNER', cefrLevel: 'A1', levelStatus: 'IN_PROGRESS' },
  sessionId: 'session-1', activeScope: 'lesson', activeTargetId: 'lesson-1', phase: 'teaching', teachingStep: 1,
  content: { id: 'content-1', topic: 'Alphabet', objective: 'Identify letters', intro: 'Introduction française', explanation: 'Explication française détaillée', examples: ['A — exemple', 'B — exemple'], questions: ['Explique la différence'], exercises: [] },
  assessment: { id: 'assessment-1', title: 'Alphabet', questions: [{ id: 'q1', prompt: 'Question', options: ['A', 'B'], points: 1 }] },
  answers: ['A'], latestSubmission: null, supportLanguage: 'fr', remediation: false,
});

test('34 catalogues receive every learning-core key with no locale fallback or duplicate Norwegian', () => {
  const registered = new Map();
  const overlay = load('apps/mobile/lib/locales/language-learning-core-v1.ts', { '../i18n': { extendLocale: (code, entries) => registered.set(code, entries) } });
  assert.deepEqual([...registered.keys()].sort(), [...SUPPORTED_LANGUAGE_CODES].sort());
  for (const [code, entries] of registered) {
    assert.deepEqual(Object.keys(entries), [...overlay.languageLearningCoreKeys]);
    for (const value of Object.values(entries)) assert.ok(typeof value === 'string' && value.trim(), code);
    if (code !== 'en') assert.notEqual(entries['learningCore.help'], registered.get('en')['learningCore.help']);
  }
  assert.equal(registered.has('no'), false);
  assert.equal(SUPPORTED_LANGUAGES.ar.rtl, true);
  assert.equal(SUPPORTED_LANGUAGES.he.rtl, true);
  assert.match(read('apps/mobile/lib/locales/index.ts'), /import '\.\/language-learning-core-v1';/);
});

test('core loading has no automatic start, remediation, assessment or help calls', async () => {
  const ui = harness('LanguageLearningCore', { profileId: 'p1' }, { loadLanguageLearningCore: async () => session() });
  await ui.settle();
  assert.deepEqual(ui.calls, [['loadLanguageLearningCore', 'p1']]);
  assert.ok(ui.byId('language-learning-core'));
});

test('a failed level exposes targeted remediation while keeping acquired lesson status and score intact', async () => {
  const acquired = { id: 'lesson-1', title: 'Alphabet', order: 1, status: 'MASTERED', score: 0.94, bestScore: 0.94, weakConcepts: [] };
  const data = { ...session(), content: null, assessment: null, core: { ...session().core,
    levelStatus: 'NEEDS_REMEDIATION', levelWeakLessonIds: ['lesson-1'],
    modules: [{ id: 'basics', order: 1, kind: 'curriculum', status: 'MASTERED', lessons: [acquired], masteredLessons: 1, totalLessons: 1, score: 0.92, bestScore: 0.92, weakLessonIds: [] }],
  } };
  const ui = harness('LanguageLearningCore', { profileId: 'p1' }, {
    loadLanguageLearningCore: async () => data,
    startLanguageLearningRemediation: async () => data,
  });
  await ui.settle();
  assert.ok(ui.byId('language-core-level-remediation'));
  assert.ok(ui.byId('language-core-level-remediation-lesson-1'));
  ui.byId('language-core-level-remediation-lesson-1').props.onPress();
  await ui.settle();
  const call = ui.calls.find((entry) => entry[0] === 'startLanguageLearningRemediation');
  assert.deepEqual(call.slice(1, 3), ['p1', 'lesson-1']);
  assert.equal(acquired.status, 'MASTERED');
  assert.equal(acquired.score, 0.94);
});

test('a restored teaching step shows actual explanation and retains the existing TTS pipeline', () => {
  const ui = harness('LearningLesson', { profileId: 'p1', session: session(), lesson: { id: 'lesson-1', status: 'IN_PROGRESS' }, busy: false, onSession() {}, onError() {}, run() {} });
  assert.ok(ui.byId('language-core-teaching'));
  assert.ok(ui.nodes().find((node) => node.type === 'Markdown' && node.props.text === 'Explication française détaillée'));
  assert.equal(ui.nodes().find((node) => node.type === 'SpeakButton').props.language, 'fr');
  assert.equal(ui.byId('language-core-autonomous'), undefined);
});

test('restored autonomous assessment keeps answers and hides explanation, answer keys and help', () => {
  const data = { ...session(), phase: 'assessment' };
  const ui = harness('LearningLesson', { profileId: 'p1', session: data, lesson: { id: 'lesson-1', status: 'IN_PROGRESS' }, busy: false, onSession() {}, onError() {}, run() {} });
  assert.ok(ui.byId('language-core-autonomous'));
  assert.equal(ui.byId('language-core-teaching'), undefined);
  assert.equal(ui.nodes().filter((node) => node.type === 'Markdown').length, 0);
  assert.equal(ui.nodes().filter((node) => typeof node.type === 'function' && node.type.name === 'LanguageLearningHelp').length, 0);
  assert.equal(ui.nodes().find((node) => node.type === 'Pressable' && node.props.accessibilityState.checked).props.children.props.children, 'A');
  ui.cleanup();
});

test('contextual help is collapsed, makes no load-time provider call and has no progress mutation callback', async () => {
  const ui = harness('LanguageLearningHelp', { profileId: 'p1', lessonId: 'lesson-1' }, { askLanguageLearningHelp: async () => ({ answer: 'Aide contextuelle' }) });
  assert.equal(ui.nodes().find((node) => node.type === 'Button').props.accessibilityExpanded, false);
  assert.equal(ui.nodes().find((node) => node.type === 'TextInput'), undefined);
  assert.deepEqual(ui.calls, []);
  ui.nodes().find((node) => node.type === 'Button').props.onPress(); ui.render();
  ui.nodes().find((node) => node.type === 'TextInput').props.onChangeText('Pourquoi ?'); ui.render();
  await ui.nodes().find((node) => node.type === 'Button' && node.props.label === 'tutor.send').props.onPress();
  await ui.settle();
  assert.equal(ui.calls.length, 1);
  assert.equal(ui.calls[0][0], 'askLanguageLearningHelp');
  assert.deepEqual(ui.calls[0].slice(1, 4), ['p1', 'lesson-1', 'Pourquoi ?']);
  assert.ok(ui.nodes().some((node) => node.type === 'Markdown' && node.props.text === 'Aide contextuelle'));
});

test('submitting flushes the current answer before evaluation and sends no client score', async () => {
  const data = { ...session(), phase: 'assessment' };
  const ui = harness('LearningLesson', {
    profileId: 'p1', session: data, lesson: { id: 'lesson-1', status: 'IN_PROGRESS' }, busy: false,
    onSession() {}, onError(error) { throw new Error(error); }, run: async (_action, _target, fn) => fn('stable-submit-key'),
  }, {
    saveLanguageLearningAnswers: async () => data,
    submitLanguageLearningLesson: async () => data,
  });
  ui.nodes().find((node) => node.type === 'Pressable' && !node.props.accessibilityState.checked).props.onPress();
  ui.render();
  ui.nodes().find((node) => node.type === 'Button' && node.props.label === 'lesson.submit').props.onPress();
  await ui.settle();
  await ui.settle();
  assert.deepEqual(ui.calls.map((call) => call[0]), ['saveLanguageLearningAnswers', 'submitLanguageLearningLesson']);
  assert.deepEqual(ui.calls[0].slice(1), ['p1', 'lesson-1', ['B']]);
  assert.deepEqual(ui.calls[1].slice(1), ['p1', 'lesson-1', ['B'], 'stable-submit-key']);
  ui.cleanup();
});

test('post-placement branch reuses completed placement and Passport lazily loads the same projection', () => {
  assert.match(read('apps/mobile/app/languages/[id]/course/index.tsx'), /hasCompleteLanguageCoreCatalogue\(profile, course\?\.placement \?\? profile\.placement\)/);
  assert.match(read('apps/mobile/components/profile/learner-passport.tsx'), /<LanguageLearningPassportSummary profileId=\{item.profileId\}/);
  const source = read('apps/mobile/components/language/learning-core.tsx');
  assert.doesNotMatch(source, /set(?:Score|Mastery)|completeLanguagePlacement|submitLanguagePlacement|localStorage|AsyncStorage/);
  assert.match(source, /module\.weakLessonIds\.includes\(lesson\.id\)/);
  assert.match(source, /core\.levelStatus === 'MASTERED' && core\.nextProductLevel/);
});

test('only a complete catalogue replaces the existing course: English Beginner, not ES, JA or higher partial levels', () => {
  const { hasCompleteLanguageCoreCatalogue } = load('apps/mobile/lib/language-learning-core-presentation.ts', {});
  const placed = { status: 'complete', productLevel: 'BEGINNER', globalLevel: 'A1' };
  assert.equal(hasCompleteLanguageCoreCatalogue({ languageCode: 'en', language: 'English' }, placed), true);
  assert.equal(hasCompleteLanguageCoreCatalogue({ languageCode: 'es', language: 'Spanish' }, placed), false);
  assert.equal(hasCompleteLanguageCoreCatalogue({ languageCode: 'ja', language: 'Japanese' }, placed), false);
  assert.equal(hasCompleteLanguageCoreCatalogue({ languageCode: 'en', language: 'English' }, { ...placed, productLevel: 'INTERMEDIATE', globalLevel: 'B1' }), false);
  assert.equal(hasCompleteLanguageCoreCatalogue({ languageCode: 'en', language: 'English' }, { ...placed, productLevel: 'ADVANCED', globalLevel: 'C1' }), false);
  assert.equal(hasCompleteLanguageCoreCatalogue({ languageCode: 'en', language: 'English' }, { ...placed, status: 'required' }), false);
});

test('client sends answers and stable operation keys, never client-authored score or mastery', async () => {
  const calls = [];
  const client = load('apps/mobile/lib/language-learning-core-client.ts', { './client': { api: async (...args) => { calls.push(args); return {}; } } });
  await client.saveLanguageLearningAnswers('p/a', 'lesson/b', ['A'], 'assessment');
  await client.submitLanguageLearningLesson('p/a', 'lesson/b', ['A'], 'stable-key');
  await client.submitLanguageLearningAssessment('p/a', 'basics', ['B'], 'module-key');
  assert.equal(calls[0][0], '/languages/p%2Fa/learning-core/lessons/lesson%2Fb/answers');
  assert.deepEqual(calls[1][1].body, { answers: ['A'], idempotencyKey: 'stable-key' });
  assert.equal(calls[2][0], '/languages/p%2Fa/learning-core/assessments/basics/submit');
  assert.deepEqual(calls[2][1].body, { answers: ['B'], idempotencyKey: 'module-key' });
  assert.ok(calls.every(([, request]) => !('score' in request.body) && !('mastered' in request.body)));
});
