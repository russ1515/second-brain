'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const test = require('node:test');
const ts = require('typescript');
const { SUPPORTED_LANGUAGE_CODES, SUPPORTED_LANGUAGES } = require('@second-brain/shared');

const ROOT = path.resolve(__dirname, '../../..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');

function load(file, imports) {
  const filename = path.join(ROOT, file);
  const source = ts.transpileModule(read(file), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    fileName: filename,
  }).outputText;
  const compiled = new Module(filename, module);
  compiled.filename = filename;
  compiled.paths = Module._nodeModulePaths(path.dirname(filename));
  const normalRequire = compiled.require.bind(compiled);
  compiled.require = (id) => Object.hasOwn(imports, id) ? imports[id] : normalRequire(id);
  compiled._compile(source, filename);
  return compiled.exports;
}

const required = () => ({
  policyVersion: 'language-placement-cefr-v1', profileId: 'profile-1', targetLanguage: 'en', supportLanguage: 'fr',
  status: 'required', selfEstimate: null, round: 1, globalLevel: null, productLevel: null,
  skills: [], assessment: null, completedAt: null, submissionIds: [],
});
const active = (round = 1) => ({ ...required(), status: 'active', selfEstimate: 'zero', round,
  assessment: { id: `assessment-${round}`, questions: ['vocabulary', 'grammar', 'reading', 'writing'].map((skill) => ({
    id: `${round}-${skill}`, prompt: `Actual ${skill} prompt`, format: 'open', points: 1,
  })) },
});
const complete = () => ({ ...required(), status: 'complete', selfEstimate: 'zero', globalLevel: 'A1', productLevel: 'BEGINNER',
  completedAt: '2026-10-20T12:00:00.000Z', submissionIds: ['submission-1'],
  skills: ['vocabulary', 'grammar', 'reading', 'writing'].map((skill) => ({
    round: 1, skill, level: 'A1', reason: 'Réponse évaluée',
  })),
});

/** Tiny deterministic hook runner, not a browser substitute. It executes the
 * real component handlers/effects with mocked transport and no provider. */
function panelHarness({ initial = required(), start = async () => active(), submit = async () => complete() } = {}) {
  const slots = [];
  const effects = [];
  let index = 0;
  let props;
  let tree;
  const calls = [];
  const received = [];
  const dependenciesEqual = (a, b) => a && b && a.length === b.length && a.every((value, i) => value === b[i]);
  const hooks = {
    useState(value) {
      const slot = index++;
      if (!(slot in slots)) slots[slot] = typeof value === 'function' ? value() : value;
      return [slots[slot], (next) => { slots[slot] = typeof next === 'function' ? next(slots[slot]) : next; }];
    },
    useRef(value) { const slot = index++; if (!(slot in slots)) slots[slot] = { current: value }; return slots[slot]; },
    useCallback(fn, dependencies) {
      const slot = index++;
      if (!slots[slot] || !dependenciesEqual(slots[slot].dependencies, dependencies)) slots[slot] = { fn, dependencies };
      return slots[slot].fn;
    },
    useEffect(fn, dependencies) {
      const slot = index++;
      if (!slots[slot] || !dependenciesEqual(slots[slot].dependencies, dependencies)) {
        slots[slot]?.cleanup?.();
        slots[slot] = { dependencies };
        effects.push(() => { slots[slot].cleanup = fn(); });
      }
    },
  };
  const jsx = (type, nextProps) => ({ type, props: nextProps || {} });
  const { LanguagePlacementPanel } = load('apps/mobile/components/language/placement-panel.tsx', {
    react: hooks,
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'react-native': { Text: 'Text', View: 'View' },
    '../ds/core': Object.fromEntries(['Alert', 'Badge', 'Button', 'Card', 'Input'].map((name) => [name, name])),
    '../ds/states': { SmartErrorState: 'SmartErrorState', SmartLoadingState: 'SmartLoadingState' },
    '../markdown': { Markdown: 'Markdown' },
    '../../lib/design/theme': { useTokens: () => ({ colors: {}, spacing: {}, typography: {} }) },
    '../../lib/language-rll-i18n': { useRlleCopy: () => ({ copy: (key, values) => values ? `${key}:${JSON.stringify(values)}` : key }) },
    '../../lib/language-placement-presentation': load('apps/mobile/lib/language-placement-presentation.ts', {}),
    '../../lib/language-placement-client': {
      loadLanguagePlacement: async (id) => { calls.push(['load', id]); return initial; },
      startLanguagePlacement: async (id, body) => { calls.push(['start', id, body]); return start(body); },
      submitLanguagePlacement: async (id, body) => { calls.push(['submit', id, body]); return submit(body); },
    },
  });
  props = { profileId: 'profile-1', onPlacement: (view) => received.push(view) };
  const render = () => { index = 0; tree = LanguagePlacementPanel(props); while (effects.length) effects.shift()(); return tree; };
  const nodes = (root = tree) => {
    const walk = (node) => {
      if (!node || typeof node !== 'object') return [];
      if (Array.isArray(node)) return node.flatMap(walk);
      return [node, ...walk(node.props?.children)];
    };
    return walk(root);
  };
  const byId = (id) => nodes().find((node) => node.props?.testID === id);
  const settle = async () => { await new Promise((resolve) => setImmediate(resolve)); render(); };
  render();
  return { calls, received, render, settle, byId, nodes };
}

