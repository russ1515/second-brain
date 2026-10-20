import { ServiceUnavailableException } from '@nestjs/common';
import type { LLMGenerateOptions, WorkspaceDraftEvidenceAnchor, WorkspaceSourceCitation, WorkspaceWorkContract } from '@second-brain/shared';
import { criterionEvidenceMatrix } from './workspace-autopilot';
import { findDraftAnchor, validateVerificationAnchors } from './workspace-verification-evidence';

type JsonSchema = Record<string, unknown>;
type RecordValue = Record<string, unknown>;
export interface DownstreamVerificationDraftContext {
  draft: string;
  revision: number;
  /** Resolved by the existing owner-scoped AW-6 engine, never the provider. */
  sourceAvailable?: boolean;
  /** Citations actually recorded with this draft and re-resolved by AW-6. */
  citations?: readonly WorkspaceSourceCitation[];
}

/** Shape/provenance rejection only. Semantic correctness remains the existing
 * independent Verification verdict and authoritative task-fulfilment gate. */
export class WorkspaceVerificationContractError extends ServiceUnavailableException {
  constructor(readonly reason: string) {
    super({ code: 'workspace_autopilot_invalid_verification',
      message: 'The verification result is incomplete or unsupported. Your work is saved.', reason });
  }
}

const invalid = (reason: string): never => { throw new WorkspaceVerificationContractError(reason); };
const objectValue = (value: unknown): value is RecordValue => Boolean(value && typeof value === 'object' && !Array.isArray(value));

/** Reuse the same applicability matrix as the existing task gate. Optional and
 * server-resolved inapplicable criteria must not become new obligations. */
export function verificationExpectedCriteria(contract: WorkspaceWorkContract, sourceAvailable?: boolean) {
  if (!contract?.criteria?.length || contract.criteria.length > 100) return invalid('VERIFICATION_CONTRACT_INVALID');
  const ids = contract.criteria.map((criterion) => criterion.id);
  if (ids.some((id) => !/^[A-Za-z0-9_-]{1,128}$/u.test(id)) || new Set(ids).size !== ids.length) {
    return invalid('VERIFICATION_CONTRACT_IDS_INVALID');
  }
  const matrix = criterionEvidenceMatrix({ text: '' }, contract, '', { sourceAvailable });
  if (matrix.some((row) => row.required && row.applicable === 'UNKNOWN')) return invalid('VERIFICATION_APPLICABILITY_UNKNOWN');
  const expected = new Set(matrix.filter((row) => row.required && row.applicable === true).map((row) => row.criterionId));
  return contract.criteria.filter((criterion) => expected.has(criterion.id));
}

/** Uses the already supported provider-agnostic Structured Outputs option.
 * No nullable fields, no synthetic success and no change to the WORK schema. */
export function verificationResponseSchema(contract: WorkspaceWorkContract, sourceAvailable?: boolean): NonNullable<LLMGenerateOptions['jsonSchema']> {
  const criteria = verificationExpectedCriteria(contract, sourceAvailable);
  const string = (description?: string): JsonSchema => ({ type: 'string', ...(description ? { description } : {}) });
  const list = (items: JsonSchema): JsonSchema => ({ type: 'array', items });
  const object = (properties: Record<string, JsonSchema>): JsonSchema => ({
    type: 'object', properties, required: Object.keys(properties), additionalProperties: false,
  });
  const reviews: JsonSchema = { type: 'array', minItems: criteria.length, maxItems: criteria.length,
    items: object({
      criterionId: criteria.length ? { type: 'string', enum: criteria.map((criterion) => criterion.id) } : string(),
      status: { type: 'string', enum: ['SATISFIED', 'PARTIAL', 'MISSING'] },
      fulfilled: { type: 'boolean' },
      reason: string('A concrete independent evaluation of this exact criterion against the actual persisted draft.'),
      evidenceExcerpts: { type: 'array', minItems: 0, maxItems: 8,
        items: string('A verbatim contiguous quotation of the persisted draft; never objective, commentary, ellipses or a paraphrase.') },
    }) };
  return {
    name: 'workspace_verification_complete_v1', strict: true,
    description: 'Independently evaluate every expected criterion exactly once against the persisted draft. No omission is a successful review.',
    schema: object({
      text: string('A short visible verification summary, not the artifact being evaluated.'),
      taskFulfillment: object({
        contractMatchesTask: { type: 'boolean' }, fulfilled: { type: 'boolean' },
        scope: { type: 'string', enum: [contract.scope] }, criterionReviews: reviews,
        citationLabels: list(string('Only an existing source label supplied with the draft.')),
        uncoveredRequirements: list(string('An actual unmet instruction; empty only if none remain.')),
      }),
      checkedPlanItemIds: list(string('An existing plan ID whose entire promised work is independently complete.')),
      issues: list(string()), needsInput: string('Only an indispensable clarification, otherwise an empty string.'),
    }),
  };
}

