'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const ts = require('typescript');

const source = fs.readFileSync(path.resolve(__dirname, '../components/workspace/autopilot.tsx'), 'utf8');
const screen = fs.readFileSync(path.resolve(__dirname, '../app/library/workspace/[id].tsx'), 'utf8');

function harness({ initialStatus, phase = 'CAPTURE', pending = false, responder, prepare = () => 1, accept = true, history = [] } = {}) {
  let cursor = 0;
  let dirty = true;
  let tree;
  let requestSequence = 0;
  const slots = [];
  const effects = [];
  const requests = [];
  const callbacks = [];
  const timers = new Set();
  let workspace = {
    id: 'technical-workspace', status: 'active', autosaveRevision: 1, assistantHistory: history,
    professor: { currentPhase: phase, phaseSequence: 0 },
    progress: { workflow: initialStatus ? { autopilot: {
      version: 1, runId: 'technical-run', status: initialStatus,
      consent: { version: 1, grantedAt: '2026-10-19T00:00:00Z' },
      ...(pending ? { activeRequest: { requestId: 'pending-test', status: 'pending' } } : {}),
      receipts: [],
    } } : {} },
  };
  const jsx = (type, props) => ({ type, props: props ?? {} });
  const dependencies = {
    'react/jsx-runtime': { jsx, jsxs: jsx },
    react: {
      useRef(value) { const n = cursor++; return slots[n] ??= { current: value }; },
      useState(value) {
        const n = cursor++;
        if (!(n in slots)) slots[n] = value;
        return [slots[n], (next) => { const value = typeof next === 'function' ? next(slots[n]) : next; if (value !== slots[n]) dirty = true; slots[n] = value; }];
      },
      useEffect(effect, deps) {
        const n = cursor++;
        if (!slots[n] || deps.some((value, i) => value !== slots[n].deps[i])) {
          effects.push(() => { slots[n]?.cleanup?.(); slots[n] = { deps, cleanup: effect() }; });
        }
      },
    },
    'react-native': { Text: 'Text', View: 'View' },
    '../../lib/client': { api: async (url, options = {}) => {
      requests.push({ url, ...options });
      return responder ? responder(workspace, options.body, options) : workspace;
    } },
    '../../lib/request-id': { createClientRequestId: () => `technical-command-${++requestSequence}` },
    '../../lib/i18n': { useI18n: () => ({ t: (key) => key }) },
    '../../lib/design/theme': { useTokens: () => ({ colors: {}, spacing: {}, typography: {} }) },
    '../ds/core': Object.fromEntries(['Alert', 'Button', 'Card'].map((key) => [key, key])),
    '../markdown': { Markdown: 'Markdown' },
  };
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(compiled, {
    module, exports: module.exports, AbortController,
    setTimeout: (callback) => { timers.add(callback); return callback; },
    clearTimeout: (callback) => timers.delete(callback),
    require: (name) => { assert.ok(name in dependencies, `Unexpected dependency ${name}`); return dependencies[name]; },
  });
  const props = {
    onPrepare: async (action) => prepare(action),
    onWorkspace: (next) => { if (accept) { workspace = next; dirty = true; } return accept; },
    manualOpen: false,
    onQuestion: () => callbacks.push('question'),
    onAddSource: () => callbacks.push('source'),
    onOrientation: () => callbacks.push('orientation'),
    onContinueEditing: () => callbacks.push('continue'),
    onToggleManual: () => { props.manualOpen = !props.manualOpen; callbacks.push('manual'); dirty = true; },
  };
  const render = () => {
    cursor = 0; dirty = false;
    tree = module.exports.WorkspaceAutopilot({ ...props, workspace });
    while (effects.length) effects.shift()();
    return tree;
  };
  const flush = async () => { for (let i = 0; i < 40; i++) { if (dirty) render(); await new Promise(setImmediate); } };
  return {
    requests, callbacks, timers, props, render, flush,
    get workspace() { return workspace; },
    get tree() { return tree; },
    click(id) { const button = nodes(tree).find((node) => node.props?.testID === id); assert.ok(button, `${id} visible`); return button.props.onPress(); },
    unmount() { for (const slot of slots) slot?.cleanup?.(); },
  };
}

function nodes(tree) {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!tree || typeof tree !== 'object') return [];
  return [tree, ...nodes(tree.props?.children)];
}
function stateWith(workspace, status, phase = workspace.professor.currentPhase) {
  return { ...workspace, autosaveRevision: workspace.autosaveRevision + 1,
    professor: { ...workspace.professor, currentPhase: phase, phaseSequence: workspace.professor.phaseSequence + 1 },
    progress: { workflow: { autopilot: { ...workspace.progress.workflow.autopilot, status, consent: { version: 1 } } } } };
}

test('legacy dossiers never start an AI operation without the one consent action', async () => {
  const h = harness({ responder: (work, body) => stateWith(work, body.action === 'start' ? 'PAUSED' : 'STOPPED') });
  h.render(); await h.flush();
  assert.equal(h.requests.length, 0);
  h.click('workspace-autopilot-start'); await h.flush();
  assert.equal(h.requests.length, 1);
  assert.equal(h.requests[0].body.action, 'start');
  assert.equal(h.requests[0].body.consent, true);
  h.unmount();
});

