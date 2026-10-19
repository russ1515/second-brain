'use strict';

const assert = require('node:assert/strict');
const { mkdtemp, chmod, readFile, readdir, stat, symlink, writeFile, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const test = require('node:test');
const { writePrivateWorkspaceWorkDiagnostic } = require('../dist/workspaces/workspace-work-diagnostics.js');
const { AUTOPILOT_DIAGNOSTIC_REASONS, getAutopilotDiagnosticReason, parseAutopilotOutput } = require('../dist/workspaces/workspace-autopilot.js');

const SCOPE = { ownerId: 'technical-owner', workspaceId: 'technical-workspace', runId: 'technical-run', requestId: 'technical-request' };
const INPUT = {
  trace: { workspaceId: SCOPE.workspaceId, shellKind: 'article', intent: 'article-summary', artifactType: 'SUMMARY_DRAFT', currentPhase: 'WORK', expectedWorkOutputType: 'SUMMARY_DRAFT' },
  providerResponse: { text: 'private provider body', provider: 'openai', model: 'configured', usage: { inputTokens: 1 }, foreignSecretField: 'MUST_NOT_APPEAR' },
  rawText: 'A short technical fixture summary.',
  normalizedText: 'A short technical fixture summary.',
  parserResult: 'PASS', validatorResult: 'PASS', rejectReasonCode: 'NONE',
};

function completeTechnicalInput(overrides = {}) {
  const instructions = 'Produce a faithful short technical summary of the supplied text.';
  const draft = 'A verified technical fixture. '.repeat(100);
  const criterion = { id: 'required-1', requirement: instructions, required: true,
    classification: 'REQUIRED', condition: 'NONE', applicable: true, originField: 'userInstructions' };
  const workEvidence = [{ criterionId: 'required-1', requirement: instructions, excerpt: 'A verified technical fixture.' }];
  const output = { text: 'Technical fixture result.', draft, workOutputKind: 'SUMMARY_DRAFT', workEvidence };
  const rawText = JSON.stringify(output);
  return {
    ...INPUT, rawText, normalizedText: rawText,
    technicalEvidence: { userInstructions: instructions, canonicalInstructions: `User instructions:\n${instructions}`, criteriaExtraction: [criterion],
      criteriaMatrix: [{ criterionId: 'required-1', type: 'REQUIRED', text: instructions, required: true, applicable: true,
        evidence: [{ index: 0, ...workEvidence[0], association: 'ID', requirementAnchored: true, excerptAnchored: true }], status: 'PASS' }],
      parsedOutput: output, workEvidence, draftCandidate: draft },
    ...overrides,
  };
}

async function fixture(t, overrides = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'sb-work-diagnostic-'));
  await chmod(directory, 0o700);
  t.after(() => rm(directory, { recursive: true, force: true }));
  return { directory, config: JSON.stringify({ version: 1, ...SCOPE, directory, expiresAt: new Date(Date.now() + 60_000).toISOString(), ...overrides }) };
}

test('diagnostics are disabled by default; all four exact technical scope identifiers are mandatory', async (t) => {
  const { directory, config } = await fixture(t, { includePreview: true });
  assert.equal((await writePrivateWorkspaceWorkDiagnostic(undefined, SCOPE, INPUT)).status, 'DISABLED');
  for (const key of ['ownerId', 'workspaceId', 'runId', 'requestId']) {
    const result = await writePrivateWorkspaceWorkDiagnostic(config, { ...SCOPE, [key]: 'another-technical-target' }, INPUT);
    assert.equal(result.status, 'SCOPE_MISMATCH');
  }
  assert.equal((await writePrivateWorkspaceWorkDiagnostic(config, SCOPE, { ...INPUT, trace: { ...INPUT.trace, workspaceId: 'foreign-workspace' } })).status, 'SCOPE_MISMATCH');
  assert.deepEqual(await readdir(directory), []);
});

