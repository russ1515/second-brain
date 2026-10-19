import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, open, realpath } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
import { AUTOPILOT_DIAGNOSTIC_REASONS } from './workspace-autopilot';

/** Private, opt-in diagnostics for ONE authorised technical WORK request. Never a logger or API DTO. */
export interface WorkspaceWorkDiagnosticScope {
  ownerId: string;
  workspaceId: string;
  runId: string;
  requestId: string;
}

export interface WorkspaceWorkDiagnosticInput {
  trace: {
    workspaceId: string;
    shellKind?: string;
    intent?: string;
    artifactType?: string;
    currentPhase?: string;
    expectedWorkOutputType?: string;
  };
  providerResponse?: unknown;
  rawText?: string;
  normalizedText?: string;
  parserResult: 'PASS' | 'FAIL' | 'NOT_REACHED' | 'NOT_RUN';
  validatorResult: 'PASS' | 'FAIL' | 'FALSE_POSITIVE' | 'NOT_REACHED' | 'NOT_RUN';
  rejectReasonCode?: string;
}

type DiagnosticStatus = 'WRITTEN' | 'DISABLED' | 'SCOPE_MISMATCH' | 'EXPIRED' | 'UNSAFE_CONFIG' | 'WRITE_FAILED';
export interface WorkspaceWorkDiagnosticWriteResult { status: DiagnosticStatus; fileName?: string }

interface PrivateDiagnosticConfig extends WorkspaceWorkDiagnosticScope {
  version: 1;
  directory: string;
  expiresAt: string;
  /** Explicitly authorises a redacted preview of technical fixture content only. Full text is NEVER retained. */
  includePreview?: boolean;
  maxPreviewChars?: number;
}

const MAX_CONFIG_BYTES = 4_096;
const MAX_PREVIEW_CHARS = 1_500;
const MAX_ARTIFACT_BYTES = 12_000;
const MAX_TTL_MS = 24 * 60 * 60 * 1_000;
const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/;
const INTENTS = ['assignment-exercise', 'article-summary', 'research-task', 'academic-section', 'argumentative-essay', 'scientific-article', 'report', 'general'];
const KINDS = ['ANSWER_DRAFT', 'SUMMARY_DRAFT', 'SOURCED_RESEARCH_DRAFT', 'CURRENT_ACADEMIC_SECTION_DRAFT', 'ARGUMENTATIVE_DRAFT', 'SCIENTIFIC_DRAFT', 'REPORT_DRAFT', 'INTENT_MATCHED_DRAFT'];
const PHASES = ['CAPTURE', 'COMPREHENSION', 'METHOD', 'WORK', 'COACHING', 'VERIFICATION', 'FINALIZATION', 'DECONSTRUCTION'];
const REASONS = [...AUTOPILOT_DIAGNOSTIC_REASONS, 'MISSING_WORK_CONTRACT', 'OUTPUT_SHAPE_MISMATCH', 'EMPTY_PROVIDER_TEXT', 'PARSER_FAILED', 'ARTIFACT_TYPE_MISMATCH', 'METHOD_ONLY_OUTPUT', 'PROMPT_REPHRASE_ONLY', 'DRAFT_TOO_WEAK', 'VALIDATOR_FALSE_POSITIVE', 'WORK_ARTIFACT_REQUIRED', 'WORK_EVIDENCE_REQUIRED', 'SOURCE_EVIDENCE_REQUIRED', 'PROVIDER_FAILED', 'UNKNOWN', 'NONE'];
const PROVIDER_FIELDS = ['text', 'content', 'output', 'output_text', 'choices', 'candidates', 'provider', 'model', 'usage', 'finishReason', 'finish_reason', 'id', 'status', 'error'];

function allowed(value: unknown, options: readonly string[]): string {
  return typeof value === 'string' && options.includes(value) ? value : 'UNKNOWN';
}

/** Only structural facts: never property values, arbitrary property names, messages or error stacks. */
function providerResponseShape(value: unknown): Record<string, unknown> {
  if (value === null) return { kind: 'null' };
  if (Array.isArray(value)) return { kind: 'array', length: value.length };
  if (typeof value !== 'object') return { kind: ['string', 'number', 'boolean', 'undefined'].includes(typeof value) ? typeof value : 'other' };
  return { kind: 'object', knownFields: PROVIDER_FIELDS.filter((key) => Object.prototype.hasOwnProperty.call(value, key)) };
}