test('placement GET restores the server state without automatically spending a provider call', async () => {
  const ui = panelHarness();
  await ui.settle();
  assert.ok(ui.byId('language-placement-estimate'));
  assert.equal(ui.byId('language-placement-start').props.disabled, true);
  assert.deepEqual(ui.calls, [['load', 'profile-1']]);
  ui.byId('language-placement-estimate-zero').props.onPress();
  ui.render();
  assert.equal(ui.byId('language-placement-start').props.disabled, false);
  const startAction = ui.byId('language-placement-start').props.onPress;
  startAction();
  startAction();
  await ui.settle();
  assert.equal(ui.calls[1][0], 'start');
  assert.equal(ui.calls[1][2].selfEstimate, 'zero');
  assert.equal(ui.calls[1][2].idempotencyKey, 'mobile-placement:profile-1:1:zero');
  assert.equal(ui.calls.filter((call) => call[0] === 'start').length, 1);
  assert.equal(ui.nodes().filter((node) => node.type === 'Input').length, 4);
});

test('a subsequent round requires an explicit Continue and cannot classify from a self-estimate', async () => {
  const ui = panelHarness({ initial: active(), submit: async () => ({ ...active(2), assessment: null }) });
  await ui.settle();
  ui.byId('language-placement-answer-0').props.onChangeText('ma réponse');
  ui.render();
  ui.byId('language-placement-submit').props.onPress();
  await ui.settle();
  assert.deepEqual(ui.calls.map((call) => call[0]), ['load', 'submit']);
  assert.equal(ui.calls[1][2].answers[0], 'ma réponse');
  assert.equal(ui.calls[1][2].idempotencyKey, 'mobile-placement:assessment-1');
  assert.ok(ui.byId('language-placement-next-round'));
  assert.equal(ui.byId('language-placement-result'), undefined);
  ui.byId('language-placement-next-round').props.onPress();
  await ui.settle();
  assert.equal(ui.calls[2][2].idempotencyKey, 'mobile-placement:profile-1:2:zero');
});

test('submit failure preserves learner answers and never retries in the background', async () => {
  const ui = panelHarness({ initial: active(), submit: async () => { throw new Error('network down'); } });
  await ui.settle();
  ui.byId('language-placement-answer-0').props.onChangeText('réponse conservée');
  ui.render();
  ui.byId('language-placement-submit').props.onPress();
  await ui.settle();
  assert.equal(ui.byId('language-placement-answer-0').props.value, 'réponse conservée');
  assert.equal(ui.calls.filter((call) => call[0] === 'submit').length, 1);
  assert.equal(ui.calls.filter((call) => call[0] === 'start').length, 0);
  assert.equal(ui.received.some((view) => view.status === 'complete'), false);
});

test('completed and not-evaluable diagnostics restore without fabricated levels or oral marks', async () => {
  const restored = panelHarness({ initial: complete() });
  await restored.settle();
  assert.ok(restored.byId('language-placement-result'));
  assert.equal(restored.byId('language-placement-start'), undefined);
  assert.deepEqual(restored.calls.map((call) => call[0]), ['load']);
  assert.equal(restored.received[0].globalLevel, 'A1');
  assert.equal(restored.nodes().filter((node) => node.type === 'Text' && String(node.props.children).includes('rlle.ui.dimension.')).length, 4);

  const blocked = panelHarness({ initial: { ...required(), status: 'not_evaluable' } });
  await blocked.settle();
  assert.equal(blocked.byId('language-placement-result'), undefined);
  assert.ok(blocked.nodes().some((node) => node.type === 'Alert' && node.props.title === 'placement.ui.notEvaluable'));
});

test('client transport uses only canonical placement endpoints and supplied operation keys', async () => {
  const calls = [];
  const client = load('apps/mobile/lib/language-placement-client.ts', {
    './client': { api: async (...args) => { calls.push(args); return required(); } },
  });
  await client.loadLanguagePlacement('profile /1');
  await client.startLanguagePlacement('profile /1', { selfEstimate: 'unknown', idempotencyKey: 'first' });
  await client.submitLanguagePlacement('profile /1', { assessmentId: 'assessment-1', answers: ['a'], idempotencyKey: 'submit' });
  assert.deepEqual(calls.map((call) => call[0]), [
    '/languages/profile%20%2F1/placement', '/languages/profile%20%2F1/placement/start', '/languages/profile%20%2F1/placement/submit',
  ]);
  assert.deepEqual(calls[2][1].body.answers, ['a']);
  assert.equal(calls[2][1].body.idempotencyKey, 'submit');
});

