import type {
  LLMGenerateOptions,
  WorkspacePlanItem,
  WorkspaceProfessorPhase,
  WorkspaceTemplate,
  WorkspaceWorkContract,
  WorkspaceWorkIntent,
} from '@second-brain/shared';
import { WORKSPACE_BRIEF_FIELDS, WORKSPACE_STEP_IDS, WORKSPACE_WORK_INTENTS, WORKSPACE_WORK_OUTPUT_KINDS } from '@second-brain/shared';
import { validateAutopilotWorkContract } from './workspace-autopilot';

type JsonSchema = Record<string, unknown>;

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
  material?: { sourceMaterial?: string },
): WorkspaceWorkContract {
  const paragraphs = instructions.split(/\n\s*\n/u).map((part) => part.trim()).filter(Boolean);
  const requirements: string[] = [];
  for (const paragraph of paragraphs) {
    for (let start = 0; start < paragraph.length;) {
      let end = Math.min(start + 2_000, paragraph.length);
      // Do not split a UTF-16 surrogate pair at a metadata size boundary.
      if (end < paragraph.length && /[\uD800-\uDBFF]/u.test(paragraph[end - 1]!)) end -= 1;
      const requirement = paragraph.slice(start, end).trim();
      if (requirement && !requirements.includes(requirement)) requirements.push(requirement);
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
    criteria: requirements.map((requirement, index) => ({ id: `required-${index + 1}`, requirement, required: true })),
    sourceRequirement: intent === 'research-task' ? 'cited-evidence'
      : intent === 'article-summary' ? sourceMaterial ? 'provided-content' : 'cited-evidence' : 'none',
    ...(intent === 'article-summary' && sourceMaterial ? { sourceExcerpt: sourceMaterial.slice(0, 8_000) } : {}),
  };
  // Keep the authoritative parser, bounds, source, scope and criteria gate.
  // Too many requirements reject rather than silently dropping obligations.
  return validateAutopilotWorkContract(contract, template, instructions, plan);
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
  const contractSchema = object({
    version: { type: 'integer', enum: [1] },
    taskIntent: choice(contract ? [contract.taskIntent] : intent ? [intent] : WORKSPACE_WORK_INTENTS),
    outputKind: choice(contract ? [contract.outputKind] : intent ? [workOutputKindForIntent(intent)] : WORKSPACE_WORK_OUTPUT_KINDS),
    operation: choice(contract ? [contract.operation] : ['produce', 'transform', 'reproduce']),
    scope: choice(contract ? [contract.scope] : ['entire-task', 'current-section']),
    task: string('The actual requested deliverable, not the shell label. Maximum 4000 characters.'),
    criteria: list(object({
      id: string('Unique ASCII identifier: letters, digits, hyphen or underscore; maximum 128 characters.'),
      requirement: string('Exact original instruction excerpt; retain every obligation, maximum 2000 characters per item.'),
      required: { type: 'boolean' },
    })),
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
      requirement: string('Exact words from the original task, matching a required contract criterion.'),
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