test('a private exclusive artifact records shape, lengths and contract trace, not provider object data or full text', async (t) => {
  const { directory, config } = await fixture(t, { includePreview: true });
  const result = await writePrivateWorkspaceWorkDiagnostic(config, SCOPE, INPUT);
  assert.equal(result.status, 'WRITTEN');
  assert.match(result.fileName, /^work-[a-f0-9]{32}\.json$/);
  const path = join(directory, result.fileName);
  const body = await readFile(path, 'utf8');
  const artifact = JSON.parse(body);
  assert.deepEqual(artifact.providerResponseShape, { kind: 'object', knownFields: ['text', 'provider', 'model', 'usage'] });
  assert.deepEqual(artifact.trace, INPUT.trace);
  assert.equal(artifact.rawTextLength, INPUT.rawText.length);
  assert.equal(artifact.normalizedTextLength, INPUT.normalizedText.length);
  assert.equal(artifact.rawTextPreview, INPUT.rawText);
  assert.equal(artifact.fullTextRetained, false);
  assert.equal(artifact.expectedArtifactType, 'SUMMARY_DRAFT');
  assert.equal(artifact.parserResult, 'PASS');
  assert.equal(artifact.validatorResult, 'PASS');
  assert.equal(artifact.rejectReasonCode, 'NONE');
  assert.doesNotMatch(body, /private provider body|foreignSecretField|MUST_NOT_APPEAR/);
  if (process.platform !== 'win32') assert.equal((await stat(path)).mode & 0o777, 0o600);
  assert.equal((await writePrivateWorkspaceWorkDiagnostic(config, SCOPE, INPUT)).status, 'WRITE_FAILED');
  assert.equal(await readFile(path, 'utf8'), body);
});

test('previews require explicit technical fixture consent and are bounded after redaction', async (t) => {
  const first = await fixture(t);
  const disabled = await writePrivateWorkspaceWorkDiagnostic(first.config, SCOPE, INPUT);
  assert.equal(JSON.parse(await readFile(join(first.directory, disabled.fileName), 'utf8')).rawTextPreview, '[PREVIEW_DISABLED]');

  const second = await fixture(t, { includePreview: true, maxPreviewChars: 80 });
  const text = 'Technical summary. '.repeat(2_000);
  const result = await writePrivateWorkspaceWorkDiagnostic(second.config, SCOPE, { ...INPUT, rawText: text, normalizedText: 'normalized' });
  const artifact = JSON.parse(await readFile(join(second.directory, result.fileName), 'utf8'));
  assert.equal(artifact.rawTextLength, text.length);
  assert.equal(artifact.normalizedTextLength, 10);
  assert.equal(artifact.rawTextPreview.length, 80);
  assert.equal(artifact.fullTextRetained, false);
});

test('preview strips credentials, tokens, private fields, addresses, payment references and opaque data before writing', async (t) => {
  const { directory, config } = await fixture(t, { includePreview: true, maxPreviewChars: 1_500 });
  const rawText = [
    'Safe task text remains.',
    'OPENAI_API_KEY=sk-test-secret-123456789',
    'Authorization: Bearer auth-example-123456789',
    'password="hunter-example-secret"',
    'otp: 112233',
    'receipt: rcpt-secret-example',
    'payment: private-transaction-reference',
    'Name: Foreign Person',
    'Address: 10 Foreign Street',
    'foreign.person@example.test',
    'https://example.test/?token=private-example',
    '192.0.2.123',
    '1234 5678 9012 3456',
    ['eyJ', 'dummyHeaderSegment12345', '.', 'dummyPayloadSegment12345', '.', 'dummySignatureSegment12345'].join(''),
  ].join('\n');
  const result = await writePrivateWorkspaceWorkDiagnostic(config, SCOPE, { ...INPUT, rawText });
  const artifact = JSON.parse(await readFile(join(directory, result.fileName), 'utf8'));
  assert.match(artifact.rawTextPreview, /Safe task text remains/);
  assert.doesNotMatch(artifact.rawTextPreview, /sk-test|auth-example|hunter-example|112233|rcpt-secret|private-transaction|Foreign Person|Foreign Street|foreign\.person|private-example|192\.0\.2\.123|1234 5678|dummyHeaderSegment|dummyPayloadSegment|dummySignatureSegment/);
});

test('private keys and malformed/unrecognised metadata never become artifact content', async (t) => {
  const { directory, config } = await fixture(t, { includePreview: true });
  const result = await writePrivateWorkspaceWorkDiagnostic(config, SCOPE, {
    ...INPUT,
    rawText: 'Safe\n-----BEGIN PRIVATE KEY-----\nsecret-key-material\n-----END PRIVATE KEY-----',
    providerResponse: { 'RAW_SECRET_AS_KEY': 'sensitive' },
    trace: { ...INPUT.trace, intent: 'sensitive arbitrary value', shellKind: 'SECRET_SHELL', artifactType: 'SECRET_KIND' },
    rejectReasonCode: 'private server error and secret',
  });
  const body = await readFile(join(directory, result.fileName), 'utf8');
  const artifact = JSON.parse(body);
  assert.doesNotMatch(body, /secret-key-material|RAW_SECRET_AS_KEY|sensitive arbitrary|SECRET_SHELL|SECRET_KIND|private server error/);
  assert.equal(artifact.trace.intent, 'UNKNOWN');
  assert.equal(artifact.rejectReasonCode, 'UNKNOWN');
});

