import { ServiceUnavailableException } from '@nestjs/common';
import type { WorkspaceAutopilotOutput, WorkspaceProfessorPhase, WorkspaceTemplate } from '@second-brain/shared';
import { WORKSPACE_BRIEF_FIELDS, WORKSPACE_STEP_IDS } from '@second-brain/shared';

/** Prompt adapter for the existing Professor, not another provider or phase engine. */
export function autopilotProfessorDirective(phase: WorkspaceProfessorPhase, template: WorkspaceTemplate): string {
  const longForm = ['memoire', 'tfc', 'academic-research', 'article'].includes(template);
  const task: Partial<Record<WorkspaceProfessorPhase, string>> = {
    COMPREHENSION: 'Reformulate the captured instructions. Extract only facts present in the request into briefFields. Preserve learner and institution requirements. Ask ONE clarification via needsInput only if truly necessary.',
    METHOD: 'Prepare a concrete justified method and plan. Return plan items with clear titles matching the actual task. Include methodology in briefFields when relevant. Existing custom plan constraints remain authoritative.',
    WORK: longForm
      ? 'Prepare ONLY the next bounded section of the current plan, not an entire thesis, research project or article. Return its usable prose in draft. Do not invent observations, research results or references. State unresolved factual requirements in issues or needsInput.'
      : 'Prepare a usable first bounded draft in draft, including the requested reasoning/calculations and conclusion. Respect academic exam and assistance restrictions. Do not invent facts, references or a grade.',
    COACHING: 'Correct only the explicitly recorded problem in the current draft. Preserve all valid existing work. Return a bounded correction in draft and explain it in text.',
    VERIFICATION: 'Actually verify the supplied draft against the captured instructions, method and each actual plan item ID. checkedPlanItemIds must contain ONLY supplied IDs whose work is really complete and verified. Do not mark absent research, delivery, evidence, defense or unfinished sections complete. List concrete remaining issues. Never invent a grade or certification.',
    FINALIZATION: 'Perform a final review and explain in deconstruction how this work was constructed, its reasoning, choices, checks, limitations and transferable lessons. Do not replace or silently rewrite the draft. This is not institutional acceptance or certification.',
  };
  return [
    'The learner explicitly consented to reversible Professor Autopilot preparation of this Workspace draft.',
    'This is a bounded operation of the existing Professor. Preserve all safety, examination and academic-integrity restrictions.',
    'Autopilot execution priority: override ONLY optional pedagogical intake, warm-up, prior-knowledge checks, preference questions and comprehension check-ins from the general teaching strategy. The supplied task is already the intake; proceed with its bounded preparation.',
    'Do not put optional prior-knowledge, confidence, preference or understanding questions in needsInput. Omit needsInput when the supplied instructions contain enough information to perform the current step.',
    'This priority NEVER overrides mandatory examination conditions, assessment assistance restrictions, academic integrity, safety, or explicit learner and institution requirements. Use needsInput for a genuinely indispensable missing fact, source, consent or ambiguous direction; never invent the missing information.',
    task[phase] ?? 'Explain the current task without claiming it is complete.',
    'Return exactly one JSON object, no Markdown fence: {"text":"visible pedagogical explanation", "briefFields":{}, "plan":[{"title":"step"}], "draft":"usable section or draft when requested", "checkedPlanItemIds":[], "issues":[], "needsInput":"only a necessary clarification", "deconstruction":"final retrospective when requested"}. Omit inapplicable fields.',
    'All prose must use the learner locale. Never fabricate sources, approvals, progress or completed actions. Translate neither supplied IDs nor citation labels.',
  ].join(' ');
}

export function parseAutopilotOutput(raw: string): WorkspaceAutopilotOutput {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, ''));
  } catch {
    throw new ServiceUnavailableException({ code: 'workspace_autopilot_invalid_result', message: 'The Professor result could not be verified. Your work is saved.' });
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return invalidOutput();
  const value = parsed as Record<string, unknown>;
  if (typeof value.text !== 'string' || !value.text.trim() || value.text.length > 20_000) return invalidOutput();
  const result: WorkspaceAutopilotOutput = { text: value.text.trim() };
  for (const key of ['draft', 'needsInput', 'deconstruction'] as const) {
    if (value[key] !== undefined) {
      if (typeof value[key] !== 'string' || value[key].length > 40_000) return invalidOutput();
      if (value[key].trim()) result[key] = value[key].trim();
    }
  }
  for (const key of ['issues', 'checkedPlanItemIds'] as const) {
    if (value[key] !== undefined) {
      if (!Array.isArray(value[key]) || value[key].length > 100 || value[key].some((item) => typeof item !== 'string' || item.length > 2_000)) return invalidOutput();
      result[key] = [...new Set((value[key] as string[]).map((item) => item.trim()).filter(Boolean))];
    }
  }
  if (value.briefFields !== undefined) {
    if (!value.briefFields || typeof value.briefFields !== 'object' || Array.isArray(value.briefFields)) return invalidOutput();
    const fields: NonNullable<WorkspaceAutopilotOutput['briefFields']> = {};
    for (const field of WORKSPACE_BRIEF_FIELDS) {
      const entry = (value.briefFields as Record<string, unknown>)[field];
      if (entry === undefined) continue;
      if (typeof entry !== 'string' || entry.length > 8_000) return invalidOutput();
      if (entry.trim()) fields[field] = entry.trim();
    }
    result.briefFields = fields;
  }
  if (value.plan !== undefined) {
    if (!Array.isArray(value.plan) || value.plan.length > 100) return invalidOutput();
    result.plan = value.plan.map((item) => {
      if (!item || typeof item !== 'object' || typeof item.title !== 'string' || !item.title.trim() || item.title.length > 500) return invalidOutput();
      return { title: item.title.trim(), ...(WORKSPACE_STEP_IDS.includes(item.stepId) ? { stepId: item.stepId } : {}) };
    });
  }
  return result;
}

function invalidOutput(): never {
  throw new ServiceUnavailableException({ code: 'workspace_autopilot_invalid_result', message: 'The Professor result could not be verified. Your work is saved.' });
}