test('level badges render only diagnosed product levels, never the compatibility A1 default', () => {
  const { languagePlacementLevelLabel } = load('apps/mobile/lib/language-placement-presentation.ts', {});
  const copy = (key) => key;
  assert.equal(languagePlacementLevelLabel(null, copy, 'A1', true), 'rlle.ui.course.notEvaluated');
  assert.equal(languagePlacementLevelLabel({ ...required(), status: 'active' }, copy, 'C2', false), 'rlle.ui.course.notEvaluated');
  assert.equal(languagePlacementLevelLabel(complete(), copy, 'A1', false), 'learn.explain.lvlBeginner');
  assert.equal(languagePlacementLevelLabel({ ...complete(), productLevel: 'INTERMEDIATE' }, copy, 'A1', false), 'learn.explain.lvlIntermediate');
  assert.equal(languagePlacementLevelLabel({ ...complete(), productLevel: 'ADVANCED' }, copy, 'A1', false), 'learn.explain.lvlAdvanced');
  assert.equal(languagePlacementLevelLabel(null, copy, 'B2', false), 'B2 · rlle.ui.course.level.declared');
});

test('new-course UI gates generation on server placement and never forces existing courses back to placement', () => {
  const course = read('apps/mobile/app/languages/[id]/course/index.tsx');
  const languages = read('apps/mobile/app/languages/index.tsx');
  assert.match(course, /course\?\.status === 'not-started'[\s\S]{0,150}<LanguagePlacementPanel/);
  assert.match(course, /placement\?\.status === 'complete'[\s\S]{0,100}<StartCourseCard/);
  assert.match(course, /placement\.globalLevel === 'PRE_A1'/);
  assert.doesNotMatch(languages, /startRlleCourse/);
  assert.match(languages, /goal: requestedGoal/);
  assert.match(languages, /teachingLanguageSource: teachingSource/);
  const panel = read('apps/mobile/components/language/placement-panel.tsx');
  assert.doesNotMatch(panel, /\b(?:score|threshold|90|projectLanguagePlacementRound|placementProductLevel)\b\s*[=:(]/);
  assert.match(panel, /placement\.skills\.filter\(\(skill\) => skill\.round === round\)/);
  assert.match(panel, /language-placement-evidence-round-\$\{round\}/);
  assert.match(panel, /placement\.ui\.oralUnavailable/);
});

test('placement copy is fully translated and registered in all 34 locales with exact placeholders', () => {
  const translations = new Map();
  const overlay = load('apps/mobile/lib/locales/language-placement-v1.ts', {
    '../i18n': { extendLocale: (code, catalog) => translations.set(code, catalog) },
  });
  assert.equal(translations.size, 34);
  assert.deepEqual([...translations.keys()].sort(), [...SUPPORTED_LANGUAGE_CODES].sort());
  const placeholders = (text) => [...text.matchAll(/\{([^{}]+)\}/g)].map((match) => match[1]).sort();
  for (const [code, catalog] of translations) {
    assert.deepEqual(Object.keys(catalog), [...overlay.languagePlacementKeys], code);
    for (const [key, value] of Object.entries(catalog)) {
      assert.ok(value.trim(), `${code}.${key}`);
      assert.deepEqual(placeholders(value), placeholders(translations.get('en')[key]), `${code}.${key}`);
      if (code !== 'en') assert.notEqual(value, translations.get('en')[key], `${code}.${key} English filler`);
    }
    // Existing localized level/status labels are reused, not English fallbacks.
    const existing = ['en', 'fr'].includes(code)
      ? read('apps/mobile/lib/i18n.tsx')
      : read(`apps/mobile/lib/locales/${code === 'nb' ? 'no' : code}.ts`);
    for (const key of ['rlle.ui.course.notEvaluated', 'learn.explain.lvlBeginner', 'learn.explain.lvlIntermediate', 'learn.explain.lvlAdvanced']) {
      assert.ok(existing.includes(`'${key}':`) || existing.includes(`"${key}":`), `${code}.${key} localized source missing`);
    }
  }
  assert.match(read('apps/mobile/lib/locales/index.ts'), /import '\.\/language-placement-v1';/);
  assert.equal(SUPPORTED_LANGUAGES.ar.rtl, true);
  assert.equal(SUPPORTED_LANGUAGES.he.rtl, true);
  assert.equal(translations.has('no'), false);
  assert.equal(translations.has('nb'), true);
});
