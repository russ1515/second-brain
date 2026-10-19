'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

const root = path.resolve(__dirname, '../../..');
const screen = fs.readFileSync(path.join(__dirname, '../app/library/workspace/[id].tsx'), 'utf8');
const shell = fs.readFileSync(path.join(__dirname, '../components/workspace/shell.tsx'), 'utf8');
const orchestratorPath = path.join(root, 'packages/shared/src/workspace-orchestrator.ts');
const orchestrator = fs.readFileSync(orchestratorPath, 'utf8');
const i18n = fs.readFileSync(path.join(__dirname, '../lib/i18n.tsx'), 'utf8');
const localeIndex = fs.readFileSync(path.join(__dirname, '../lib/locales/index.ts'), 'utf8');
const shellLocales = fs.readFileSync(path.join(__dirname, '../lib/locales/workspace-shells-v1.ts'), 'utf8');
const browserPathTest = fs.readFileSync(path.join(__dirname, 'workspace-paths-browser.mjs'), 'utf8');
const browserRecoveryTest = fs.readFileSync(path.join(__dirname, 'academic-workspace-aw2b-browser.mjs'), 'utf8');

function loadOrchestrator() {
  const compiled = ts.transpileModule(orchestrator, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: orchestratorPath,
  }).outputText;
  const module = { exports: {} };
  new Function('module', 'exports', 'require', compiled)(module, module.exports, require);
  return module.exports;
}

test('all eight historical templates deterministically resolve to the six AW-4 shells', () => {
  const { workspaceShellFromTemplate } = loadOrchestrator();
  const expected = {
    assignment: 'assignment',
    memoire: 'thesis',
    tfc: 'thesis',
    dissertation: 'dissertation',
    article: 'article',
    report: 'report',
    'academic-research': 'general',
    other: 'general',
  };
  assert.deepEqual(
    Object.fromEntries(Object.keys(expected).map((template) => [template, workspaceShellFromTemplate(template)])),
    expected,
  );
});