export function verificationProfessorDirective(contract: WorkspaceWorkContract, sourceAvailable?: boolean): string {
  const criteria = verificationExpectedCriteria(contract, sourceAvailable);
  return [
    'VERIFICATION COMPLETE REVIEW CONTRACT: evaluate the current persisted draft, not prior Professor commentary, a method, the objective or the original question as though it were the answer.',
    `EXPECTED_CRITERION_COUNT=${criteria.length}; EXPECTED_CRITERION_IDS=${JSON.stringify(criteria.map((criterion) => criterion.id))}.`,
    `REQUIRED APPLICABLE CRITERIA=${JSON.stringify(criteria)}.`,
    'Return exactly one review for EACH expected ID and no other ID. Check that the returned ID set exactly equals the expected ID set before returning. Never omit an unevaluated criterion, duplicate a review, silently truncate the list, or invent a replacement criterion.',
    'Every review needs an independent concrete reason, status SATISFIED/PARTIAL/MISSING, fulfilled=true only for SATISFIED, and evidenceExcerpts containing up to 8 separate verbatim contiguous quotations of the supplied persisted draft. Separate quotations may jointly support one criterion. Never join them with ellipses or invent commentary as evidence. Missing or unsupported criteria stay false; absence never means satisfaction.',
    'The original learner and institution instructions remain authoritative. Evaluate content, correctness and scope, not merely whether a quotation exists. A supplied contract, old WORK evidence or previous verdict is not proof of correctness. Preserve source identities and report genuinely uncovered obligations.',
    'Do not return draft, workContract, workEvidence or a regenerated answer. This operation only verifies the unchanged persisted artifact. Keep the response concise enough to include every review.',
  ].join('\n');
}

/** Validate the raw verifier response BEFORE the existing parser/binder can
 * synthesize MISSING entries. Convert only real quoted spans to canonical
 * anchors with the existing resolver; never use historical WORK success as a
 * substitute for a fresh verifier review or a fresh quotation. */
