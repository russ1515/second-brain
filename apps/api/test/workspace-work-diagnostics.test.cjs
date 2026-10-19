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