test('precise allowlisted parser rejection is retained safely instead of being downgraded to UNKNOWN', async (t) => {
  const { directory, config } = await fixture(t);
  let rejected;
  try { parseAutopilotOutput('not-json'); } catch (error) { rejected = error; }
  const reason = getAutopilotDiagnosticReason(rejected);
  assert.equal(reason, 'PARSE_INVALID_JSON');
  assert.equal(AUTOPILOT_DIAGNOSTIC_REASONS.includes(reason), true);
  const result = await writePrivateWorkspaceWorkDiagnostic(config, SCOPE, {
    ...INPUT, rawText: 'not-json', parserResult: 'FAIL', validatorResult: 'NOT_REACHED', rejectReasonCode: reason,
  });
  const body = await readFile(join(directory, result.fileName), 'utf8');
  const artifact = JSON.parse(body);
  assert.equal(artifact.rejectReasonCode, 'PARSE_INVALID_JSON');
  assert.equal(artifact.parserResult, 'FAIL');
  assert.equal(artifact.validatorResult, 'NOT_REACHED');
  assert.doesNotMatch(body, /stack|ServiceUnavailableException|not-json/);
  assert.equal(getAutopilotDiagnosticReason(new Error('private raw error')), undefined);
});

test('full technical evidence is opt-in and retains safe provider text beyond preview with exact criteria matrix and candidate', async (t) => {
  const input = completeTechnicalInput();
  assert.ok(input.rawText.length > 1500);
  const defaultFixture = await fixture(t);
  const defaultResult = await writePrivateWorkspaceWorkDiagnostic(defaultFixture.config, SCOPE, input);
  const ordinary = JSON.parse(await readFile(join(defaultFixture.directory, defaultResult.fileName), 'utf8'));
  assert.equal(ordinary.fullTextRetained, false);
  assert.equal(ordinary.technicalEvidence, undefined);
  const full = await fixture(t, { fullTechnicalEvidence: true });
  const result = await writePrivateWorkspaceWorkDiagnostic(full.config, SCOPE, input);
  assert.equal(result.status, 'WRITTEN');
  const evidence = JSON.parse(await readFile(join(full.directory, result.fileName), 'utf8'));
  assert.equal(evidence.fullTextRetained, true);
  assert.equal(evidence.privacy.fidelity, 'EXACT');
  assert.equal(evidence.privacy.redacted, false);
  assert.equal(evidence.technicalEvidence.providerRepresentation, 'response.text');
  assert.equal(evidence.technicalEvidence.providerText, input.rawText);
  assert.equal(evidence.technicalEvidence.normalizedText, input.normalizedText);
  for (const field of ['userInstructions', 'canonicalInstructions', 'criteriaExtraction', 'criteriaMatrix', 'parsedOutput', 'workEvidence', 'draftCandidate']) {
    assert.deepEqual(evidence.technicalEvidence[field], input.technicalEvidence[field]);
  }
  if (process.platform !== 'win32') assert.equal((await stat(join(full.directory, result.fileName))).mode & 0o777, 0o600);
  assert.equal((await writePrivateWorkspaceWorkDiagnostic(full.config, SCOPE, input)).status, 'WRITE_FAILED');
});

test('full evidence redacts secret-like material and foreign data with explicit non-exact fidelity flags', async (t) => {
  const { directory, config } = await fixture(t, { fullTechnicalEvidence: true });
  const input = completeTechnicalInput();
  const dummyKey = ['sk-', 'dummySecretForTechnicalRedaction12345'].join('');
  input.rawText += `\npassword=technical-private-password\n${dummyKey}\nforeign.person@example.test`;
  input.normalizedText = input.rawText;
  input.technicalEvidence.parsedOutput = { ...input.technicalEvidence.parsedOutput,
    arbitraryHeaders: { authorization: 'private-other-user-token' },
    foreignUserData: { email: 'foreign.person@example.test' } };
  input.technicalEvidence.draftCandidate += `\n${dummyKey}`;
  const result = await writePrivateWorkspaceWorkDiagnostic(config, SCOPE, input);
  assert.equal(result.status, 'WRITTEN');
  const body = await readFile(join(directory, result.fileName), 'utf8');
  const evidence = JSON.parse(body);
  assert.equal(evidence.fullTextRetained, false);
  assert.equal(evidence.privacy.fidelity, 'REDACTED');
  assert.equal(evidence.privacy.redacted, true);
  assert.ok(evidence.privacy.redactionFields.includes('providerText'));
  assert.ok(evidence.privacy.omittedFields.includes('parsedOutput.[omitted]'));
  assert.doesNotMatch(body, /technical-private-password|dummySecretForTechnical|foreign\.person|private-other-user-token|arbitraryHeaders|foreignUserData/);
  assert.ok(!evidence.privacy.redactionFields.some((field) => field.includes(dummyKey)));
});

