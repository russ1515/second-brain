import type {
  LLMGenerateOptions,
  WorkspaceBrief,
  WorkspacePlanItem,
  WorkspaceProfessorPhase,
  WorkspaceTemplate,
  WorkspaceWorkContract,
  WorkspaceWorkIntent,
  WorkspaceWorkCriterion,
  WorkspaceWorkCriterionOrigin,
} from '@second-brain/shared';
import { WORKSPACE_BRIEF_FIELDS, WORKSPACE_STEP_IDS, WORKSPACE_WORK_INTENTS, WORKSPACE_WORK_OUTPUT_KINDS,
  WORKSPACE_WORK_CRITERION_CLASSES, WORKSPACE_WORK_CRITERION_CONDITIONS, WORKSPACE_WORK_CRITERION_ORIGINS } from '@second-brain/shared';
import { ServiceUnavailableException } from '@nestjs/common';
import { validateAutopilotWorkContract } from './workspace-autopilot';

type JsonSchema = Record<string, unknown>;

interface BootstrapMaterial {
  sourceMaterial?: string;
  brief?: WorkspaceBrief;
  objective?: string;
  sourceAvailable?: boolean;
}

function invalidCriteria(): never {
  throw new ServiceUnavailableException({ code: 'workspace_autopilot_work_artifact_required',
    message: 'The work criteria need a valid task interpretation before preparation.' });
}

function obligationSources(brief: WorkspaceBrief, objective: string): Array<{ value: string; originField: WorkspaceWorkCriterionOrigin }> {
  return [
    { value: brief.fields.userInstructions ?? '', originField: 'userInstructions' as const },
    { value: brief.fields.institutionInstructions ?? '', originField: 'institutionInstructions' as const },
    { value: brief.fields.requirements ?? '', originField: 'requirements' as const },
    { value: brief.fields.deliverable ?? '', originField: 'deliverable' as const },
    { value: objective, originField: 'objective' as const },
  ].filter((source) => source.value.trim());
}

const metadataText = (value: string) => value.normalize('NFKC').replace(/\s+/gu, ' ').trim();
const modalText = (value: string) => value.normalize('NFKD').replace(/[\u0300-\u036f]/gu, '').toLowerCase();

/** A deliberately bounded legacy bootstrap aid, not a multilingual semantic
 * engine. Existing C/M interpretation remains responsible for richer wording.
 * Unresolved conditions are retained and block, rather than silently waived. */
function classifyBootstrapClause(requirement: string): Pick<WorkspaceWorkCriterion, 'classification' | 'condition' | 'required'> {
  const value = modalText(requirement);
  const optional = /^(?:\[optional\]|optional\s*:|facultatif\s*:|optionnel\s*:)/u.test(value);
  if (optional && !/\b(?:must|required|obligatoire|dois|doit|devez)\b/u.test(value)) {
    return { classification: 'OPTIONAL', condition: 'NONE', required: false };
  }
  const conditional = /\b(?:si|if|unless|lorsque|when)\b/u.test(value);
  if (conditional || optional) {
    const sourceOnly = /^(?:utilise[rz]?|use|cite[rz]?|consult(?:e[rz]?)?)\b/u.test(value)
      && /\b(?:sources?|references?|bibliotheque|library)\b/u.test(value)
      && /\b(?:si\b[^.!?]*\bdisponibles?|if\b[^.!?]*\bavailable)\b/u.test(value)
      && !/\b(?:et|and|puis|then|mais|but)\b/u.test(value);
    return { classification: 'CONDITIONAL', condition: sourceOnly ? 'SOURCE_AVAILABLE' : 'UNRESOLVED', required: true };
  }
  if (/^(?:\[format\]|format\s*:)/u.test(value)) return { classification: 'FORMAT', condition: 'NONE', required: true };
  if (/^(?:\[style\]|style\s*:)/u.test(value)) return { classification: 'STYLE', condition: 'NONE', required: true };
  return { classification: 'REQUIRED', condition: 'NONE', required: true };
}

function obligationClauses(paragraph: string): string[] {
  // Ordinary tasks stay one paragraph/criterion. Only split when a standalone
  // modality can be isolated; this avoids exploding the bounded WORK response.
  const parts = paragraph.split(/(?<=[.!?])\s+/u).map((part) => part.trim()).filter(Boolean);
  return parts.length > 1 && parts.some((part) => classifyBootstrapClause(part).classification === 'OPTIONAL'
    || classifyBootstrapClause(part).classification === 'CONDITIONAL') ? parts : [paragraph];
}

/** Resolve capabilities only from a server fact, never a provider's applicable
 * flag. Unknown conditions remain mandatory/UNKNOWN and cannot unlock a gate. */