/** Defence in depth, not a PII classifier: the opt-in scope must refer exclusively to an authorised technical fixture. */
function redactedPreview(text: string | undefined, maximum: number, enabled: boolean): string {
  if (!enabled) return '[PREVIEW_DISABLED]';
  if (!text) return '';
  return text.slice(0, maximum * 4)
    .replace(/-----BEGIN[^\r\n]*PRIVATE KEY-----[\s\S]*(?:-----END[^\r\n]*PRIVATE KEY-----)?/gi, '[REDACTED_PRIVATE_KEY]')
    .replace(/\bBearer\s+[^\s"',;}]+/gi, 'Bearer [REDACTED]')
    .replace(/\b(?:sk|rk|re|cf|ghp|github_pat|AKIA)[-_][A-Za-z0-9_./+=-]*/g, '[REDACTED_CREDENTIAL]')
    .replace(/(?:["']?\b(?:password|passwd|passphrase|secret|api[_-]?key|access[_-]?token|refresh[_-]?token|authorization|cookie|otp|totp|receipt|payment|card[_-]?number|billing|name|address|phone|email)\b["']?\s*[:=]\s*)(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[^\r\n,;}]+)/gi, '[REDACTED_PRIVATE_FIELD]')
    .replace(/https?:\/\/[^\s<>"']+/gi, '[REDACTED_URL]')
    .replace(/[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[REDACTED_EMAIL]')
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, '[REDACTED_IP]')
    .replace(/\b(?:\d[ -]?){10,19}\b/g, '[REDACTED_NUMBER]')
    .replace(/\b[A-Za-z0-9_+/.=-]{24,}\b/g, '[REDACTED_OPAQUE_VALUE]')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .slice(0, maximum);
}

/**
 * Config is read from a private runtime setting by the caller. No environment is enumerated.
 * A private directory MUST already exist; no directory creation or fallback to /tmp/log/BDD.
 * Fail closed on invalid/mismatched/expired scope, symlinks or unsafe POSIX permissions.
 * All I/O errors are swallowed without logging: diagnostics must never break the pedagogical flow.
 */
export async function writePrivateWorkspaceWorkDiagnostic(
  configValue: string | undefined,
  scope: WorkspaceWorkDiagnosticScope,
  input: WorkspaceWorkDiagnosticInput,
): Promise<WorkspaceWorkDiagnosticWriteResult> {
  if (!configValue) return { status: 'DISABLED' };
  let config: PrivateDiagnosticConfig;
  try {
    if (Buffer.byteLength(configValue, 'utf8') > MAX_CONFIG_BYTES) return { status: 'UNSAFE_CONFIG' };
    config = JSON.parse(configValue) as PrivateDiagnosticConfig;
    if (!config || typeof config !== 'object' || config.version !== 1
      || !['ownerId', 'workspaceId', 'runId', 'requestId'].every((key) => typeof config[key as keyof PrivateDiagnosticConfig] === 'string' && ID.test(config[key as keyof PrivateDiagnosticConfig] as string))
      || typeof config.directory !== 'string' || !isAbsolute(config.directory)
      || typeof config.expiresAt !== 'string'
      || (config.includePreview !== undefined && typeof config.includePreview !== 'boolean')
      || (config.maxPreviewChars !== undefined && (!Number.isInteger(config.maxPreviewChars) || config.maxPreviewChars < 0 || config.maxPreviewChars > MAX_PREVIEW_CHARS))) return { status: 'UNSAFE_CONFIG' };
  } catch { return { status: 'UNSAFE_CONFIG' }; }
  const expiry = Date.parse(config.expiresAt);
  if (!Number.isFinite(expiry)) return { status: 'UNSAFE_CONFIG' };
  if (expiry <= Date.now()) return { status: 'EXPIRED' };
  if (expiry - Date.now() > MAX_TTL_MS) return { status: 'UNSAFE_CONFIG' };
  if (input.trace.workspaceId !== scope.workspaceId
    || !(['ownerId', 'workspaceId', 'runId', 'requestId'] as const).every((key) => scope[key] === config[key])) return { status: 'SCOPE_MISMATCH' };

  try {
    const directory = resolve(config.directory);
    const stat = await lstat(directory);
    if (!stat.isDirectory() || stat.isSymbolicLink() || resolve(await realpath(directory)) !== directory
      || (process.platform !== 'win32' && ((stat.mode & 0o077) !== 0 || (process.getuid && stat.uid !== process.getuid())))) return { status: 'UNSAFE_CONFIG' };
    const previewLength = config.maxPreviewChars ?? 1_000;
    const rawText = typeof input.rawText === 'string' ? input.rawText : undefined;
    const normalizedText = typeof input.normalizedText === 'string' ? input.normalizedText : undefined;
    const artifact = {
      version: 1,
      capturedAt: new Date().toISOString(),
      scope: { ownerId: scope.ownerId, workspaceId: scope.workspaceId, runId: scope.runId, requestId: scope.requestId },
      trace: {
        workspaceId: scope.workspaceId,
        shellKind: allowed(input.trace.shellKind, ['assignment', 'thesis', 'dissertation', 'article', 'report', 'general']),
        intent: allowed(input.trace.intent, INTENTS),
        artifactType: allowed(input.trace.artifactType, KINDS),
        currentPhase: allowed(input.trace.currentPhase, PHASES),
        expectedWorkOutputType: allowed(input.trace.expectedWorkOutputType, KINDS),
      },
      providerResponseShape: providerResponseShape(input.providerResponse),
      rawTextLength: rawText?.length ?? 0,
      rawTextPreview: redactedPreview(rawText, previewLength, config.includePreview === true),
      normalizedTextLength: normalizedText?.length ?? 0,
      expectedArtifactType: allowed(input.trace.expectedWorkOutputType, KINDS),
      parserResult: allowed(input.parserResult, ['PASS', 'FAIL', 'NOT_REACHED', 'NOT_RUN']),
      validatorResult: allowed(input.validatorResult, ['PASS', 'FAIL', 'FALSE_POSITIVE', 'NOT_REACHED', 'NOT_RUN']),
      rejectReasonCode: allowed(input.rejectReasonCode ?? 'NONE', REASONS),
      fullTextRetained: false,
    };
    const body = JSON.stringify(artifact);
    if (Buffer.byteLength(body, 'utf8') > MAX_ARTIFACT_BYTES) return { status: 'UNSAFE_CONFIG' };
    const name = `work-${createHash('sha256').update(`${scope.ownerId}:${scope.workspaceId}:${scope.runId}:${scope.requestId}`).digest('hex').slice(0, 32)}.json`;
    const handle = await open(join(directory, name), constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | (constants.O_NOFOLLOW ?? 0), 0o600);
    try {
      await handle.chmod(0o600);
      await handle.writeFile(body, { encoding: 'utf8' });
      await handle.sync();
    } finally { await handle.close(); }
    return { status: 'WRITTEN', fileName: name };
  } catch { return { status: 'WRITE_FAILED' }; }
}
