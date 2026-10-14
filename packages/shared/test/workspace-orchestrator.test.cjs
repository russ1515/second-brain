const assert = require('node:assert/strict');
const test = require('node:test');
const {
  classifyWorkspace,
  workspaceShellFromTemplate,
  workspaceTemplateForShell,
  WORKSPACE_ORCHESTRATOR_POLICY_VERSION,
} = require('../dist/workspace-orchestrator');

test('routes a multi-exercise subject to Devoir & Exercices', () => {
  const result = classifyWorkspace({ capturedText: 'Devoir de mathématiques\nExercice 1 : résoudre.\nExercice 2 : démontrer.' });
  assert.equal(result.shellKind, 'assignment');
  assert.equal(result.internalTemplate, 'assignment');
  assert.deepEqual(result.reasons, ['assignment-exercises']);
});

test('routes a research problem and methodology to Mémoire & TFC', () => {
  const result = classifyWorkspace({ capturedText: 'Problématique de recherche\nQuestion de recherche\nMéthodologie et terrain.' });
  assert.equal(result.shellKind, 'thesis');
  assert.equal(result.internalTemplate, 'memoire');
});

test('preserves the TFC subtype when the evidence says final-year project', () => {
  const result = classifyWorkspace({ title: 'TFC', capturedText: 'Travail de fin de cycle avec méthodologie.' });
  assert.equal(result.shellKind, 'thesis');
  assert.equal(result.internalTemplate, 'tfc');
});

test('routes an argumentative structure to Dissertation & Essai', () => {
  const result = classifyWorkspace({ capturedText: 'Sujet argumentatif\nThèse\nAntithèse\nSynthèse' });
  assert.equal(result.shellKind, 'dissertation');
  assert.equal(result.internalTemplate, 'dissertation');
});

test('routes scientific sections to Article scientifique', () => {
  const result = classifyWorkspace({ capturedText: 'Abstract\nMethodology\nResults\nDiscussion\nReferences' });
  assert.equal(result.shellKind, 'article');
  assert.equal(result.internalTemplate, 'article');
});

test('routes an internship report to Rapport', () => {
  const result = classifyWorkspace({ capturedText: 'Rapport de stage\nActivités\nRésultats\nRecommandations' });
  assert.equal(result.shellKind, 'report');
  assert.equal(result.internalTemplate, 'report');
});

test('uses General adaptatif when evidence is insufficient', () => {
  const result = classifyWorkspace({ capturedText: 'Quelques idées à organiser pour mon projet.' });
  assert.equal(result.shellKind, 'general');
  assert.equal(result.internalTemplate, 'other');
  assert.equal(result.confidence, 'insufficient');
  assert.deepEqual(result.reasons, ['insufficient-signals']);
});

test('keeps academic research inside the General adaptatif family', () => {
  const result = classifyWorkspace({ capturedText: 'Academic research protocol and hypothesis for a reproducible study.' });
  assert.equal(result.shellKind, 'general');
  assert.equal(result.internalTemplate, 'academic-research');
  assert.deepEqual(result.reasons, ['general-research']);
});

test('falls back rather than forcing contradictory strong signals', () => {
  const result = classifyWorkspace({ capturedText: 'Rapport de stage et article scientifique à produire.' });
  assert.equal(result.shellKind, 'general');
  assert.equal(result.internalTemplate, 'other');
  assert.deepEqual(result.reasons, ['conflicting-signals']);
});

test('explicit user template wins without reclassification', () => {
  const result = classifyWorkspace({ explicitTemplate: 'report', capturedText: 'Article scientifique, Abstract, Methodology, Results.' });
  assert.equal(result.shellKind, 'report');
  assert.equal(result.internalTemplate, 'report');
  assert.equal(result.confidence, 'explicit');
});

test('six UX families map deterministically to all historical template groups', () => {
  assert.equal(workspaceTemplateForShell('assignment'), 'assignment');
  assert.equal(workspaceTemplateForShell('thesis'), 'memoire');
  assert.equal(workspaceTemplateForShell('thesis', 'tfc'), 'tfc');
  assert.equal(workspaceTemplateForShell('dissertation'), 'dissertation');
  assert.equal(workspaceTemplateForShell('article'), 'article');
  assert.equal(workspaceTemplateForShell('report'), 'report');
  assert.equal(workspaceTemplateForShell('general'), 'other');
  assert.equal(workspaceTemplateForShell('general', 'academic-research'), 'academic-research');
  assert.equal(workspaceShellFromTemplate('memoire'), 'thesis');
  assert.equal(workspaceShellFromTemplate('other'), 'general');
  assert.equal(WORKSPACE_ORCHESTRATOR_POLICY_VERSION, 'aw3-deterministic-v1');
});

test('bare memory and legal article terms do not force a workspace', () => {
  assert.equal(classifyWorkspace({ capturedText: 'Mémoire RAM et mémoire vive.' }).shellKind, 'general');
  assert.equal(classifyWorkspace({ capturedText: 'Article 12 du contrat.' }).shellKind, 'general');
});