export function resolveWorkCriteriaApplicability(contract: WorkspaceWorkContract, actualSourceAvailable?: boolean): WorkspaceWorkContract {
  return { ...contract, criteria: contract.criteria.map((criterion): WorkspaceWorkCriterion => {
    const classification = criterion.classification ?? (criterion.required ? 'REQUIRED' : 'OPTIONAL');
    const condition = criterion.condition ?? (classification === 'CONDITIONAL' ? 'UNRESOLVED' : 'NONE');
    if ((classification === 'OPTIONAL' && criterion.required)
      || (['REQUIRED', 'STYLE', 'FORMAT'].includes(classification) && !criterion.required)
      || (classification !== 'CONDITIONAL' && condition !== 'NONE')) return invalidCriteria();
    if (classification === 'CONDITIONAL') {
      const applicable = condition === 'SOURCE_AVAILABLE' && typeof actualSourceAvailable === 'boolean'
        ? actualSourceAvailable : 'UNKNOWN';
      return { ...criterion, classification, condition, applicable, required: true };
    }
    return { ...criterion, classification, condition, applicable: classification !== 'OPTIONAL',
      required: classification === 'OPTIONAL' ? false : criterion.required };
  }) };
}

/** Optional integration guard for C/M: an origin label never promotes title or
 * context into a task obligation. The source wording must actually be present
 * in one of the owner-supplied obligation fields. */
export function prepareWorkContractCriteria(contract: WorkspaceWorkContract, brief: WorkspaceBrief, objective: string,
  actualSourceAvailable?: boolean): WorkspaceWorkContract {
  const sources = obligationSources(brief, objective);
  const criteria = contract.criteria.map((criterion) => {
    const matches = sources.filter((source) => metadataText(source.value).includes(metadataText(criterion.requirement)));
    if (!matches.length) return invalidCriteria();
    const source = matches.find((item) => item.originField === criterion.originField) ?? matches[0]!;
    return { ...criterion, originField: source.originField };
  });
  return resolveWorkCriteriaApplicability({ ...contract, criteria }, actualSourceAvailable);
}

const OUTPUT_BY_EXPLICIT_INTENT: Record<WorkspaceWorkIntent, WorkspaceWorkContract['outputKind']> = {
  'assignment-exercise': 'ANSWER_DRAFT',
  'article-summary': 'SUMMARY_DRAFT',
  'research-task': 'SOURCED_RESEARCH_DRAFT',
  'academic-section': 'CURRENT_ACADEMIC_SECTION_DRAFT',
  'argumentative-essay': 'ARGUMENTATIVE_DRAFT',
  'scientific-article': 'SCIENTIFIC_DRAFT',
  report: 'REPORT_DRAFT',
  general: 'INTENT_MATCHED_DRAFT',
};

export function workOutputKindForIntent(intent: WorkspaceWorkIntent): WorkspaceWorkContract['outputKind'] {
  return OUTPUT_BY_EXPLICIT_INTENT[intent];
}

/** A typed user intent is an orchestration input, not a text classifier. The
 * subsequent existing verification still checks that it covers the real task. */
export function workContractFromIntent(
  intent: WorkspaceWorkIntent,
  template: WorkspaceTemplate,
  instructions: string,
  plan: readonly WorkspacePlanItem[],
  material?: BootstrapMaterial,
): WorkspaceWorkContract {
  const paragraphs = instructions.split(/\n\s*\n/u).map((part) => part.trim()).filter(Boolean);
  const sources = material?.brief ? obligationSources(material.brief, material.objective ?? '')
    : [{ value: instructions, originField: 'canonicalInstructions' as const }];
  const criteria: WorkspaceWorkCriterion[] = [];
  for (const source of sources) for (const paragraph of source.value.split(/\n\s*\n/u).map((part) => part.trim()).filter(Boolean)) {
    for (const clause of obligationClauses(paragraph)) for (let start = 0; start < clause.length;) {
      let end = Math.min(start + 2_000, clause.length);
      // Do not split a UTF-16 surrogate pair at a metadata size boundary.
      if (end < clause.length && /[\uD800-\uDBFF]/u.test(clause[end - 1]!)) end -= 1;
      const requirement = clause.slice(start, end).trim();
      if (requirement && !criteria.some((item) => item.requirement === requirement)) criteria.push({
        id: `required-${criteria.length + 1}`, requirement,
        ...classifyBootstrapClause(clause), originField: source.originField,
      });
      start = end;
    }
  }
  const sourceMaterial = material?.sourceMaterial?.trim();
  const section = intent === 'academic-section' || intent === 'scientific-article';
  const contract: WorkspaceWorkContract = {
    version: 1,
    taskIntent: intent,
    // The existing validator below checks the canonical mapping as well; a
    // template never overrides the explicitly supplied semantic intent.
    outputKind: workOutputKindForIntent(intent),
    operation: intent === 'article-summary' ? 'transform' : 'produce',
    scope: section ? 'current-section' : 'entire-task',
    // A bounded label is not the criteria: all source obligations below remain
    // exact and untruncated, including those beyond this label's size limit.
    task: paragraphs.join('\n\n').slice(0, 4_000),
    criteria,
    sourceRequirement: intent === 'research-task' ? 'cited-evidence'
      : intent === 'article-summary' ? sourceMaterial ? 'provided-content' : 'cited-evidence' : 'none',
    ...(intent === 'article-summary' && sourceMaterial ? { sourceExcerpt: sourceMaterial.slice(0, 8_000) } : {}),
  };
  // Keep the authoritative parser, bounds, source, scope and criteria gate.
  // Too many requirements reject rather than silently dropping obligations.
  const validated = validateAutopilotWorkContract(resolveWorkCriteriaApplicability(contract, material?.sourceAvailable), template, instructions, plan);
  return resolveWorkCriteriaApplicability(validated, material?.sourceAvailable);
}

