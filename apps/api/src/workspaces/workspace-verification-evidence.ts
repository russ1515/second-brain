import { createHash } from 'node:crypto';
import type {
  WorkspaceAssistantHistoryEntry,
  WorkspaceAutopilotOutput,
  WorkspaceDraftEvidenceAnchor,
  WorkspaceTaskFulfillment,
  WorkspaceVerificationCriterionStatus,
  WorkspaceWorkContract,
} from '@second-brain/shared';
import { WORKSPACE_VERIFICATION_CRITERION_STATUSES } from '@second-brain/shared';

type CriterionReview = WorkspaceTaskFulfillment['criterionReviews'][number];
export interface VerificationDraftContext {
  draft: string;
  revision: number;
  runId: string;
  /** Already owner/workspace-scoped by the service. Only metadata is indexed. */
  history: readonly WorkspaceAssistantHistoryEntry[];
}

const MAX_ANCHORS = 8;
const MAX_EXCERPT = 8_000;
const MAX_DRAFT = 200_000;
const fingerprint = (text: string) => createHash('sha256').update(text).digest('hex');
const validContext = (draft: unknown, revision: unknown): draft is string => typeof draft === 'string'
  && draft.length <= MAX_DRAFT && Number.isSafeInteger(revision) && Number(revision) >= 0;

function utf16Boundary(text: string, offset: number): boolean {
  return offset === 0 || offset === text.length
    || !(/[\uD800-\uDBFF]/u.test(text[offset - 1]!) && /[\uDC00-\uDFFF]/u.test(text[offset]!));
}

function graphemeBoundaries(text: string): Set<number> {
  const boundaries = new Set([0, text.length]);
  const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
  for (const part of segmenter.segment(text)) boundaries.add(part.index);
  return boundaries;
}

/** Normalize graphemes and whitespace only. Mathematical operators, case and
 * punctuation are retained. Each canonical code unit maps to its real span. */
function mappedText(text: string): { value: string; starts: number[]; ends: number[] } {
  let value = '';
  const starts: number[] = [];
  const ends: number[] = [];
  const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
  for (const part of segmenter.segment(text)) {
    const start = part.index;
    const end = start + part.segment.length;
    for (const character of part.segment.normalize('NFKC')) {
      if (/^\s$/u.test(character)) {
        if (!value.length) continue;
        if (value.endsWith(' ')) ends[ends.length - 1] = end;
        else { value += ' '; starts.push(start); ends.push(end); }
      } else {
        value += character;
        // A non-BMP character occupies two UTF-16 code units. Both map to the
        // same complete original grapheme; final equality rejects partials.
        for (let unit = 0; unit < character.length; unit += 1) { starts.push(start); ends.push(end); }
      }
    }
  }
  if (value.endsWith(' ')) { value = value.slice(0, -1); starts.pop(); ends.pop(); }
  return { value, starts, ends };
}

function makeAnchor(draft: string, revision: number, start: number, end: number): WorkspaceDraftEvidenceAnchor {
  return { source: 'draft', revision, startOffset: start, endOffset: end,
    excerpt: draft.substring(start, end), draftFingerprint: fingerprint(draft) };
}

/** Produce offsets only by locating real persisted text. No ellipsis splitting,
 * token matching, commentary, instruction lookup or semantic substitution. */
export function findDraftAnchor(draft: string, revision: number, excerpt: string): WorkspaceDraftEvidenceAnchor | undefined {
  if (!validContext(draft, revision) || typeof excerpt !== 'string' || !excerpt.trim() || excerpt.length > MAX_EXCERPT) return undefined;
  const boundaries = graphemeBoundaries(draft);
  const exact = draft.indexOf(excerpt);
  if (exact >= 0 && boundaries.has(exact) && boundaries.has(exact + excerpt.length)
    && utf16Boundary(draft, exact) && utf16Boundary(draft, exact + excerpt.length)) {
    return makeAnchor(draft, revision, exact, exact + excerpt.length);
  }
  const source = mappedText(draft);
  const quote = mappedText(excerpt).value;
  if (!quote) return undefined;
  let offset = source.value.indexOf(quote);
  while (offset >= 0) {
    const start = source.starts[offset];
    const end = source.ends[offset + quote.length - 1];
    if (start !== undefined && end !== undefined && boundaries.has(start) && boundaries.has(end)
      && utf16Boundary(draft, start) && utf16Boundary(draft, end)
      && mappedText(draft.substring(start, end)).value === quote) {
      return makeAnchor(draft, revision, start, end);
    }
    offset = source.value.indexOf(quote, offset + 1);
  }
  return undefined;
}

/** Explicit canonical anchors are strict: even equal-content stale revisions
 * must be re-resolved by the server, never silently relabelled as current. */
export function validateVerificationAnchors(draft: string, revision: number, anchors: unknown): anchors is WorkspaceDraftEvidenceAnchor[] {
  if (!validContext(draft, revision) || !Array.isArray(anchors) || !anchors.length || anchors.length > MAX_ANCHORS) return false;
  const expectedFingerprint = fingerprint(draft);
  const boundaries = graphemeBoundaries(draft);
  return anchors.every((value: unknown) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const anchor = value as Record<string, unknown>;
    if (anchor.source !== 'draft' || anchor.revision !== revision || anchor.draftFingerprint !== expectedFingerprint
      || !Number.isSafeInteger(anchor.startOffset) || !Number.isSafeInteger(anchor.endOffset)
      || typeof anchor.excerpt !== 'string' || !anchor.excerpt.trim() || anchor.excerpt.length > MAX_EXCERPT) return false;
    const start = Number(anchor.startOffset);
    const end = Number(anchor.endOffset);
    return start >= 0 && end > start && end <= draft.length && boundaries.has(start) && boundaries.has(end)
      && utf16Boundary(draft, start) && utf16Boundary(draft, end)
      && draft.substring(start, end) === anchor.excerpt;
  });
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort()
    .map((key) => [key, stableValue((value as Record<string, unknown>)[key])]));
  return value;
}