test('full evidence enforces four-hour TTL, exact request, WORK phase, complete input and bounded sizes', async (t) => {
  const { directory, config } = await fixture(t, { fullTechnicalEvidence: true });
  const input = completeTechnicalInput();
  const overTtl = JSON.stringify({ ...JSON.parse(config), expiresAt: new Date(Date.now() + 5 * 60 * 60_000).toISOString() });
  assert.equal((await writePrivateWorkspaceWorkDiagnostic(overTtl, SCOPE, input)).status, 'UNSAFE_CONFIG');
  assert.equal((await writePrivateWorkspaceWorkDiagnostic(config, { ...SCOPE, requestId: 'foreign-request' }, input)).status, 'SCOPE_MISMATCH');
  assert.equal((await writePrivateWorkspaceWorkDiagnostic(config, SCOPE, { ...input, trace: { ...input.trace, currentPhase: 'METHOD' } })).status, 'SCOPE_MISMATCH');
  assert.equal((await writePrivateWorkspaceWorkDiagnostic(config, SCOPE, { ...input, technicalEvidence: undefined })).status, 'WRITE_FAILED');
  assert.equal((await writePrivateWorkspaceWorkDiagnostic(config, SCOPE, { ...input, rawText: 'x'.repeat(128_001) })).status, 'WRITE_FAILED');
  const oversized = { ...input, rawText: 'a'.repeat(128_000), normalizedText: 'b'.repeat(128_000),
    technicalEvidence: { ...input.technicalEvidence, userInstructions: 'c'.repeat(128_000), draftCandidate: 'd'.repeat(128_000) } };
  assert.equal((await writePrivateWorkspaceWorkDiagnostic(config, SCOPE, oversized)).status, 'WRITE_FAILED');
  assert.deepEqual(await readdir(directory), []);
});

test('full evidence keeps rejected candidate and failed criterion matrix without granting validation', async (t) => {
  const { directory, config } = await fixture(t, { fullTechnicalEvidence: true });
  const input = completeTechnicalInput({ validatorResult: 'FAIL', rejectReasonCode: 'WORK_REQUIRED_CRITERION_EVIDENCE_MISSING' });
  input.technicalEvidence.criteriaMatrix[0].evidence = [];
  input.technicalEvidence.criteriaMatrix[0].status = 'MISSING';
  input.technicalEvidence.criteriaMatrix[0].reasonCode = 'WORK_REQUIRED_CRITERION_EVIDENCE_MISSING';
  const result = await writePrivateWorkspaceWorkDiagnostic(config, SCOPE, input);
  const evidence = JSON.parse(await readFile(join(directory, result.fileName), 'utf8'));
  assert.equal(evidence.validatorResult, 'FAIL');
  assert.equal(evidence.rejectReasonCode, 'WORK_REQUIRED_CRITERION_EVIDENCE_MISSING');
  assert.deepEqual(evidence.technicalEvidence.criteriaMatrix, input.technicalEvidence.criteriaMatrix);
  assert.equal(evidence.technicalEvidence.draftCandidate, input.technicalEvidence.draftCandidate);
  assert.equal(evidence.fullTextRetained, true);
  assert.equal(evidence.privacy.fidelity, 'EXACT');
});

test('full mode preserves canonical long technical IDs, artifact types and server fingerprints exactly', async (t) => {
  const { directory, config } = await fixture(t, { fullTechnicalEvidence: true });
  const input = completeTechnicalInput();
  const criterionId = 'required-technical-long-criterion-identifier-without-secret';
  input.technicalEvidence.criteriaExtraction[0].id = criterionId;
  input.technicalEvidence.criteriaMatrix[0].criterionId = criterionId;
  input.technicalEvidence.workEvidence[0].criterionId = criterionId;
  input.technicalEvidence.parsedOutput.workContract = { version: 1, taskIntent: 'article-summary', outputKind: 'SUMMARY_DRAFT',
    operation: 'transform', scope: 'entire-task', task: 'Summarise the supplied technical fixture.',
    criteria: input.technicalEvidence.criteriaExtraction, sourceRequirement: 'provided-content', instructionFingerprint: 'a'.repeat(64) };
  input.rawText = JSON.stringify(input.technicalEvidence.parsedOutput);
  input.normalizedText = input.rawText;
  const result = await writePrivateWorkspaceWorkDiagnostic(config, SCOPE, input);
  const evidence = JSON.parse(await readFile(join(directory, result.fileName), 'utf8'));
  assert.equal(evidence.fullTextRetained, true);
  assert.equal(evidence.privacy.fidelity, 'EXACT');
  assert.equal(evidence.technicalEvidence.providerText, input.rawText);
  assert.equal(evidence.technicalEvidence.parsedOutput.workContract.instructionFingerprint, 'a'.repeat(64));
  assert.equal(evidence.technicalEvidence.workEvidence[0].criterionId, criterionId);
});