/** Uses the existing provider-agnostic Structured Outputs option. This ensures
 * transport shape, never pedagogical correctness or a successful WORK verdict. */
export function workContractResponseSchema(
  phase: WorkspaceProfessorPhase,
  contract?: WorkspaceWorkContract,
  intent?: WorkspaceWorkIntent,
): LLMGenerateOptions['jsonSchema'] | undefined {
  if (!['COMPREHENSION', 'METHOD', 'WORK'].includes(phase)) return undefined;
  const string = (description?: string): JsonSchema => ({ type: 'string', ...(description ? { description } : {}) });
  const list = (items: JsonSchema): JsonSchema => ({ type: 'array', items });
  const choice = (values: readonly string[]): JsonSchema => ({ type: 'string', enum: [...values] });
  const object = (properties: Record<string, JsonSchema>): JsonSchema => ({
    type: 'object', properties, required: Object.keys(properties), additionalProperties: false,
  });
  const criterionSchema = (criterion?: WorkspaceWorkCriterion): JsonSchema => object({
    id: criterion ? choice([criterion.id]) : string('Unique ASCII identifier: letters, digits, hyphen or underscore; maximum 128 characters.'),
    requirement: string('Exact original obligation excerpt, not descriptive title/context; maximum 2000 characters.'),
    required: criterion ? { type: 'boolean', enum: [criterion.required] } : { type: 'boolean' },
    classification: choice(criterion ? [criterion.classification ?? (criterion.required ? 'REQUIRED' : 'OPTIONAL')] : WORKSPACE_WORK_CRITERION_CLASSES),
    condition: choice(criterion ? [criterion.condition ?? 'NONE'] : WORKSPACE_WORK_CRITERION_CONDITIONS),
    originField: choice(criterion ? [criterion.originField ?? 'UNSPECIFIED'] : WORKSPACE_WORK_CRITERION_ORIGINS),
  });
  const contractSchema = object({
    version: { type: 'integer', enum: [1] },
    taskIntent: choice(contract ? [contract.taskIntent] : intent ? [intent] : WORKSPACE_WORK_INTENTS),
    outputKind: choice(contract ? [contract.outputKind] : intent ? [workOutputKindForIntent(intent)] : WORKSPACE_WORK_OUTPUT_KINDS),
    operation: choice(contract ? [contract.operation] : ['produce', 'transform', 'reproduce']),
    scope: choice(contract ? [contract.scope] : ['entire-task', 'current-section']),
    task: string('The actual requested deliverable, not the shell label. Maximum 4000 characters.'),
    criteria: list(contract ? { anyOf: contract.criteria.map((criterion) => criterionSchema(criterion)) } : criterionSchema()),
    sourceRequirement: choice(contract ? [contract.sourceRequirement] : ['none', 'provided-content', 'cited-evidence']),
    sourceExcerpt: string('Exact actual source material when provided-content is required; otherwise empty string. Maximum 8000 characters.'),
  });
  const properties: Record<string, JsonSchema> = {
    text: string('A short visible explanation, separate from the actual artifact.'),
    workContract: contractSchema,
    issues: list(string()),
    needsInput: string('One indispensable clarification, or an empty string when no clarification is needed.'),
  };
  if (phase === 'WORK') {
    properties.draft = string('The actual requested usable artifact, never merely a plan, method or reformulated task.'),
    properties.workOutputKind = choice(contract ? [contract.outputKind] : intent ? [workOutputKindForIntent(intent)] : WORKSPACE_WORK_OUTPUT_KINDS);
    properties.workEvidence = list(object({
      criterionId: contract ? choice(contract.criteria.map((criterion) => criterion.id)) : string('The actual ID of the fulfilled contract criterion.'),
      requirement: string('Description of the fulfilled criterion; criterionId is authoritative, wording may be equivalent.'),
      excerpt: string('Exact produced passage from draft satisfying that criterion.'),
    }));
  } else {
    properties.briefFields = object(Object.fromEntries(WORKSPACE_BRIEF_FIELDS.map((field) => [field, string('An extracted fact, or empty string when absent. Never invent a fact.')])));
    properties.plan = list(object({ title: string('Concrete task-relevant step.'), stepId: choice(['', ...WORKSPACE_STEP_IDS]) }));
  }
  return {
    name: `workspace_${phase.toLowerCase()}_contract_v1`,
    description: 'Preserve the actual task intent and canonical work artifact type through the existing Professor phases. Empty strings or arrays denote inapplicable fields; no null values.',
    strict: true,
    schema: object(properties),
  };
}
