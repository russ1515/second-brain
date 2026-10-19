'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

const screen = fs.readFileSync(path.resolve(__dirname, '../app/library/workspace/[id].tsx'), 'utf8');
const assistant = fs.readFileSync(path.resolve(__dirname, '../components/workspace/assistant.tsx'), 'utf8');
const i18n = fs.readFileSync(path.resolve(__dirname, '../lib/i18n.tsx'), 'utf8');
const aliases = fs.readFileSync(path.resolve(__dirname, '../lib/locales/global-path-v1.ts'), 'utf8');
const shellLocales = fs.readFileSync(path.resolve(__dirname, '../lib/locales/workspace-shells-v1.ts'), 'utf8');

const phases = [
  'CAPTURE',
  'COMPREHENSION',
  'METHOD',
  'WORK',
  'COACHING',
  'VERIFICATION',
  'FINALIZATION',
  'DECONSTRUCTION',
];

test('AW-5 keeps one Workspace Professor with a discreet phase and server transition controls', () => {
  assert.equal((screen.match(/<WorkspaceAssistant\b/g) ?? []).length, 1);
  assert.match(assistant, /testID="workspace-professor-phase"/);
  assert.match(assistant, /testID="workspace-professor-advance"/);
  assert.match(assistant, /POST|method: 'POST'/);
  assert.match(screen, /`\/workspaces\/\$\{workspace\.id\}\/transitions`/);
  assert.match(screen, /expectedPhase[\s\S]*requestedPhase[\s\S]*expectedRevision/);
  assert.doesNotMatch(assistant, /wizard|stepper/i);
});

test('all eight phases have a deterministic client CTA while the server remains authoritative', () => {
  for (const phase of phases) {
    assert.match(assistant, new RegExp(`case '${phase}'`));
    assert.equal((i18n.match(new RegExp(`'workspaceProfessor\\.phase\\.${phase}'`, 'g')) ?? []).length, 2);
  }
  assert.match(assistant, /case 'WORK': return 'VERIFICATION'/);
  assert.match(assistant, /professor\.currentPhase === 'WORK'[\s\S]*transition\('COACHING'\)/);
  assert.match(assistant, /case 'VERIFICATION': return requiredChecksReady \? 'FINALIZATION' : 'WORK'/);
  assert.match(assistant, /professor\.currentPhase === 'FINALIZATION'[\s\S]*transition\('WORK'\)/);
  assert.match(assistant, /case 'DECONSTRUCTION': return null/);
});
test('dirty draft is flushed before a Professor turn or phase transition and is never reloaded on failure', () => {
  assert.match(screen, /prepareProfessorAssist[\s\S]*await save\(pendingDraft\)[\s\S]*return revisionRef\.current/);
  assert.match(screen, /transitionProfessor[\s\S]*await save\(pendingDraft\)[\s\S]*expectedRevision = revisionRef\.current/);
  assert.match(assistant, /await onBeforeAssist\(\)/);
  assert.match(screen, /refreshProfessorState[\s\S]*assistantHistory: next\.assistantHistory[\s\S]*professor: next\.professor/);
  const professorRefresh = screen.slice(screen.indexOf('const refreshProfessorState'), screen.indexOf('const handleProfessorAssistFailure'));
  assert.doesNotMatch(professorRefresh, /setContent|contentRef\.current\s*=/);
  assert.doesNotMatch(screen, /professorAssistActiveRef/);
  assert.match(screen, /handleBeforeUnload[\s\S]*saveRef\.current\(pending\)/);
});

test('assistant and transition retries preserve idempotency, draft conflicts and visible history', () => {
  assert.match(assistant, /createClientRequestId\('workspace-assist'\)/);
  assert.match(screen, /createClientRequestId\('workspace-transition'\)/);
  assert.match(assistant, /expectedPhase:[\s\S]*expectedRevision:/);
  assert.match(assistant, /entry\.role === 'user'[\s\S]*entry\.requestId === logicalRequestId/);
  assert.match(assistant, /entry\.role === 'assistant'[\s\S]*entry\.requestId === response\.reply\.requestId/);
  assert.match(assistant, /operation\?\.status === 'completed'/);
  assert.match(assistant, /operation\?\.status === 'pending'/);
  assert.match(assistant, /operation\?\.status === 'failed'/);
  const applyProfessor = screen.slice(screen.indexOf('const applyProfessorState'), screen.indexOf('const prepareProfessorAssist'));
  assert.doesNotMatch(applyProfessor, /revisionRef\.current\s*=/);
  assert.match(screen, /draftStillCanonical = next\.draft\.content === lastSavedRef\.current/);
  assert.match(screen, /draftStillCanonical[\s\S]*revisionRef\.current = next\.autosaveRevision/);
  assert.match(screen, /conflictActiveRef\.current = true[\s\S]*setConflictDraft/);
  assert.match(screen, /transitionRequestRef/);
});