test('the persisted template selects one presentational shell without persisting shellKind', () => {
  assert.match(screen, /const shellKind = workspaceShellFromTemplate\(workspace\.template\)/);
  assert.match(screen, /<WorkspaceShell[\s\S]*shellKind=\{shellKind\}/);
  assert.match(shell, /testID=\{`workspace-shell-\$\{shellKind\}`\}/);
  assert.doesNotMatch(screen, /patchWorkspace\(\{\s*shellKind|body:\s*\{[^}]*shellKind/);
});

test('one common core owns the editor, autosave, sources and existing assistant', () => {
  assert.equal((screen.match(/<EditorPanel\b/g) ?? []).length, 1);
  assert.equal((screen.match(/<WorkspaceAssistant\b/g) ?? []).length, 1);
  assert.equal((screen.match(/<SourcesPanel\b/g) ?? []).length, 1);
  assert.equal((screen.match(/\/autosave`/g) ?? []).length, 1);
  assert.match(shell, /briefPanel: ReactNode[\s\S]*editorPanel: ReactNode[\s\S]*assistantPanel: ReactNode/);
  assert.doesNotMatch(shell, /\bapi\s*\(|fetch\s*\(|OpenAI|RetrievalService/);
});

test('the six desktop experiences are distinct compositions of the same slots', () => {
  for (const kind of ['assignment', 'thesis', 'dissertation', 'article', 'report', 'general']) {
    assert.match(shell, new RegExp(`workspace-shell-desktop-${kind}`));
  }
  assert.match(shell, /shellKind === 'assignment'[\s\S]*\{briefPanel\}\{sourcesPanel\}\{planPanel\}\{completionPanel\}[\s\S]*\{editorPanel\}\{assistantPanel\}/);
  assert.match(shell, /shellKind === 'thesis'[\s\S]*\{planPanel\}\{briefPanel\}\{completionPanel\}[\s\S]*\{editorPanel\}\{assistantPanel\}[\s\S]*\{sourcesPanel\}/);
  assert.match(shell, /workspace-shell-desktop-general[\s\S]*\{briefPanel\}\{sourcesPanel\}\{planPanel\}\{completionPanel\}[\s\S]*\{editorPanel\}\{assistantPanel\}/);
});

test('the brief is a readable summary by default and reuses the existing edit path', () => {
  assert.match(screen, /const \[editing, setEditing\] = useState\(false\)/);
  assert.match(screen, /const visibleFields = definition\.fields\.filter/);
  assert.match(screen, /!editing \? <>[\s\S]*visibleFields\.map[\s\S]*setEditing\(true\)/);
  assert.match(screen, /editing \? <View[\s\S]*workspace10\.saveNow[\s\S]*app\.dismiss/);
  assert.match(screen, /const saved = await onUpdate\(\{/);
  assert.match(screen, /if \(saved\) setEditing\(false\)/);
  assert.match(screen, /const patchWorkspace = async \(patch: Record<string, unknown>\): Promise<boolean>/);
  assert.match(screen, /return false;[\s\S]*return true;[\s\S]*return false;/);
});

test('dissertation is a three-part view of one plan and one persisted draft', () => {
  assert.match(shell, /workspace-shell-reasoning-view/);
  assert.match(shell, /workspaceShell\.dissertation\.thesis/);
  assert.match(shell, /workspaceShell\.dissertation\.antithesis/);
  assert.match(shell, /research10\.synthesis/);
  assert.match(shell, /stepId: 'build-argument'/);
  assert.match(shell, /stepId: 'counterargument'/);
  assert.match(shell, /stepId: 'draft'/);
  assert.match(shell, /plan\.find\(\(item\) => item\.stepId === section\.stepId\)/);
  assert.doesNotMatch(shell, /plan\[index\]/);
  assert.doesNotMatch(shell, /thesisDraft|antithesisDraft|synthesisDraft/);
  assert.equal((screen.match(/const \[content, setContent\]/g) ?? []).length, 1);
});

test('article and report previews render only actual persisted plan items', () => {
  assert.match(shell, /\(shellKind === 'article' \|\| shellKind === 'report'\) && plan\.length/);
  assert.match(shell, /\{plan\.map\(\(item\) =>/);
  assert.match(shell, /\{item\.title\}/);
  assert.doesNotMatch(shell, /\['title',\s*'abstract'|IMRaD|bibliography engine/i);
});

test('tablet and mobile use bounded responsive panels instead of shrinking desktop columns', () => {
  assert.match(screen, /const desktop = width >= 1_400/);
  assert.match(shell, /testID="workspace-shell-tablet"/);
  assert.match(shell, /testID="workspace-shell-mobile"/);
  assert.match(shell, /display: activeArea === 'plan' \? 'flex' : 'none'/);
  assert.match(shell, /display: activeArea === 'work' \? 'flex' : 'none'/);
  assert.match(shell, /display: activeArea === 'sources' \? 'flex' : 'none'/);
  assert.match(shell, /importantForAccessibility=\{activeArea === 'work' \? 'auto' : 'no-hide-descendants'\}/);
  assert.match(shell, /!desktop && !tabletSplit \? <SegmentedControl/);
  assert.match(shell, /workspace-shell-tablet[\s\S]*\{planStack\}[\s\S]*\{sourcesPanel\}[\s\S]*\{workStack\}/);
  assert.match(shell, /options=\{WORKSPACE_SHELL_AREAS\}/);
  assert.deepEqual([...shell.matchAll(/'plan' \| 'work' \| 'sources'|\['plan', 'work', 'sources'\]/g)].length > 0, true);
});

test('AW-4 copy is complete for 34 locales and RTL relies on the global document direction', () => {
  for (const key of ['workspaceShell.dissertation.thesis', 'workspaceShell.dissertation.antithesis']) {
    assert.match(i18n, new RegExp(`'${key.replaceAll('.', '\\.')}'`));
  }
  const externalCodes = [...shellLocales.matchAll(/^\s{2}(?:'([^']+)'|([a-zA-Z-]+)):\s*\{/gm)]
    .map((match) => match[1] ?? match[2]);
  assert.equal(new Set(externalCodes).size, 32);
  assert.match(localeIndex, /import '\.\/workspace-shells-v1'/);
  assert.match(i18n, /document\.documentElement\.dir = localeDirection\(locale\)/);
  assert.doesNotMatch(shell, /row-reverse|direction:\s*'ltr'/);
});

test('AW-4 does not expose future AW-5 through AW-8 capabilities', () => {
  assert.doesNotMatch(shell, /state machine|hypothesis checker|IMRaD intelligent|export (?:PDF|DOCX)|citation endpoint/i);
  assert.doesNotMatch(screen, /RetrievalService|\/citations|\/export|\/bibliography/);
});

test('authenticated browser gates open the legacy form and verify shell, responsive and RTL behavior', () => {
  assert.match(browserPathTest, /workspace-manual-toggle/);
  assert.match(browserRecoveryTest, /workspace-manual-toggle/);
  assert.match(browserPathTest, /workspace-shell-\$\{expectedShell\}/);
  assert.match(browserPathTest, /workspace-shell-mobile/);
  assert.match(browserPathTest, /workspace-shell-tablet/);
  assert.match(browserPathTest, /mobileTabs\.nth\(0\)\.click/);
  assert.match(browserPathTest, /mobileTabs\.nth\(2\)\.click/);
  assert.match(browserPathTest, /assistant draft survives mobile tabs/);
  assert.match(browserPathTest, /tablet has no misleading tabs/);
  assert.match(browserPathTest, /RTL_DOCUMENT_DIRECTION/);
  assert.match(browserPathTest, /RTL_TRANSLATED_SHELL_CONTENT/);
  assert.match(browserPathTest, /locale: 'en'/);
});
