import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, open, realpath } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
import { AUTOPILOT_DIAGNOSTIC_REASONS } from './workspace-autopilot';
import type { WorkspaceAutopilotOutput } from '@second-brain/shared';

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
  /** Never populated for ordinary users. The private exact-scope opt-in is also mandatory. */
  technicalEvidence?: {
    userInstructions: string;
    canonicalInstructions?: string;
    criteriaExtraction: readonly object[];
    criteriaMatrix: readonly object[];
    parsedOutput?: WorkspaceAutopilotOutput;
    workEvidence?: WorkspaceAutopilotOutput['workEvidence'];
    draftCandidate?: string;
  };
}

type DiagnosticStatus = 'WRITTEN' | 'DISABLED' | 'SCOPE_MISMATCH' | 'EXPIRED' | 'UNSAFE_CONFIG' | 'WRITE_FAILED';
export interface WorkspaceWorkDiagnosticWriteResult { status: DiagnosticStatus; fileName?: string }

interface PrivateDiagnosticConfig extends WorkspaceWorkDiagnosticScope {
  version: 1;
  directory: string;
  expiresAt: string;
  /** Explicitly authorises a redacted preview of technical fixture content only. */
  includePreview?: boolean;
  maxPreviewChars?: number;
  /** Separate authorisation for the one exact technical request; never enables arbitrary provider objects. */
  fullTechnicalEvidence?: boolean;
}

const MAX_CONFIG_BYTES = 4_096;
const MAX_PREVIEW_CHARS = 1_500;
const MAX_ARTIFACT_BYTES = 12_000;
const MAX_TTL_MS = 24 * 60 * 60 * 1_000;
const FULL_TTL_MS = 4 * 60 * 60 * 1_000;
const MAX_FULL_TEXT_CHARS = 128_000;
const MAX_FULL_ARTIFACT_BYTES = 512_000;
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

// Only known orchestration data is admitted. Raw provider objects/headers/errors are NEVER admitted.
const FULL_FIELDS = new Set([
  'id', 'criterionId', 'type', 'text', 'requirement', 'required', 'applicable', 'condition', 'conditionAnchor',
  'origin', 'anchor', 'classification', 'evidence', 'status', 'reason', 'excerpt', 'criteria', 'criteriaExtraction',
  'version', 'taskIntent', 'outputKind', 'operation', 'scope', 'task', 'sourceRequirement', 'sourceExcerpt',
  'sectionPlanItemId', 'instructionFingerprint', 'workContract', 'workOutputKind', 'workEvidence', 'draft',
  'issues', 'needsInput', 'deconstruction', 'workArtifactValidated', 'taskFulfillment', 'contractMatchesTask',
  'fulfilled', 'criterionReviews', 'citationLabels', 'uncoveredRequirements', 'reviewedDraftFingerprint',
  'reviewedContractFingerprint', 'contractFingerprint', 'draftFingerprint',
  'originField', 'index', 'association', 'requirementAnchored', 'excerptAnchored', 'reasonCode',
]);

interface FullPrivacy {
  fidelity: 'EXACT' | 'REDACTED' | 'INCOMPLETE';
  redacted: boolean;
  redactionFields: string[];
  omittedFields: string[];
}

