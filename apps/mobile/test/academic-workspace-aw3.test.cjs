'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const component = fs.readFileSync(path.resolve(__dirname, '../components/workspace/universal-capture.tsx'), 'utf8');
const screen = fs.readFileSync(path.resolve(__dirname, '../app/library/workspace/index.tsx'), 'utf8');
const draft = fs.readFileSync(path.resolve(__dirname, '../lib/workspace-capture-draft.ts'), 'utf8');
const orchestrator = fs.readFileSync(path.resolve(__dirname, '../../../packages/shared/src/workspace-orchestrator.ts'), 'utf8');

function blockBetween(source, start, end) {
  const startAt = source.indexOf(start);
  assert.notEqual(startAt, -1, `missing block start: ${start}`);
  const endAt = source.indexOf(end, startAt + start.length);
  assert.notEqual(endAt, -1, `missing block end: ${end}`);
  return source.slice(startAt, endAt);
}

test('Universal Capture integrates the shared deterministic orchestrator without a provider call', () => {
  assert.match(component, /classifyWorkspace\(\{/);
  assert.match(component, /explicitTemplate: templateOverridden \? template : initialTemplateHint/);
  assert.match(component, /trustedDocuments: trustedClassificationDocuments/);
  assert.match(component, /trustedCollectionNames/);
  assert.match(orchestrator, /export const WORKSPACE_ORCHESTRATOR_POLICY_VERSION = 'aw3-deterministic-v1'/);
  assert.doesNotMatch(orchestrator, /(?:from\s+['"][^'"]*(?:client|openai)|\b(?:fetch|api)\s*\()/i);
});

test('only owner-scoped Library evidence can enrich document classification', () => {
  assert.match(component, /const selectedIds = new Set\(sources\.filter/);
  assert.match(component, /documents[\s\S]*\.filter\(\(document\) => selectedIds\.has\(document\.id\)\)/);
  assert.match(component, /api<LibraryDocumentDetail>\(`\/library\/documents\/\$\{encodeURIComponent\(documentId\)\}`\)/);
  const classificationBlock = blockBetween(component, 'const trustedInitialDocument', 'useEffect(() => {');
  assert.match(classificationBlock, /trustedClassificationDocuments\.find\(\(document\) => document\.id === initialDocument\.id\)/);
  assert.match(classificationBlock, /title: initialDocument \? trustedInitialDocument\?\.title \?\? '' : title/);
  assert.doesNotMatch(classificationBlock, /initialDocument\?\.title|params\.title/);
});

test('the proposal has Continue and Modify, with exactly six user-facing families', () => {
  const familyBlock = blockBetween(orchestrator, 'export const WORKSPACE_SHELL_KINDS = [', '] as const;');
  const families = [...familyBlock.matchAll(/'([^']+)'/g)].map((match) => match[1]);
  assert.deepEqual(families, ['assignment', 'thesis', 'dissertation', 'article', 'report', 'general']);
  assert.match(component, /testID="workspace-orchestrator-proposal"/);
  assert.match(component, /testID="workspace-orchestrator-continue"/);
  assert.match(component, /testID="workspace-orchestrator-modify"/);
  assert.match(component, /testID="workspace-orchestrator-families"/);
  assert.match(component, /testID=\{`workspace-orchestrator-family-\$\{shellKind\}`\}/);
});

test('learner override wins and maps six families onto the historical templates', () => {
  assert.match(component, /setTemplate\(workspaceTemplateForShell\(shellKind, classification\.internalTemplate\)\)/);
  assert.match(component, /setTemplateOverridden\(true\)/);
  assert.match(component, /if \(!hydrated \|\| templateOverridden \|\| pendingCreate\) return/);
  assert.match(component, /explicitTemplate: templateOverridden \? template : initialTemplateHint/);
  assert.match(draft, /templateOverridden: Boolean\(draft\.templateOverridden\)/);
  assert.match(orchestrator, /case 'thesis': return detectedTemplate === 'tfc' \|\| detectedTemplate === 'memoire'/);
  assert.match(orchestrator, /case 'general': return detectedTemplate === 'academic-research' \|\| detectedTemplate === 'other'/);
});

test('low-confidence and conflicting classification fall back to the existing general template', () => {
  assert.match(orchestrator, /return result\('general', 'other', 'insufficient', \['conflicting-signals'\]\)/);
  assert.match(orchestrator, /return result\('general', 'other', 'insufficient', \['insufficient-signals'\]\)/);
  assert.match(component, /classification\.confidence === 'insufficient'/);
});

test('workspace create submits only persisted workspace fields, never transient classifier metadata', () => {
  const createBlock = blockBetween(component, 'const createWorkspace = async', 'const attachToWorkspace = async');
  assert.match(createBlock, /const body = \{[\s\S]*title: title\.trim\(\),[\s\S]*template: selectedTemplate,[\s\S]*objective: objective\.trim\(\),[\s\S]*sources/);
  assert.match(createBlock, /body: \{ \.\.\.body, requestId \}/);
  assert.doesNotMatch(createBlock, /shellKind|confidence|reasons|policyVersion|classification:/);
});

test('create retry freezes its final template and reuses the persisted signature and request id', () => {
  const createBlock = blockBetween(component, 'const createWorkspace = async', 'const attachToWorkspace = async');
  assert.match(createBlock, /const signature = workspaceCaptureSignature\(JSON\.stringify\(body\)\)/);
  assert.match(createBlock, /pendingCreate\?\.signature === signature[\s\S]*\? pendingCreate/);
  assert.match(createBlock, /createRequestId: request\.requestId/);
  assert.match(createBlock, /createSignature: request\.signature/);
  assert.match(component, /const creationFrozen = Boolean\(pendingCreate\)/);
  assert.match(component, /disabled=\{busy \|\| creationFrozen\}/);
  assert.match(draft, /!Object\.prototype\.hasOwnProperty\.call\(value, 'templateOverridden'\)/);
  assert.match(draft, /Boolean\(createRequestId && createSignature\)/);
});

test('only a definitive application 4xx clears the pending create idempotency pair', () => {
  const createBlock = blockBetween(component, 'const createWorkspace = async', 'const attachToWorkspace = async');
  const definitiveFailure = blockBetween(component, 'function isDefinitiveWorkspaceCreateFailure', 'function documentCapturePhase');
  assert.match(definitiveFailure, /error instanceof ApiError/);
  assert.match(definitiveFailure, /error\.status >= 400/);
  assert.match(definitiveFailure, /error\.status < 500/);
  assert.match(definitiveFailure, /error\.status !== 408/);
  assert.match(createBlock, /if \(isDefinitiveWorkspaceCreateFailure\(caught\)\) \{[\s\S]*setPendingCreate\(null\)/);
  assert.match(createBlock, /createRequestId: null,[\s\S]*createSignature: null/);
  assert.equal((createBlock.match(/setPendingCreate\(null\)/g) ?? []).length, 1);
  assert.match(component, /const creationFrozen = Boolean\(pendingCreate\)/);
});

test('automatic title keeps following capture evidence until the learner edits it', () => {
  assert.match(component, /const \[titleEdited, setTitleEdited\] = useState\(false\)/);
  assert.match(component, /if \(!hydrated \|\| phase !== 'READY' \|\| titleEdited \|\| pendingCreate\) return/);
  assert.match(component, /if \(suggestion && suggestion !== title\) setTitle\(suggestion\)/);
  assert.match(component, /onChangeText=\{\(value\) => \{ setTitle\(value\); setTitleEdited\(true\); \}\}/);
  assert.match(component, /const firstLine = capturedText\.split\(\/\\r\?\\n\/\)[\s\S]*\.find\(Boolean\)/);
  assert.doesNotMatch(component, /phase !== 'READY' \|\| title\.trim\(\)/);
});

test('the existing explicit route choice is a trusted override but an absent type is not assignment evidence', () => {
  assert.match(screen, /const initialTemplateHint = explicitWorkspaceTemplateFromParam\(params\.type\)/);
  assert.match(screen, /initialTemplateHint=\{initialTemplateHint\}/);
  assert.match(screen, /function explicitWorkspaceTemplateFromParam[\s\S]*return undefined/);
  assert.match(component, /useState\(Boolean\(initialTemplateHint\)\)/);
  assert.match(component, /setTemplateOverridden\(draft\.templateOverridden \|\| Boolean\(initialTemplateHint\)\)/);
  assert.match(orchestrator, /if \(input\.explicitTemplate\)/);
});

test('legacy manual configuration remains available with every historical template', () => {
  assert.match(screen, /testID="workspace-manual-toggle"/);
  assert.match(screen, /manualOpen \? <Card[\s\S]*testID="workspace-create"/);
  assert.match(screen, /WORKSPACE_TEMPLATES\.map/);
  assert.match(screen, /testID=\{`workspace-template-\$\{value\}`\}/);
  for (const template of ['assignment', 'memoire', 'tfc', 'dissertation', 'article', 'report', 'academic-research', 'other']) {
    assert.match(orchestrator, new RegExp(`'${template.replace('-', '\\-')}'`));
  }
});