export function normalizeVerificationProviderOutput(raw: string, contract: WorkspaceWorkContract,
  context: DownstreamVerificationDraftContext): string {
  let root: unknown;
  try { root = JSON.parse(raw.trim().replace(/^```(?:json)?\s*/iu, '').replace(/\s*```$/u, '')); }
  catch { return invalid('VERIFICATION_INVALID_JSON'); }
  if (!objectValue(root) || !objectValue(root.taskFulfillment)) return invalid('VERIFICATION_REVIEW_MISSING');
  if (['draft', 'workContract', 'workEvidence', 'workOutputKind', 'plan', 'briefFields',
    'deconstruction', 'finalizationEvidence'].some((key) => root[key] !== undefined)) {
    return invalid('VERIFICATION_ARTIFACT_MUTATION_FORBIDDEN');
  }
  const task = root.taskFulfillment;
  if (typeof task.fulfilled !== 'boolean' || typeof task.contractMatchesTask !== 'boolean' || task.scope !== contract.scope) {
    return invalid('VERIFICATION_VERDICT_INVALID');
  }
  const labels = new Set((context.citations ?? []).map((citation) => citation.citationLabel));
  if (!Array.isArray(task.citationLabels) || task.citationLabels.length > 100
    || task.citationLabels.some((label) => typeof label !== 'string' || !labels.has(label))
    || new Set(task.citationLabels).size !== task.citationLabels.length) {
    return invalid('VERIFICATION_SOURCE_LABELS_INVALID');
  }
  const expectedIds = new Set(verificationExpectedCriteria(contract, context.sourceAvailable).map((criterion) => criterion.id));
  if (!Array.isArray(task.criterionReviews) || task.criterionReviews.length !== expectedIds.size) {
    return invalid('VERIFICATION_CRITERIA_COVERAGE');
  }
  const seen = new Set<string>();
  const reviews = task.criterionReviews.map((review: unknown) => {
    if (!objectValue(review) || typeof review.criterionId !== 'string'
      || !expectedIds.has(review.criterionId) || seen.has(review.criterionId)) return invalid('VERIFICATION_CRITERIA_IDS');
    seen.add(review.criterionId);
    if (!['SATISFIED', 'PARTIAL', 'MISSING'].includes(review.status as string)
      || typeof review.fulfilled !== 'boolean' || review.fulfilled !== (review.status === 'SATISFIED')
      || typeof review.reason !== 'string' || !review.reason.trim() || review.reason.length > 2_000) {
      return invalid('VERIFICATION_CRITERION_VERDICT_INVALID');
    }
    let anchors: WorkspaceDraftEvidenceAnchor[] = [];
    if (review.evidenceAnchors !== undefined) {
      if (!validateVerificationAnchors(context.draft, context.revision, review.evidenceAnchors)) {
        return invalid('VERIFICATION_ANCHORS_INVALID');
      }
      anchors = review.evidenceAnchors.map((anchor) => ({ ...anchor }));
    }
    const excerpts = review.evidenceExcerpts !== undefined ? review.evidenceExcerpts
      : (review.excerpt !== undefined ? [review.excerpt] : undefined);
    if (excerpts !== undefined) {
      if (!Array.isArray(excerpts) || excerpts.length > 8
        || excerpts.some((excerpt) => typeof excerpt !== 'string' || !excerpt.trim() || excerpt.length > 8_000)) {
        return invalid('VERIFICATION_EXCERPTS_INVALID');
      }
      const resolved = excerpts.map((excerpt) => findDraftAnchor(context.draft, context.revision, excerpt));
      if (resolved.some((anchor) => !anchor)) return invalid('VERIFICATION_EXCERPT_NOT_IN_DRAFT');
      if (anchors.length && (anchors.length !== resolved.length
        || anchors.some((anchor, index) => anchor.excerpt !== resolved[index]?.excerpt))) return invalid('VERIFICATION_EVIDENCE_CONFLICT');
      anchors = resolved as WorkspaceDraftEvidenceAnchor[];
    }
    if (review.status === 'SATISFIED' && !anchors.length) return invalid('VERIFICATION_SATISFIED_WITHOUT_EVIDENCE');
    // Remove the provider-only quote array. The canonical existing parser and
    // binder remain authoritative for these server-resolved spans.
    const { evidenceExcerpts: _quotes, evidenceAnchors: _anchors, excerpt: _excerpt, ...preserved } = review;
    return { ...preserved, reason: review.reason, ...(anchors.length ? { evidenceAnchors: anchors } : {}),
      ...(anchors[0] ? { excerpt: anchors[0].excerpt } : {}) };
  });
  if (seen.size !== expectedIds.size) return invalid('VERIFICATION_CRITERIA_COVERAGE');
  // Inspect raw strings before AW-6 presentation normalization can erase an
  // unknown label. A forged citation must remain a rejection, not disappear.
  const prose = [root.text, root.needsInput, ...(Array.isArray(root.issues) ? root.issues : []),
    ...(Array.isArray(task.uncoveredRequirements) ? task.uncoveredRequirements : []),
    ...reviews.flatMap((review) => [review.reason, review.excerpt,
      ...(review.evidenceAnchors ?? []).map((anchor) => anchor.excerpt)])]
    .filter((value): value is string => typeof value === 'string').join('\n');
  if ([...prose.matchAll(/\[\s*(W\d+)\s*\]/gu)].some((match) => !labels.has(match[1]!))) {
    return invalid('VERIFICATION_SOURCE_LABEL_UNKNOWN');
  }
  const canonicalUrl = (value: string) => value.replace(/[.,;:!?\])}]+$/gu, '');
  const urls = (value: string) => [...value.matchAll(/https?:\/\/[^\s<>"'`]+/giu)].map((match) => canonicalUrl(match[0]));
  const knownUrls = new Set([...urls(context.draft), ...(context.citations ?? [])
    .flatMap((citation) => citation.url ? [canonicalUrl(citation.url)] : [])]);
  if (urls(prose).some((url) => !knownUrls.has(url))) return invalid('VERIFICATION_SOURCE_URL_UNKNOWN');
  return JSON.stringify({ ...root, taskFulfillment: { ...task, criterionReviews: reviews } });
}