function fullTechnicalEvidence(input: WorkspaceWorkDiagnosticInput): { technicalEvidence: Record<string, unknown>; privacy: FullPrivacy; fullTextRetained: boolean } {
  const privacy: FullPrivacy = { fidelity: 'EXACT', redacted: false, redactionFields: [], omittedFields: [] };
  const mark = (path: string, omitted = false) => {
    privacy.redacted = true;
    const list = omitted ? privacy.omittedFields : privacy.redactionFields;
    if (!list.includes(path) && list.length < 64) list.push(path);
  };
  const scrub = (value: string, path: string): string => {
    if (value.length > MAX_FULL_TEXT_CHARS) throw new Error('TECHNICAL_EVIDENCE_TOO_LARGE');
    // Preserve safe technical text exactly. Unlike preview, never truncate or broadly erase long words/hashes.
    const result = value
      .replace(/-----BEGIN[^\r\n]*PRIVATE KEY-----[\s\S]*(?:-----END[^\r\n]*PRIVATE KEY-----)?/gi, '[REDACTED_PRIVATE_KEY]')
      .replace(/\bBearer\s+[^\s"',;}]+/gi, 'Bearer [REDACTED]')
      .replace(/\b(?:sk|rk|re|cf|ghp|github_pat)[-_][A-Za-z0-9_./+=-]{8,}/g, '[REDACTED_CREDENTIAL]')
      .replace(/\bAKIA[A-Z0-9]{16}\b/g, '[REDACTED_CREDENTIAL]')
      .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[REDACTED_AUTH_TOKEN]')
      .replace(/(?:["']?\b(?:password|passwd|passphrase|secret|api[_-]?key|access[_-]?token|refresh[_-]?token|authorization|cookie|otp|totp|receipt|payment|card[_-]?number|billing|name|address|phone|email)\b["']?\s*[:=]\s*)(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[^\r\n,;}]+)/gi, '[REDACTED_PRIVATE_FIELD]')
      .replace(/https?:\/\/[^\s<>"']+/gi, (url) => {
        try {
          const parsed = new URL(url);
          return parsed.username || parsed.password || /(?:^|[?&])(?:token|key|secret|password|signature|auth|code)=/i.test(parsed.search)
            ? '[REDACTED_PRIVATE_URL]' : url;
        } catch { return '[REDACTED_INVALID_URL]'; }
      })
      .replace(/[A-Z0-9.!#$%&'*+/=?^_`{|}~-]{1,64}@[A-Z0-9.-]{1,253}\.[A-Z]{2,63}/gi, '[REDACTED_EMAIL]')
      .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, '[REDACTED_IP]')
      .replace(/\b(?:\d[ -]?){10,19}\b/g, '[REDACTED_PRIVATE_NUMBER]');
    if (result !== value) mark(path);
    return result;
  };
  const clone = (value: unknown, path: string, depth = 0): unknown => {
    if (depth > 12) throw new Error('TECHNICAL_EVIDENCE_TOO_DEEP');
    if (value === undefined || value === null) return null;
    if (typeof value === 'string') return scrub(value, path);
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (Array.isArray(value)) {
      if (value.length > 128) throw new Error('TECHNICAL_EVIDENCE_TOO_LARGE');
      return value.map((item) => clone(item, `${path}[]`, depth + 1));
    }
    if (typeof value !== 'object' || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) {
      mark(path, true); return '[OMITTED_UNSAFE_VALUE]';
    }
    const result: Record<string, unknown> = {};
    const descriptors = Object.getOwnPropertyDescriptors(value);
    if (Object.keys(descriptors).length > 128) throw new Error('TECHNICAL_EVIDENCE_TOO_LARGE');
    for (const [key, descriptor] of Object.entries(descriptors)) {
      if (!FULL_FIELDS.has(key) || !('value' in descriptor)) { mark(`${path}.[omitted]`, true); continue; }
      if (descriptor.value === undefined) continue; // Match JSON's treatment of absent optional object fields.
      result[key] = clone(descriptor.value, `${path}.${key}`, depth + 1);
    }
    return result;
  };
  const evidence = input.technicalEvidence;
  if (!evidence || typeof evidence.userInstructions !== 'string' || !Array.isArray(evidence.criteriaExtraction) || !Array.isArray(evidence.criteriaMatrix)) {
    throw new Error('TECHNICAL_EVIDENCE_REQUIRED');
  }
  const texts = [input.rawText, input.normalizedText, evidence.userInstructions, evidence.canonicalInstructions, evidence.draftCandidate]
    .filter((value): value is string => typeof value === 'string');
  if (texts.some((value) => value.length > MAX_FULL_TEXT_CHARS)
    || texts.reduce((length, value) => length + Buffer.byteLength(value, 'utf8'), 0) > MAX_FULL_ARTIFACT_BYTES - 4_096) {
    throw new Error('TECHNICAL_EVIDENCE_TOO_LARGE');
  }
  const complete = typeof input.rawText === 'string' && typeof input.normalizedText === 'string'
    && (input.parserResult !== 'PASS' || evidence.parsedOutput !== undefined);
  const data = {
    providerRepresentation: 'response.text',
    providerText: typeof input.rawText === 'string' ? scrub(input.rawText, 'providerText') : null,
    normalizedText: typeof input.normalizedText === 'string' ? scrub(input.normalizedText, 'normalizedText') : null,
    userInstructions: scrub(evidence.userInstructions, 'userInstructions'),
    canonicalInstructions: typeof evidence.canonicalInstructions === 'string' ? scrub(evidence.canonicalInstructions, 'canonicalInstructions') : null,
    criteriaExtraction: clone(evidence.criteriaExtraction, 'criteriaExtraction'),
    criteriaMatrix: clone(evidence.criteriaMatrix, 'criteriaMatrix'),
    parsedOutput: clone(evidence.parsedOutput, 'parsedOutput'),
    workEvidence: clone(evidence.workEvidence, 'workEvidence'),
    draftCandidate: typeof evidence.draftCandidate === 'string' ? scrub(evidence.draftCandidate, 'draftCandidate') : null,
  };
  privacy.fidelity = privacy.redacted ? 'REDACTED' : complete ? 'EXACT' : 'INCOMPLETE';
  return { technicalEvidence: data, privacy, fullTextRetained: complete && !privacy.redacted };
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
      || (config.fullTechnicalEvidence !== undefined && typeof config.fullTechnicalEvidence !== 'boolean')
      || (config.maxPreviewChars !== undefined && (!Number.isInteger(config.maxPreviewChars) || config.maxPreviewChars < 0 || config.maxPreviewChars > MAX_PREVIEW_CHARS))) return { status: 'UNSAFE_CONFIG' };
  } catch { return { status: 'UNSAFE_CONFIG' }; }
  const expiry = Date.parse(config.expiresAt);
  if (!Number.isFinite(expiry)) return { status: 'UNSAFE_CONFIG' };
  if (expiry <= Date.now()) return { status: 'EXPIRED' };
  if (expiry - Date.now() > (config.fullTechnicalEvidence ? FULL_TTL_MS : MAX_TTL_MS)) return { status: 'UNSAFE_CONFIG' };
  if (input.trace.workspaceId !== scope.workspaceId
    || !(['ownerId', 'workspaceId', 'runId', 'requestId'] as const).every((key) => scope[key] === config[key])) return { status: 'SCOPE_MISMATCH' };
  if (config.fullTechnicalEvidence && input.trace.currentPhase !== 'WORK') return { status: 'SCOPE_MISMATCH' };

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
      ...(config.fullTechnicalEvidence ? fullTechnicalEvidence(input) : { fullTextRetained: false }),
    };
    const body = JSON.stringify(artifact);
    if (Buffer.byteLength(body, 'utf8') > (config.fullTechnicalEvidence ? MAX_FULL_ARTIFACT_BYTES : MAX_ARTIFACT_BYTES)) return { status: 'UNSAFE_CONFIG' };
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
