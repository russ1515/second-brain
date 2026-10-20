'use strict';

const assert = require('node:assert/strict');
const { mkdtemp, chmod, readFile, readdir, stat, symlink, writeFile, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const test = require('node:test');
const { createHash } = require('node:crypto');
const { writePrivateWorkspaceWorkDiagnostic } = require('../dist/workspaces/workspace-work-diagnostics.js');

const SCOPE = { ownerId: 'downstream-technical-owner', workspaceId: 'downstream-technical-workspace',
  runId: 'downstream-technical-run', requestId: 'downstream-technical-request' };
const hash = value => createHash('sha256').update(value).digest('hex');
function input(phase = 'VERIFICATION') {
  const draft = 'Trois cahiers coûtent 12 euros. Le livre coûte 7 euros. Le total est de 19 euros.';
  const draftFingerprint = hash(draft);
  const criterion = { id: 'required-1', requirement: 'Calculer le total.', required: true, applicable: true, classification: 'REQUIRED' };
  const anchor = { source: 'draft', revision: 3, startOffset: 56, endOffset: draft.length,
    excerpt: draft.slice(56), draftFingerprint };
  const parsedOutput = phase === 'FINALIZATION'
    ? { text: 'Le travail vérifié est prêt.', deconstruction: 'Les deux coûts ont été additionnés puis vérifiés.', issues: [],
      finalizationEvidence: { draftRevision: 3, draftFingerprint,
        verificationReplyId: 'technical-verification-reply', sourceFingerprint: hash('[]') } }
    : { text: 'Vérification enregistrée.', taskFulfillment: { fulfilled: true, contractMatchesTask: true,
      scope: 'entire-task', draftRevision: 3, draftFingerprint, evidenceSource: 'PERSISTED_DRAFT',
      criterionReviews: [{ criterionId: 'required-1', fulfilled: true, status: 'SATISFIED',
        evidenceOrigin: 'VERIFIER_QUOTE', evidenceAnchors: [anchor] }] } };
  const rawText = JSON.stringify(parsedOutput);
  return { trace: { workspaceId: SCOPE.workspaceId, shellKind: 'assignment', intent: 'assignment-exercise',
    artifactType: 'ANSWER_DRAFT', expectedWorkOutputType: 'ANSWER_DRAFT', currentPhase: phase },
    providerResponse: { text: rawText, provider: 'openai', model: 'configured-model', usage: { inputTokens: 20, outputTokens: 10 } },
    rawText, normalizedText: rawText, parserResult: 'PASS', validatorResult: 'PASS', rejectReasonCode: 'NONE',
    technicalEvidence: { userInstructions: 'Calculer le total.', canonicalInstructions: 'User instructions:\nCalculer le total.',
      criteriaExtraction: [criterion], criteriaMatrix: [{ criterionId: criterion.id, status: 'SATISFIED', evidence: [anchor] }],
      parsedOutput, persistedDraft: draft, draftRevision: 3 } };
}
async function fixture(t, overrides = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'sb-downstream-diagnostic-'));
  await chmod(directory, 0o700);
  t.after(() => rm(directory, { recursive: true, force: true }));
  const config = { version: 1, ...SCOPE, directory, expiresAt: new Date(Date.now() + 60_000).toISOString(),
    fullTechnicalEvidence: true, ...overrides };
  return { directory, config: JSON.stringify(config) };
}
async function artifact(directory, result) {
  assert.equal(result.status, 'WRITTEN');
  const file = join(directory, result.fileName);
  return { file, body: await readFile(file, 'utf8'), data: JSON.parse(await readFile(file, 'utf8')) };
}

test('downstream diagnostics remain disabled normally and legacy full-evidence scope stays WORK-only', async t => {
  const { directory, config } = await fixture(t);
  assert.equal((await writePrivateWorkspaceWorkDiagnostic(undefined, SCOPE, input())).status, 'DISABLED');
  for (const phase of ['VERIFICATION', 'FINALIZATION', 'DECONSTRUCTION']) {
    assert.equal((await writePrivateWorkspaceWorkDiagnostic(config, SCOPE, input(phase))).status, 'SCOPE_MISMATCH');
  }
  assert.deepEqual(await readdir(directory), []);
  assert.equal((await writePrivateWorkspaceWorkDiagnostic(config, SCOPE, input('WORK'))).status, 'WRITTEN');
});

