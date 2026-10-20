const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const Module = require('node:module');
const ts = require('typescript');

const ROOT = path.resolve(__dirname, '../../..');
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');

function renderPassport(placement) {
  const filename = path.join(ROOT, 'apps/mobile/components/profile/learner-passport.tsx');
  const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    fileName: filename,
  }).outputText;
  const compiled = new Module(filename, module);
  compiled.filename = filename;
  compiled.paths = Module._nodeModulePaths(path.dirname(filename));
  const jsx = (type, props) => ({ type, props: props ?? {} });
  const imports = {
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'react-native': { Text: 'Text', View: 'View' },
    '../../lib/design/theme': { useTokens: () => ({ colors: {}, radius: {} }) },
    '../../lib/i18n': { useI18n: () => ({ t: (key) => key }) },
    '../../lib/language-rll-i18n': { useRlleCopy: () => ({ formatLocale: 'fr-FR', copy: (key, values) => values ? `${key}:${JSON.stringify(values)}` : key }) },
    '../../lib/language-placement-presentation': { LANGUAGE_PRODUCT_LEVEL_COPY: {
      BEGINNER: 'learn.explain.lvlBeginner', INTERMEDIATE: 'learn.explain.lvlIntermediate', ADVANCED: 'learn.explain.lvlAdvanced',
    } },
    '../ds/core': { Badge: 'Badge', Button: 'Button', Card: 'Card' },
    '../ds/language': { LanguageBadge: 'LanguageBadge' },
  };
  const originalRequire = compiled.require.bind(compiled);
  compiled.require = (id) => Object.hasOwn(imports, id) ? imports[id] : originalRequire(id);
  compiled._compile(source, filename);
  const tree = compiled.exports.LearnerPassportCard({
    passport: { declared: { subjects: [], academicGoals: [] }, observed: { languageProgress: [{
      profileId: 'profile-1', language: 'English', languageCode: 'en', declaredLevel: 'A1', evaluatedLevel: null,
      lessonCount: 0, sessionCount: 1, placement,
    }] } },
    onEdit() {},
  });
  const walk = (node) => !node || typeof node !== 'object' ? []
    : Array.isArray(node) ? node.flatMap(walk) : [node, ...walk(node.props?.children)];
  return walk(tree);
}

test('Profile renders the learner passport from its dedicated read model', () => {
  const profile = read('apps/mobile/app/(tabs)/profile.tsx');
  const card = read('apps/mobile/components/profile/learner-passport.tsx');

  assert.match(profile, /api<LearnerPassportView>\(['"]\/learner-passport['"]\)/);
  assert.match(profile, /<LearnerPassportCard/);
  assert.match(profile, /edit:\s*['"]passport['"]/);
  assert.match(card, /passport\?\.declared/);
  assert.match(card, /passport\?\.observed/);
  assert.match(card, /passport\.source\.declared/);
  assert.match(card, /passport\.source\.observed/);
});

test('active onboarding keeps interface, primary, teaching and learned languages distinct', () => {
  const steps = read('apps/mobile/components/onboarding/steps.tsx');

  assert.match(steps, /countryOfOrigin/);
  assert.match(steps, /currentCountry/);
  assert.match(steps, /value=\{l\.interface/);
  assert.match(steps, /value=\{l\.native/);
  assert.match(steps, /value=\{l\.explanation/);
  assert.match(steps, /value=\{l\.teaching \?\? l\.study/);
  assert.match(steps, /known:\s*\[\.\.\.known/);
  assert.match(steps, /level:\s*knownLevel/);
});

test('Landing adds one bounded illustrative passport section', () => {
  const landing = read('apps/mobile/components/landing/landing-page.tsx');
  const section = read('apps/mobile/components/landing/learner-passport-section.tsx');

  assert.match(landing, /<LearnerPassportLandingSection\s*\/>/);
  assert.match(section, /landing12\.passport\.demo/);
  assert.match(section, /passport\.originCountry/);
  assert.match(section, /passport\.teachingLanguage/);
  assert.match(section, /passport\.progression/);
  assert.doesNotMatch(section, /unique au monde|unique in the world/i);
});

test('Passport renders the canonical written placement, four skills, diagnostic date and honest oral scope', () => {
  const nodes = renderPassport({
    status: 'complete', productLevel: 'INTERMEDIATE', globalLevel: 'B1', completedAt: '2026-10-20T12:00:00.000Z',
    skills: [
      { skill: 'vocabulary', round: 1, level: 'A2' },
      ...['vocabulary', 'grammar', 'reading', 'writing'].map((skill) => ({ skill, round: 2, level: 'B1' })),
    ],
  });
  assert.ok(nodes.some((node) => node.props.label === 'learn.explain.lvlIntermediate'));
  assert.ok(nodes.some((node) => node.props.label === 'B1'));
  const text = nodes.filter((node) => node.type === 'Text').map((node) => node.props.children).flat().join(' ');
  for (const skill of ['vocabulary', 'grammar', 'reading', 'writing']) assert.match(text, new RegExp(`rlle.ui.dimension.${skill}`));
  assert.equal((text.match(/B1/g) ?? []).length, 4);
  assert.match(text, /placement.ui.oralUnavailable/);
  assert.match(text, /placement.ui.diagnosticDate/);
  assert.match(text, /20\/10\/2026/);
  assert.match(text, /placement.ui.nextAction/);
});

test('Passport never renders the compatibility declared level as a diagnostic result before completion', () => {
  for (const status of ['required', 'active', 'not_evaluable']) {
    const nodes = renderPassport({ status, productLevel: null, globalLevel: null, completedAt: null, skills: [] });
    assert.ok(nodes.some((node) => node.props.label === 'rlle.ui.course.notEvaluated'));
    assert.equal(nodes.some((node) => node.props.label === 'A1'), false);
    assert.equal(nodes.some((node) => node.props.testID === 'passport-placement-profile-1'), false);
  }
});