function contractFingerprint(contract: WorkspaceWorkContract): string | undefined {
  try { return fingerprint(JSON.stringify(stableValue(contract))); } catch { return undefined; }
}

/** Historical WORK metadata is only an ID-to-location hint. The returned source
 * remains the current persisted draft. No text is copied from an assistant. */
function validatedWorkIndex(contract: WorkspaceWorkContract, context: VerificationDraftContext): Map<string, WorkspaceDraftEvidenceAnchor[]> | undefined {
  if (!validContext(context.draft, context.revision) || !/^[a-f0-9]{64}$/u.test(contract.instructionFingerprint ?? '')) return undefined;
  const latest = [...context.history].reverse().find((entry) => entry.role === 'assistant'
    && entry.professorPhase === 'WORK' && entry.autopilot?.runId === context.runId);
  const output = latest?.autopilot?.output;
  if (output?.workArtifactValidated !== true || output.draft !== context.draft || !output.workContract
    || output.workContract.instructionFingerprint !== contract.instructionFingerprint
    || !contractFingerprint(contract) || contractFingerprint(output.workContract) !== contractFingerprint(contract)
    || !Array.isArray(output.workEvidence)) return undefined;
  const allowed = new Set(contract.criteria.map((criterion) => criterion.id));
  if (allowed.size !== contract.criteria.length) return undefined;
  const seen = new Set<string>();
  const index = new Map<string, WorkspaceDraftEvidenceAnchor[]>();
  for (const evidence of output.workEvidence) {
    if (!evidence.criterionId || !allowed.has(evidence.criterionId) || seen.has(evidence.criterionId)) return undefined;
    seen.add(evidence.criterionId);
    const anchor = findDraftAnchor(context.draft, context.revision, evidence.excerpt);
    if (anchor) index.set(evidence.criterionId, [anchor]);
  }
  return index;
}

/** Bind only a newly returned Verification verdict. This neither reevaluates a
 * criterion semantically nor applies an old failed result to persisted data. */
export function bindVerificationEvidence(output: WorkspaceAutopilotOutput, contract: WorkspaceWorkContract,
  context: VerificationDraftContext): WorkspaceAutopilotOutput {
  if (!output.taskFulfillment) return { ...output };
  const { reviewedDraftFingerprint: _untrustedReview, evidenceSource: _untrustedSource,
    draftRevision: _untrustedRevision, draftFingerprint: _untrustedFingerprint, ...review } = output.taskFulfillment;
  const known = new Set(contract.criteria.map((criterion) => criterion.id));
  const counts = new Map<string, number>();
  for (const item of review.criterionReviews) counts.set(item.criterionId, (counts.get(item.criterionId) ?? 0) + 1);
  const index = review.fulfilled && review.contractMatchesTask ? validatedWorkIndex(contract, context) : undefined;
  const criterionReviews: CriterionReview[] = review.criterionReviews.map((item) => {
    const { evidenceAnchors: supplied, evidenceOrigin: _untrustedOrigin, ...preserved } = item;
    let anchors: WorkspaceDraftEvidenceAnchor[] = [];
    let evidenceOrigin: CriterionReview['evidenceOrigin'];
    let invalidExplicit = false;
    const explicit = supplied !== undefined;
    if (explicit) {
      if (validateVerificationAnchors(context.draft, context.revision, supplied)) {
        anchors = supplied.map((anchor) => ({ ...anchor }));
        evidenceOrigin = 'VERIFIER_QUOTE';
      } else invalidExplicit = true;
    } else {
      const quoted = findDraftAnchor(context.draft, context.revision, item.excerpt ?? '');
      if (quoted) { anchors = [quoted]; evidenceOrigin = 'VERIFIER_QUOTE'; }
      else if (known.has(item.criterionId) && counts.get(item.criterionId) === 1
        && item.fulfilled && (!item.status || item.status === 'SATISFIED')) {
        const canonical = index?.get(item.criterionId);
        if (canonical) { anchors = canonical.map((anchor) => ({ ...anchor })); evidenceOrigin = 'VALIDATED_WORK_INDEX'; }
      }
    }
    let status: WorkspaceVerificationCriterionStatus;
    if (!known.has(item.criterionId) || counts.get(item.criterionId) !== 1 || invalidExplicit
      || (item.status !== undefined && !WORKSPACE_VERIFICATION_CRITERION_STATUSES.includes(item.status))) status = 'INVALID_EVIDENCE';
    else if (item.status && item.status !== 'SATISFIED') status = item.status;
    else if (!item.fulfilled) status = anchors.length ? 'PARTIAL' : 'MISSING';
    else if (anchors.length) status = 'SATISFIED';
    else status = item.excerpt?.trim() || explicit ? 'INVALID_EVIDENCE' : 'MISSING';
    return { ...preserved, status, evidenceAnchors: anchors, ...(evidenceOrigin ? { evidenceOrigin } : {}) };
  });
  for (const criterion of contract.criteria) {
    if (!counts.has(criterion.id)) criterionReviews.push({ criterionId: criterion.id, fulfilled: false,
      status: 'MISSING', evidenceAnchors: [] });
  }
  return { ...output, taskFulfillment: { ...review, criterionReviews, evidenceSource: 'PERSISTED_DRAFT',
    draftRevision: context.revision, draftFingerprint: fingerprint(context.draft) } };
}