test('explicit V/F phase captures only the exact scoped technical request with private exclusive artifacts', async t => {
  for (const phase of ['VERIFICATION', 'FINALIZATION']) {
    const f = await fixture(t, { phase }); const value = input(phase);
    const saved = await artifact(f.directory, await writePrivateWorkspaceWorkDiagnostic(f.config, SCOPE, value));
    assert.equal(saved.data.trace.currentPhase, phase);
    assert.deepEqual(saved.data.scope, SCOPE);
    assert.equal(saved.data.fullTextRetained, true);
    assert.equal(saved.data.privacy.fidelity, 'EXACT');
    assert.equal(saved.data.technicalEvidence.providerText, value.rawText);
    assert.equal(saved.data.technicalEvidence.persistedDraft, value.technicalEvidence.persistedDraft);
    assert.equal(saved.data.technicalEvidence.draftRevision, 3);
    if (process.platform !== 'win32') assert.equal((await stat(saved.file)).mode & 0o777, 0o600);
    assert.equal((await writePrivateWorkspaceWorkDiagnostic(f.config, SCOPE, value)).status, 'WRITE_FAILED');
    assert.equal(await readFile(saved.file, 'utf8'), saved.body);
  }
});

test('exact owner/workspace/run/request and input trace bind independently; no other phase or account is captured', async t => {
  const f = await fixture(t, { phase: 'VERIFICATION' }); const value = input();
  for (const key of Object.keys(SCOPE)) {
    assert.equal((await writePrivateWorkspaceWorkDiagnostic(f.config, { ...SCOPE, [key]: 'another-technical-target' }, value)).status, 'SCOPE_MISMATCH');
  }
  assert.equal((await writePrivateWorkspaceWorkDiagnostic(f.config, SCOPE,
    { ...value, trace: { ...value.trace, workspaceId: 'another-technical-workspace' } })).status, 'SCOPE_MISMATCH');
  assert.equal((await writePrivateWorkspaceWorkDiagnostic(f.config, SCOPE, input('FINALIZATION'))).status, 'SCOPE_MISMATCH');
  assert.deepEqual(await readdir(f.directory), []);
});

test('invalid phase and expired/overlong full capture authorization fail closed without files', async t => {
  const f = await fixture(t, { phase: 'VERIFICATION' }); const base = JSON.parse(f.config);
  for (const phase of ['DECONSTRUCTION', '*', 'VERIFICATION,FINALIZATION', null]) {
    assert.equal((await writePrivateWorkspaceWorkDiagnostic(JSON.stringify({ ...base, phase }), SCOPE, input())).status, 'UNSAFE_CONFIG');
  }
  assert.equal((await writePrivateWorkspaceWorkDiagnostic(JSON.stringify({ ...base,
    expiresAt: new Date(Date.now() - 1000).toISOString() }), SCOPE, input())).status, 'EXPIRED');
  assert.equal((await writePrivateWorkspaceWorkDiagnostic(JSON.stringify({ ...base,
    expiresAt: new Date(Date.now() + 5 * 60 * 60_000).toISOString() }), SCOPE, input())).status, 'UNSAFE_CONFIG');
  assert.deepEqual(await readdir(f.directory), []);
});

test('PARSER FAIL retains the complete safe raw/normalized provider text without inventing parser output', async t => {
  const f = await fixture(t, { phase: 'VERIFICATION' }); const value = input();
  value.rawText = 'Invalid JSON but safely retained technical response. '.repeat(100);
  value.normalizedText = value.rawText;
  value.parserResult = 'FAIL'; value.validatorResult = 'NOT_REACHED'; value.rejectReasonCode = 'PARSE_INVALID_JSON';
  delete value.technicalEvidence.parsedOutput;
  const saved = await artifact(f.directory, await writePrivateWorkspaceWorkDiagnostic(f.config, SCOPE, value));
  assert.ok(value.rawText.length > 1500);
  assert.equal(saved.data.parserResult, 'FAIL');
  assert.equal(saved.data.validatorResult, 'NOT_REACHED');
  assert.equal(saved.data.rejectReasonCode, 'PARSE_INVALID_JSON');
  assert.equal(saved.data.fullTextRetained, true);
  assert.equal(saved.data.privacy.fidelity, 'EXACT');
  assert.equal(saved.data.technicalEvidence.providerText, value.rawText);
  assert.equal(saved.data.technicalEvidence.normalizedText, value.normalizedText);
  assert.equal(saved.data.technicalEvidence.parsedOutput, null);
});