test('AW-5 phase labels remain complete in all 34 interface languages', () => {
  for (const phase of ['CAPTURE', 'COMPREHENSION', 'METHOD', 'WORK', 'COACHING']) {
    assert.match(aliases, new RegExp(`'workspaceProfessor\\.phase\\.${phase}'`));
  }
  for (const phase of ['VERIFICATION', 'FINALIZATION', 'DECONSTRUCTION']) {
    assert.equal(
      (shellLocales.match(new RegExp(`'workspaceProfessor\\.phase\\.${phase}'`, 'g')) ?? []).length,
      32,
    );
  }
});

// Execute the actual component handlers with a small hook/JSX harness. This
// catches an inert action button without a browser, network or provider call.
function assistantHarness({ apiResponse, transitionError, selectedText = '' } = {}) {
  const slots = [];
  let cursor = 0;
  let prepares = 0;
  const requests = [];
  const changed = [];
  const translated = {
    'workspace10.assist.explain': 'Expliquer',
    'workspaceProfessor.comprehensionResponseRequired': 'Obtiens une réponse du Professeur avant Méthode.',
  };
  class ApiError extends Error {
    constructor(status, message, payload) {
      super(message);
      this.status = status;
      this.payload = payload;
    }
  }
  const jsx = (type, props) => ({ type, props: props ?? {} });
  const dependencies = {
    'react/jsx-runtime': { jsx, jsxs: jsx },
    react: {
      useEffect() {},
      useRef(value) {
        const index = cursor++;
        if (!(index in slots)) slots[index] = { current: value };
        return slots[index];
      },
      useState(value) {
        const index = cursor++;
        if (!(index in slots)) slots[index] = value;
        return [slots[index], (next) => {
          slots[index] = typeof next === 'function' ? next(slots[index]) : next;
        }];
      },
    },
    'react-native': { Linking: {}, ScrollView: 'ScrollView', Text: 'Text', View: 'View' },
    'expo-router': { useRouter: () => ({ push() {} }) },
    '@second-brain/shared': { WORKSPACE_ASSIST_ACTIONS: ['explain', 'suggest'] },
    '../../lib/client': {
      ApiError,
      api: async (url, options) => {
        requests.push({ url, ...options });
        return apiResponse;
      },
    },
    '../../lib/i18n': { useI18n: () => ({ t: (key) => translated[key] ?? key }) },
    '../../lib/design/theme': { useTokens: () => ({ colors: {}, spacing: {}, typography: {} }) },
    '../../lib/request-id': { createClientRequestId: () => 'workspace-assist-technical-request' },
    '../ds/core': Object.fromEntries(['Alert', 'Badge', 'Button', 'Card', 'Input'].map((key) => [key, key])),
    '../ds/sources': { SourceCitation: 'SourceCitation', SourcePreview: 'SourcePreview' },
    './tools': { WorkspaceTools: 'WorkspaceTools' },
  };
  const compiled = ts.transpileModule(assistant, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(compiled, {
    module, exports: module.exports,
    require: (name) => {
      assert.ok(name in dependencies, `unexpected component dependency: ${name}`);
      return dependencies[name];
    },
  });
  const professor = { currentPhase: 'COMPREHENSION', phaseSequence: 1, assistOperations: [], evidence: [] };
  const props = {
    workspaceId: 'technical-workspace', initialHistory: [], professor,
    shellKind: 'assignment', draftRevision: 6, sourceCount: 0,
    completionChecks: [], selectedText, selection: { start: 0, end: selectedText.length },
    onBeforeAssist: async () => { prepares++; return 7; },
    onAssistFailure: async () => {},
    onProfessorChange: (...args) => changed.push(args),
    onRequestTransition: async () => {
      if (transitionError) throw new ApiError(400, 'Safe generic validation', transitionError);
    },
  };
  return {
    requests, changed, translated,
    get prepares() { return prepares; },
    render() { cursor = 0; return module.exports.WorkspaceAssistant(props); },
  };
}

function elements(tree) {
  if (Array.isArray(tree)) return tree.flatMap(elements);
  if (!tree || typeof tree !== 'object') return [];
  return [tree, ...elements(tree.props?.children)];
}

const flushHandlers = () => new Promise((resolve) => setImmediate(resolve));

test('AW-5 Explain actually sends one contextual request, waits for save and renders the reply', async () => {
  let release;
  const response = new Promise((resolve) => { release = resolve; });
  const harness = assistantHarness({ apiResponse: response });
  const tree = harness.render();
  const explain = elements(tree).find((node) => node.props?.testID === 'workspace-professor-action-explain');
  explain.props.onPress();
  explain.props.onPress();
  await flushHandlers();
  assert.equal(harness.prepares, 1, 'a double click must not double-save or submit');
  assert.equal(harness.requests.length, 1);
  const request = harness.requests[0];
  assert.equal(request.url, '/workspaces/technical-workspace/assistant');
  assert.equal(request.method, 'POST');
  assert.equal(request.body.action, 'explain', 'never use stale action state');
  assert.equal(request.body.message, 'Expliquer');
  assert.equal(request.body.expectedPhase, 'COMPREHENSION');
  assert.equal(request.body.expectedRevision, 7, 'use the revision returned after save');
  assert.equal(request.requestId, request.body.requestId);
  release({
    reply: { id: 'technical-reply', role: 'assistant', content: 'Réponse pédagogique visible.', createdAt: new Date().toISOString() },
    professor: { currentPhase: 'COMPREHENSION', phaseSequence: 1, assistOperations: [], evidence: [{ id: 'technical-evidence' }] },
    revision: 7,
  });
  await flushHandlers();
  const updated = harness.render();
  assert.ok(elements(updated).some((node) => node.props?.children === 'Réponse pédagogique visible.'));
  assert.equal(harness.changed.length, 1);
  elements(updated).find((node) => node.props?.label === 'workspace10.assist.suggest').props.onPress();
  await flushHandlers();
  assert.equal(harness.requests.length, 1, 'other action selectors must retain their existing behavior');
});

test('AW-5 Explain preserves a learner request and selected passage', async () => {
  const harness = assistantHarness({
    selectedText: 'Consigne technique sélectionnée.',
    apiResponse: { reply: { id: 'reply', role: 'assistant', content: 'Explication.' }, professor: {}, revision: 7 },
  });
  elements(harness.render()).find((node) => node.type === 'Input').props.onChangeText('Clarifie ce passage.');
  elements(harness.render()).find((node) => node.props?.testID === 'workspace-professor-action-explain').props.onPress();
  await flushHandlers();
  assert.equal(harness.requests[0].body.message, 'Clarifie ce passage.');
  assert.equal(harness.requests[0].body.selectedText, 'Consigne technique sélectionnée.');
});

test('AW-5 transition explains a known missing-evidence code without rendering server prose', async () => {
  for (const [code, expected] of [
    ['workspace_professor_transition_criteria_not_met', 'Obtiens une réponse du Professeur avant Méthode.'],
    ['unrecognized_server_code', 'Safe generic validation'],
  ]) {
    const harness = assistantHarness({ transitionError: { code, message: 'Never expose raw server content.' } });
    elements(harness.render()).find((node) => node.props?.testID === 'workspace-professor-advance').props.onPress();
    await flushHandlers();
    const alerts = elements(harness.render()).filter((node) => node.type === 'Alert');
    assert.ok(alerts.some((node) => node.props.detail === expected));
    assert.ok(alerts.every((node) => node.props.detail !== 'Never expose raw server content.'));
    assert.equal(harness.requests.length, 0);
  }
});

test('AW-5 missing comprehension evidence has real copy in every locale supplement', () => {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(shellLocales, {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, {
    module, exports: module.exports, require: () => ({ extendLocale() {} }),
  });
  const catalogs = module.exports.workspaceShellsV1;
  assert.equal(Object.keys(catalogs).length, 32);
  const key = 'workspaceProfessor.comprehensionResponseRequired';
  assert.equal((i18n.match(new RegExp(`'${key.replaceAll('.', '\\.')}':`, 'g')) ?? []).length, 2);
  for (const [code, catalog] of Object.entries(catalogs)) {
    assert.ok(catalog[key]?.trim(), `${code} must explain the required Professor response`);
    assert.notEqual(catalog[key], 'Ask the Professor to explain this task and wait for the response before continuing to Method.');
  }
});