test('expired, overbroad, malformed and oversized configs fail closed without a file', async (t) => {
  const { directory, config } = await fixture(t);
  const base = JSON.parse(config);
  const bad = [
    [undefined, 'DISABLED'], ['not-json', 'UNSAFE_CONFIG'], ['x'.repeat(5_000), 'UNSAFE_CONFIG'],
    [JSON.stringify({ ...base, expiresAt: 'invalid' }), 'UNSAFE_CONFIG'],
    [JSON.stringify({ ...base, expiresAt: new Date(Date.now() - 1_000).toISOString() }), 'EXPIRED'],
    [JSON.stringify({ ...base, expiresAt: new Date(Date.now() + 25 * 60 * 60_000).toISOString() }), 'UNSAFE_CONFIG'],
    [JSON.stringify({ ...base, requestId: '*' }), 'UNSAFE_CONFIG'],
    [JSON.stringify({ ...base, ownerId: undefined }), 'UNSAFE_CONFIG'],
    [JSON.stringify({ ...base, maxPreviewChars: 1_501 }), 'UNSAFE_CONFIG'],
    [JSON.stringify({ ...base, maxPreviewChars: -1 }), 'UNSAFE_CONFIG'],
    [JSON.stringify({ ...base, directory: 'relative/path' }), 'UNSAFE_CONFIG'],
  ];
  for (const [value, expected] of bad) assert.equal((await writePrivateWorkspaceWorkDiagnostic(value, SCOPE, INPUT)).status, expected);
  assert.deepEqual(await readdir(directory), []);
});

test('missing directories and unavailable filesystem fail closed; no logger or thrown exception', async (t) => {
  const { directory, config } = await fixture(t);
  const missing = JSON.stringify({ ...JSON.parse(config), directory: join(directory, 'not-created') });
  assert.equal((await writePrivateWorkspaceWorkDiagnostic(missing, SCOPE, INPUT)).status, 'WRITE_FAILED');
  assert.deepEqual(await readdir(directory), []);
});

test('unsafe POSIX directory permissions and directory symlinks are rejected', { skip: process.platform === 'win32' ? 'POSIX modes/symlink permissions require the Linux runtime' : false }, async (t) => {
  const { directory, config } = await fixture(t);
  await chmod(directory, 0o755);
  assert.equal((await writePrivateWorkspaceWorkDiagnostic(config, SCOPE, INPUT)).status, 'UNSAFE_CONFIG');
  await chmod(directory, 0o700);
  const link = `${directory}-link`;
  await symlink(directory, link, 'dir');
  t.after(() => rm(link, { force: true }));
  assert.equal((await writePrivateWorkspaceWorkDiagnostic(JSON.stringify({ ...JSON.parse(config), directory: link }), SCOPE, INPUT)).status, 'UNSAFE_CONFIG');
  assert.deepEqual(await readdir(directory), []);
});

test('an existing file cannot be overwritten and a symlink target is never followed', async (t) => {
  const { directory, config } = await fixture(t);
  const result = await writePrivateWorkspaceWorkDiagnostic(config, SCOPE, INPUT);
  const file = join(directory, result.fileName);
  await writeFile(file, 'existing private proof');
  assert.equal((await writePrivateWorkspaceWorkDiagnostic(config, SCOPE, INPUT)).status, 'WRITE_FAILED');
  assert.equal(await readFile(file, 'utf8'), 'existing private proof');
  if (process.platform === 'win32') return;
  await rm(file);
  const target = join(directory, 'protected-proof.json');
  await writeFile(target, 'protected target', { mode: 0o600 });
  await symlink(target, file);
  assert.equal((await writePrivateWorkspaceWorkDiagnostic(config, SCOPE, INPUT)).status, 'WRITE_FAILED');
  assert.equal(await readFile(target, 'utf8'), 'protected target');
});