test('persisted RUNNING resumes canonical phases sequentially and stops after completion', async () => {
  let inFlight = 0;
  let maximum = 0;
  const phases = ['COMPREHENSION', 'METHOD', 'WORK', 'VERIFICATION', 'FINALIZATION', 'DECONSTRUCTION'];
  const h = harness({ initialStatus: 'RUNNING', responder: async (work, body) => {
    assert.equal(body.action, 'step');
    maximum = Math.max(maximum, ++inFlight);
    await new Promise(setImmediate);
    inFlight--;
    const phase = phases.shift();
    return stateWith(work, phases.length ? 'RUNNING' : 'COMPLETED', phase);
  } });
  h.render(); await h.flush();
  assert.equal(h.requests.length, 6);
  assert.equal(maximum, 1);
  assert.equal(new Set(h.requests.map((r) => r.body.requestId)).size, 6);
  assert.equal(h.workspace.professor.currentPhase, 'DECONSTRUCTION');
  assert.equal(h.workspace.progress.workflow.autopilot.status, 'COMPLETED');
  h.unmount();
});

test('a pending persisted provider operation is only polled and never resubmitted', async () => {
  const h = harness({ initialStatus: 'RUNNING', pending: true });
  h.render(); await h.flush();
  assert.equal(h.requests.length, 0);
  assert.equal(h.timers.size, 1);
  await [...h.timers][0]();
  await h.flush();
  assert.equal(h.requests.length, 1);
  assert.equal(h.requests[0].method, undefined);
  assert.equal(h.requests[0].body, undefined);
  h.unmount();
});

test('a provider failure pauses the client without repeating the paid command', async () => {
  const h = harness({ initialStatus: 'RUNNING', responder: (work, body) => {
    if (body) throw new Error('Provider unavailable');
    return stateWith(work, 'PAUSED_ERROR');
  } });
  h.render(); await h.flush();
  assert.equal(h.requests.filter((r) => r.body).length, 1);
  assert.equal(h.requests.filter((r) => !r.body).length, 1);
  assert.equal(h.workspace.progress.workflow.autopilot.status, 'PAUSED_ERROR');
  h.unmount();
});

test('an uncertain command can observe its pending receipt without repeating the provider call', async () => {
  const h = harness({ initialStatus: 'RUNNING', responder: (work, body) => {
    if (body) throw new Error('Transport interrupted');
    return { ...work, progress: { workflow: { autopilot: {
      ...work.progress.workflow.autopilot,
      activeRequest: { requestId: 'server-pending-receipt', status: 'pending' },
    } } } };
  } });
  h.render(); await h.flush();
  assert.equal(h.requests.filter((request) => request.body).length, 1);
  assert.equal(h.timers.size, 1, 'the pending receipt remains observable even after a transport failure');
  h.unmount();
});

test('unsaved/conflicting input prevents an automatic request', async () => {
  const h = harness({ initialStatus: 'RUNNING', prepare: () => null });
  h.render(); await h.flush();
  assert.equal(h.requests.length, 0);
  h.unmount();
});

test('question/source/orientation pause the server before opening existing controls', async () => {
  for (const [control, callback] of [['question', 'question'], ['source', 'source'], ['orientation', 'orientation']]) {
    const h = harness({ initialStatus: 'RUNNING', pending: true, responder: (work, body) => stateWith(work, body.action === 'pause' ? 'PAUSED' : 'STOPPED') });
    h.render();
    h.click(`workspace-autopilot-${control}`); await h.flush();
    assert.equal(h.requests.length, 1);
    assert.equal(h.requests[0].body.action, 'pause');
    assert.deepEqual(h.callbacks, [callback]);
    h.unmount();
  }
});

test('unmount aborts the current UI request and schedules no following AI operation', async () => {
  let resolve;
  let signal;
  const h = harness({ initialStatus: 'RUNNING', responder: (work, body, options) => {
    signal = options.signal;
    return new Promise((done) => { resolve = () => done(stateWith(work, 'RUNNING', 'COMPREHENSION')); });
  } });
  h.render(); await new Promise(setImmediate);
  h.unmount();
  assert.equal(signal.aborted, true);
  resolve(); await h.flush();
  assert.equal(h.requests.length, 1);
});

test('Resume leaves optional manual controls and continues the existing persisted run', async () => {
  const h = harness({ initialStatus: 'PAUSED', responder: (work, body) => stateWith(work, body.action === 'resume' ? 'RUNNING' : 'COMPLETED') });
  h.props.manualOpen = true;
  h.render();
  h.click('workspace-autopilot-resume'); await h.flush();
  assert.deepEqual(h.requests.map((request) => request.body.action), ['resume', 'step']);
  assert.equal(h.props.manualOpen, false);
  assert.equal(h.workspace.progress.workflow.autopilot.status, 'COMPLETED');
  h.unmount();
});

test('canonical draft synchronization preserves concurrent typing and manual mode stays secondary', () => {
  assert.match(screen, /localDraft !== lastSavedRef\.current \|\| conflictActiveRef\.current/);
  assert.match(screen, /setConflictDraft\(\{ content: localDraft/);
  assert.match(screen, /manualOpen \? <View/);
  assert.match(screen, /workspace-original-instructions/);
  assert.match(screen, /originalInstructions = workspace\.brief\.fields\.userInstructions/);
});

test('structured Autopilot text and deconstruction each render once while legacy replies remain readable', () => {
  const structured = harness({ initialStatus: 'COMPLETED', history: [{
    role: 'assistant', content: 'Résultat.\n\nDémarche.',
    autopilot: { runId: 'technical-run', output: { text: 'Résultat.', deconstruction: 'Démarche.' } },
  }] });
  const rendered = nodes(structured.render()).filter((node) => node.type === 'Markdown').map((node) => node.props.text);
  assert.deepEqual(rendered, ['Résultat.', 'Démarche.']);
  structured.unmount();
  const legacy = harness({ history: [{ role: 'assistant', content: 'Ancienne réponse.' }] });
  assert.deepEqual(nodes(legacy.render()).filter((node) => node.type === 'Markdown').map((node) => node.props.text), ['Ancienne réponse.']);
  legacy.unmount();
});