test('canonical Verification anchors and server FINALIZATION evidence survive the whitelist without fidelity loss', async t => {
  for (const phase of ['VERIFICATION', 'FINALIZATION']) {
    const f = await fixture(t, { phase }); const value = input(phase);
    const saved = await artifact(f.directory, await writePrivateWorkspaceWorkDiagnostic(f.config, SCOPE, value));
    assert.equal(saved.data.privacy.redacted, false);
    assert.deepEqual(saved.data.privacy.omittedFields, []);
    assert.deepEqual(saved.data.technicalEvidence.parsedOutput, value.technicalEvidence.parsedOutput);
    assert.deepEqual(saved.data.technicalEvidence.criteriaMatrix, value.technicalEvidence.criteriaMatrix);
  }
});

test('downstream full diagnostics redact credentials and reject arbitrary provider/user fields without logging them', async t => {
  const f = await fixture(t, { phase: 'FINALIZATION' }); const value = input('FINALIZATION');
  const dummyKey = ['sk-', 'syntheticCredentialForRedaction123456789'].join('');
  const dummyBearer = 'synthetic-private-bearer-credential';
  const unsafe = `password=synthetic-private-password\nAuthorization: Bearer ${dummyBearer}\n${dummyKey}\nforeign.person@example.test`;
  value.rawText += `\n${unsafe}`; value.normalizedText = value.rawText;
  value.technicalEvidence.parsedOutput.untrustedUser = { email: 'foreign.person@example.test' };
  value.technicalEvidence.parsedOutput.arbitraryHeaders = { authorization: dummyBearer };
  value.providerResponse.apiKey = dummyKey;
  const saved = await artifact(f.directory, await writePrivateWorkspaceWorkDiagnostic(f.config, SCOPE, value));
  assert.equal(saved.data.privacy.fidelity, 'REDACTED');
  assert.equal(saved.data.privacy.redacted, true);
  assert.equal(saved.data.fullTextRetained, false);
  assert.ok(saved.data.privacy.redactionFields.includes('providerText'));
  assert.ok(saved.data.privacy.omittedFields.includes('parsedOutput.[omitted]'));
  assert.doesNotMatch(saved.body, /synthetic-private-password|synthetic-private-bearer|syntheticCredentialForRedaction|foreign\.person|untrustedUser|arbitraryHeaders|apiKey/);
});

test('unsafe permissions and symlinked downstream capture directory are refused',
  { skip: process.platform === 'win32' ? 'POSIX permissions/symlinks require Linux validation' : false }, async t => {
    const f = await fixture(t, { phase: 'VERIFICATION' });
    await chmod(f.directory, 0o755);
    assert.equal((await writePrivateWorkspaceWorkDiagnostic(f.config, SCOPE, input())).status, 'UNSAFE_CONFIG');
    await chmod(f.directory, 0o700);
    const link = `${f.directory}-link`;
    await symlink(f.directory, link, 'dir');
    t.after(() => rm(link, { force: true }));
    assert.equal((await writePrivateWorkspaceWorkDiagnostic(JSON.stringify({ ...JSON.parse(f.config), directory: link }), SCOPE, input())).status, 'UNSAFE_CONFIG');
    assert.deepEqual(await readdir(f.directory), []);
  });

test('a pre-existing downstream proof or symlink target cannot be overwritten', async t => {
  const f = await fixture(t, { phase: 'VERIFICATION' });
  const first = await writePrivateWorkspaceWorkDiagnostic(f.config, SCOPE, input());
  const path = join(f.directory, first.fileName);
  await writeFile(path, 'protected downstream proof');
  assert.equal((await writePrivateWorkspaceWorkDiagnostic(f.config, SCOPE, input())).status, 'WRITE_FAILED');
  assert.equal(await readFile(path, 'utf8'), 'protected downstream proof');
  if (process.platform === 'win32') return;
  await rm(path);
  const target = join(f.directory, 'protected-target.json');
  await writeFile(target, 'protected target', { mode: 0o600 });
  await symlink(target, path);
  assert.equal((await writePrivateWorkspaceWorkDiagnostic(f.config, SCOPE, input())).status, 'WRITE_FAILED');
  assert.equal(await readFile(target, 'utf8'), 'protected target');
});
