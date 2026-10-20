'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const test = require('node:test');
const ts = require('typescript');
const { SUPPORTED_LANGUAGE_CODES } = require('@second-brain/shared');
const root = path.resolve(__dirname, '../../..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
function load(file, imports = {}) {
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
const presentation = load('apps/mobile/lib/phonetic-evidence-presentation.ts');
const capability = (overrides = {}) => ({ enabled: true, available: true, capability: 'ACOUSTIC_UNCALIBRATED',
  diagnosticStatus: 'INSUFFICIENT_ACOUSTIC_CONFIDENCE', references: [{ lessonId: 'owned-lesson', exerciseIndex: 2, referenceText: 'She works every day.' }],
  bounds: { minDurationMs: 150, maxDurationMs: 30000, maxUploadBytes: 4194304 }, ...overrides });
const attempt = (overrides = {}) => ({ id: 'attempt-1', profileId: 'profile-1', lessonId: 'owned-lesson', exerciseIndex: 2,
  createdAt: '2026-10-21T12:00:00.000Z', state: 'complete', masteryEligible: false, calibrationStatus: 'UNCALIBRATED',
  result: { status: 'EVIDENCE_AVAILABLE', expectedText: 'She works every day.', errors: [], words: [{ word: 'works', index: 1,
    rawAcousticScore: -12345, rawAcousticScorePerFrame: -700 }], phonemes: [], supportLanguageCode: 'fr',
    feedback: [{ kind: 'UNCALIBRATED_NOTICE', message: 'Observation acoustique non certifiante.' }] }, ...overrides });

function harness(transport = {}, recordingOverride) {
  let index = 0, tree;
  const slots = [], effects = [], calls = [];
  const same = (a, b) => a && b && a.length === b.length && a.every((value, i) => value === b[i]);
  const react = {
    useState(value) { const n = index++; if (!(n in slots)) slots[n] = typeof value === 'function' ? value() : value; return [slots[n], (next) => { slots[n] = typeof next === 'function' ? next(slots[n]) : next; }]; },
    useRef(value) { const n = index++; if (!(n in slots)) slots[n] = { current: value }; return slots[n]; },
    useCallback(fn, deps) { const n = index++; if (!slots[n] || !same(slots[n].deps, deps)) slots[n] = { fn, deps }; return slots[n].fn; },
    useEffect(fn, deps) { const n = index++; if (!slots[n] || !same(slots[n].deps, deps)) { slots[n]?.cleanup?.(); slots[n] = { deps }; effects.push(() => { slots[n].cleanup = fn(); }); } },
  };
  const jsx = (type, props) => ({ type, props: props ?? {} });
  const audio = recordingOverride ?? { blob: new Blob(['real recorded bytes'], { type: 'audio/webm;codecs=opus' }), mimeType: 'audio/webm;codecs=opus', durationMs: 1000 };
  const recorder = { start: async () => { calls.push(['record.start']); if (transport.recordingError) throw transport.recordingError; },
    stop: async () => { calls.push(['record.stop']); return audio; }, cancel: () => calls.push(['record.cancel']) };
  const api = Object.fromEntries(['loadPhoneticCapability', 'loadPhoneticAttempts', 'submitPhoneticRecording'].map((key) => [key, async (...args) => {
    calls.push([key, ...args]);
    if (transport[key]) return transport[key](...args);
    return key === 'loadPhoneticCapability' ? capability() : key === 'loadPhoneticAttempts' ? [] : attempt();
  }]));
  const exported = load('apps/mobile/components/language/phonetic-evidence-panel.tsx', {
    react, 'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'react-native': { Text: 'Text', View: 'View' },
    '../ds/core': Object.fromEntries(['Alert', 'Badge', 'Button', 'Card'].map((key) => [key, key])),
    '../speak-button': { SpeakButton: 'SpeakButton' },
    '../../lib/design/theme': { useTokens: () => ({ colors: {}, spacing: {}, typography: {} }) },
    '../../lib/i18n': { localeDirection: (code) => ['ar', 'he'].includes(code) ? 'rtl' : 'ltr', trInLocale: (code, key, values) => `${code}:${key}${values ? ':' + values.word : ''}` },
    '../../lib/language-rll-i18n': { useRlleCopy: () => ({ copy: (key) => key }) },
    '../../lib/recorder': { RECORDING_SUPPORTED: true, createRecorder: () => recorder },
    '../../lib/speak': { stopSpeaking: () => calls.push(['tts.stop']) },
    '../../lib/request-id': { createClientRequestId: () => 'acoustic-test-key' },
    '../../lib/phonetic-evidence-client': api,
    '../../lib/phonetic-evidence-presentation': presentation,
  });
  const props = { profileId: 'profile-1', lessonId: 'owned-lesson', supportLanguageCode: 'fr', targetLanguageCode: 'en' };
  const render = () => { index = 0; tree = exported.PhoneticEvidencePanel(props); while (effects.length) effects.shift()(); return tree; };
  const walk = (node) => !node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(walk) : [node, ...walk(node.props?.children)];
  render();
  return { calls, render, nodes: () => walk(tree), byId: (id) => walk(tree).find((node) => node.props.testID === id),
    settle: async () => { await new Promise(setImmediate); render(); },
    cleanup: () => { for (const slot of slots) slot?.cleanup?.(); } };
}

test('all 34 selectable catalogues own the 19 evidence labels and preserve the word interpolation', () => {
  const registered = new Map();
  const copy = load('apps/mobile/lib/locales/phonetic-evidence-v1.ts', { '../i18n': { extendLocale: (code, entries) => registered.set(code, entries) } });
  assert.deepEqual([...registered.keys()].sort(), [...SUPPORTED_LANGUAGE_CODES].sort());
  assert.equal(copy.phoneticEvidenceKeys.length, 19);
  for (const [code, entries] of registered) {
    assert.deepEqual(Object.keys(entries), [...copy.phoneticEvidenceKeys]);
    assert.ok(Object.values(entries).every((value) => value.trim()));
    assert.equal((entries['phonetic.retryWord'].match(/\{word\}/g) ?? []).length, 1);
    if (code !== 'en') assert.notEqual(entries['phonetic.insufficient'], registered.get('en')['phonetic.insufficient']);
  }
  assert.match(read('apps/mobile/lib/locales/index.ts'), /import '\.\/phonetic-evidence-v1';/);
});

test('capability requires flag, available adapter, experimental English and server-owned references', () => {
  assert.equal(presentation.phoneticPanelEnabled(capability()), true);
  for (const value of [null, capability({ enabled: false }), capability({ available: false }),
    capability({ capability: 'PRACTICE_ONLY' }), capability({ references: [] })]) assert.equal(presentation.phoneticPanelEnabled(value), false);
});

test('microphone, empty, short, long, format, no-speech, alignment, confidence and engine failures stay distinct', () => {
  const expected = { MIC_PERMISSION_DENIED: 'voice.error.micDenied', EMPTY_RECORDING: 'voice.error.empty',
    AUDIO_TOO_SHORT: 'phonetic.tooShort', AUDIO_TOO_LONG: 'phonetic.tooLong', UNSUPPORTED_AUDIO: 'phonetic.unsupported',
    NO_SPEECH: 'phonetic.noSpeech', ACOUSTIC_ALIGNMENT_FAILED: 'phonetic.alignmentFailed',
    INSUFFICIENT_ACOUSTIC_CONFIDENCE: 'phonetic.insufficient', ENGINE_UNAVAILABLE: 'phonetic.engineUnavailable' };
  for (const [code, key] of Object.entries(expected)) assert.equal(presentation.phoneticFailureKey({ payload: { code } }), key);
  assert.equal(presentation.phoneticFailureKey({ code: 'AUDIO_RECORDING', recordingFailure: 'EMPTY_RECORDING' }), 'voice.error.empty');
  assert.equal(presentation.phoneticFailureKey({ payload: { message: { code: 'NO_SPEECH' } } }), 'phonetic.noSpeech');
  assert.equal(presentation.phoneticFailureKey({ payload: { code: 'AUDIO_TOO_LARGE' } }), 'phonetic.tooLong');
  for (const code of ['FEATURE_DISABLED', 'LOCAL_ENGINE_NOT_CONFIGURED', 'LOCAL_ENGINE_BUSY',
    'ENGINE_READINESS_NOT_VERIFIED', 'ENGINE_READINESS_FAILED', 'LOCAL_ENGINE_FAILED', 'PROCESSING_INTERRUPTED']) {
    assert.equal(presentation.phoneticFailureKey({ payload: { code } }), 'phonetic.engineUnavailable');
  }
  assert.equal(presentation.phoneticFailureKey({ payload: { code: 'PHONETIC_ATTEMPT_IN_PROGRESS' } }), 'state.processing');
  assert.equal(presentation.phoneticFailureKey({ message: 'PRIVATE_PROVIDER_DETAIL' }), 'phonetic.requestFailed');
});

test('local audio guards reuse server bounds rather than inventing pronunciation grades', () => {
  const { bounds } = capability();
  assert.equal(presentation.phoneticRecordingFailure(0, 1000, bounds), 'voice.error.empty');
  assert.equal(presentation.phoneticRecordingFailure(100, 149, bounds), 'phonetic.tooShort');
  assert.equal(presentation.phoneticRecordingFailure(100, 30001, bounds), 'phonetic.tooLong');
  assert.equal(presentation.phoneticRecordingFailure(4194305, 1000, bounds), 'phonetic.tooLong');
  assert.equal(presentation.phoneticRecordingFailure(100, 150, bounds), null);
});

test('comparison describes completeness or pauses only, never a score or mastery', () => {
  assert.equal(presentation.phoneticComparisonKey('COMPLETENESS_OBSERVATION_INCREASED'), 'phonetic.completenessIncreased');
  assert.equal(presentation.phoneticComparisonKey('STABLE_OBSERVATIONS'), 'phonetic.stableObservations');
  assert.equal(presentation.phoneticComparisonKey('PAUSE_OBSERVATION_CHANGED'), 'phonetic.pauseChanged');
  for (const status of ['NOT_COMPARABLE', undefined, 'MASTERED', 'IMPROVED']) assert.equal(presentation.phoneticComparisonKey(status), 'phonetic.insufficient');
});

test('mount/reload only reads capability/history, keeps low-confidence explicit and does not expose raw numbers', async () => {
  const ui = harness({ loadPhoneticAttempts: async () => [attempt()] });
  await ui.settle();
  assert.deepEqual(ui.calls.map((call) => call[0]), ['loadPhoneticCapability', 'loadPhoneticAttempts']);
  assert.ok(ui.byId('phonetic-evidence-panel'));
  assert.ok(ui.byId('phonetic-result'));
  assert.ok(ui.nodes().some((node) => node.props.title === 'fr:phonetic.insufficient'));
  assert.ok(ui.nodes().some((node) => node.type === 'SpeakButton' && node.props.text === 'She works every day.' && node.props.language === 'en'));
  assert.equal(JSON.stringify(ui.nodes()).includes('-12345'), false);
  assert.equal(JSON.stringify(ui.nodes()).includes('100%'), false);
  ui.cleanup();
});

test('flag off and other practice-only languages leave existing practice unchanged', async () => {
  for (const value of [capability({ enabled: false }), capability({ capability: 'PRACTICE_ONLY' }), capability({ references: [] })]) {
    const ui = harness({ loadPhoneticCapability: async () => value });
    await ui.settle();
    assert.equal(ui.byId('phonetic-evidence-panel'), undefined);
    assert.deepEqual(ui.calls.map((call) => call[0]), ['loadPhoneticCapability']);
    ui.cleanup();
  }
});

test('a restored technical error remains explicit without inventing a result or automatically retrying', async () => {
  const ui = harness({ loadPhoneticAttempts: async () => [attempt({ state: 'technical_error', result: null })] });
  await ui.settle();
  assert.ok(ui.byId('phonetic-result'));
  assert.ok(ui.nodes().some((node) => node.props.title === 'fr:phonetic.engineUnavailable'));
  assert.equal(ui.calls.some((call) => call[0] === 'submitPhoneticRecording'), false);
  ui.cleanup();
});

test('record→stop→explicit submit reuses Recorder, owned reference and one idempotent acoustic operation', async () => {
  const ui = harness(); await ui.settle();
  await ui.byId('phonetic-record').props.onPress(); await ui.settle();
  assert.ok(ui.calls.some((call) => call[0] === 'record.start'));
  assert.equal(ui.calls.some((call) => call[0] === 'submitPhoneticRecording'), false);
  await ui.byId('phonetic-record').props.onPress(); await ui.settle();
  assert.ok(ui.byId('phonetic-submit'));
  await ui.byId('phonetic-submit').props.onPress(); await ui.settle();
  const uploads = ui.calls.filter((call) => call[0] === 'submitPhoneticRecording');
  assert.equal(uploads.length, 1);
  assert.equal(uploads[0][1], 'profile-1');
  assert.deepEqual(uploads[0][2], capability().references[0]);
  assert.equal(uploads[0][3].mimeType, 'audio/webm;codecs=opus');
  assert.equal(uploads[0][4], 'acoustic-test-key');
  assert.equal(ui.calls.filter((call) => call[0] === 'loadPhoneticAttempts').length, 2);
  assert.equal(ui.byId('phonetic-submit'), undefined);
  ui.cleanup();
});

test('microphone denial and empty recording cause no acoustic request', async () => {
  const denied = harness({ recordingError: Object.assign(new Error('denied'), { code: 'MIC_PERMISSION' }) });
  await denied.settle(); denied.byId('phonetic-record').props.onPress(); await denied.settle();
  assert.ok(denied.nodes().some((node) => node.props.title === 'fr:voice.error.micDenied'));
  assert.equal(denied.calls.some((call) => call[0] === 'submitPhoneticRecording'), false); denied.cleanup();
  const empty = harness({}, { blob: new Blob([]), mimeType: 'audio/webm', durationMs: 1000 });
  await empty.settle(); empty.byId('phonetic-record').props.onPress(); await empty.settle();
  empty.byId('phonetic-record').props.onPress(); await empty.settle();
  assert.ok(empty.nodes().some((node) => node.props.title === 'fr:voice.error.empty'));
  assert.equal(empty.byId('phonetic-submit'), undefined); empty.cleanup();
});

test('targeted retry uses only the server-provided owned word index and preserves full-phrase navigation', async () => {
  const original = attempt({ retryTargets: [{ wordIndex: 1, word: 'works', certainty: 'TENTATIVE', reason: 'POSSIBLE_OMITTED_WORD' }] });
  const ui = harness({ loadPhoneticAttempts: async () => [original] }); await ui.settle();
  ui.byId('phonetic-retry-word-1').props.onPress(); await ui.settle();
  assert.equal(ui.byId('phonetic-reference').props.children, 'works');
  ui.byId('phonetic-record').props.onPress(); await ui.settle(); ui.byId('phonetic-record').props.onPress(); await ui.settle();
  ui.byId('phonetic-submit').props.onPress(); await ui.settle();
  const upload = ui.calls.find((call) => call[0] === 'submitPhoneticRecording');
  assert.deepEqual(upload[5], { parentAttemptId: 'attempt-1', targetWordIndex: 1 });
  assert.equal(upload[2].referenceText, 'She works every day.');
  ui.byId('phonetic-full-phrase').props.onPress(); await ui.settle();
  assert.equal(ui.byId('phonetic-reference').props.children, 'She works every day.'); ui.cleanup();
});

test('unmount cancels the shared recorder and no history from another lesson is rendered', async () => {
  const ui = harness({ loadPhoneticAttempts: async () => [attempt({ lessonId: 'another-user-lesson' })] }); await ui.settle();
  assert.equal(ui.byId('phonetic-result'), undefined);
  ui.byId('phonetic-record').props.onPress(); await ui.settle(); ui.cleanup();
  assert.ok(ui.calls.some((call) => call[0] === 'record.cancel'));
});

test('multipart carries the original browser format, owned indexes and no client text/score/mastery', async () => {
  let submitted;
  const client = load('apps/mobile/lib/phonetic-evidence-client.ts', { './client': { apiUpload: async (route, form) => { submitted = { route, form }; return attempt(); } } });
  await client.submitPhoneticRecording('profile/1', capability().references[0],
    { blob: new Blob(['opusbytes'], { type: 'audio/webm;codecs=opus' }), mimeType: 'audio/webm;codecs=opus' },
    'owned-attempt-key', { parentAttemptId: 'attempt-1', targetWordIndex: 1 });
  assert.equal(submitted.route, '/languages/profile%2F1/phonetic-attempts');
  assert.deepEqual([...submitted.form.keys()], ['audio', 'lessonId', 'exerciseIndex', 'idempotencyKey', 'parentAttemptId', 'targetWordIndex']);
  assert.equal(submitted.form.get('audio').type, 'audio/webm;codecs=opus');
  assert.equal(submitted.form.get('exerciseIndex'), '2');
  assert.equal(submitted.form.get('targetWordIndex'), '1');
});
