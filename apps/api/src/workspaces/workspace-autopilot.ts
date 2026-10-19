import { ServiceUnavailableException } from '@nestjs/common';
import type { WorkspaceAutopilotOutput, WorkspaceProfessorPhase, WorkspaceTemplate, WorkspaceWorkOutputKind } from '@second-brain/shared';
import { WORKSPACE_BRIEF_FIELDS, WORKSPACE_STEP_IDS, WORKSPACE_WORK_OUTPUT_KINDS, workspaceShellFromTemplate } from '@second-brain/shared';

export function workspaceWorkOutputKind(template: WorkspaceTemplate): WorkspaceWorkOutputKind {
  const outputs: Record<ReturnType<typeof workspaceShellFromTemplate>, WorkspaceWorkOutputKind> = {
    assignment: 'ANSWER_DRAFT', thesis: 'CURRENT_SECTION_DRAFT',
    dissertation: 'ARGUMENTATIVE_DRAFT', article: 'SCIENTIFIC_SECTION_DRAFT',
    report: 'REPORT_SECTION_DRAFT', general: 'ADAPTIVE_DRAFT',
  };
  return outputs[workspaceShellFromTemplate(template)];
}

/** Prompt adapter for the existing Professor, not another provider or phase engine. */
export function autopilotProfessorDirective(phase: WorkspaceProfessorPhase, template: WorkspaceTemplate): string {
  const longForm = ['memoire', 'tfc', 'academic-research', 'article'].includes(template);
  const task: Partial<Record<WorkspaceProfessorPhase, string>> = {
    COMPREHENSION: 'Reformulate the captured instructions. Extract only facts present in the request into briefFields. Preserve learner and institution requirements. Ask ONE clarification via needsInput only if truly necessary.',
    METHOD: 'Prepare a concrete justified method and plan. Return plan items with clear titles matching the actual task. Include methodology in briefFields when relevant. Existing custom plan constraints remain authoritative.',
    WORK: [
      `WORK_OUTPUT=${workspaceWorkOutputKind(template)}. WORK means producing the actual usable artifact NOW in draft, not a reformulation, checklist, plan, advice, description or explanation of what should be produced later.`,
      longForm
        ? 'Produce ONLY the actual prose of the current bounded section, not an entire thesis, research project or article. Work on the content of that section, not an explanation of how to write it.'
        : 'Produce the requested deliverable itself, addressing ALL explicit requested elements. For an answer, actually answer the questions and carry out requested calculations with substitutions, results, units, reasoning and conclusion when requested. Do not merely describe the method.',
      'Do not let an administrative plan heading such as instruction analysis replace the requested artifact. Keep explanations of how to do the work out of draft unless they are themselves explicitly part of the requested deliverable.',
      'Set workOutputKind to the required WORK_OUTPUT. Include workEvidence for each explicit requested element: requirement is an exact short excerpt of the supplied instructions; excerpt is an exact passage of the produced draft that actually addresses it. Do not quote a future instruction as evidence of completed work.',
      'Never invent experimental results, user facts, citations, page numbers or references. Use general knowledge when appropriate and authorized AW-6 evidence when required. A source requested only if available is optional. If an indispensable fact/source is missing, use needsInput instead of fabricating an artifact.',
    ].join(' '),
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
    phase === 'WORK'
      ? `Return exactly one JSON object, no Markdown fence: {"text":"short visible explanation, separate from the artifact", "draft":"the actual usable produced artifact", "workOutputKind":"${workspaceWorkOutputKind(template)}", "workEvidence":[{"requirement":"exact instruction excerpt","excerpt":"exact produced answer passage"}], "issues":[], "needsInput":"only a necessary clarification"}. Omit inapplicable fields.`
      : 'Return exactly one JSON object, no Markdown fence: {"text":"visible pedagogical explanation", "briefFields":{}, "plan":[{"title":"step"}], "draft":"usable section or draft when requested", "checkedPlanItemIds":[], "issues":[], "needsInput":"only a necessary clarification", "deconstruction":"final retrospective when requested"}. Omit inapplicable fields.',
    'All prose must use the learner locale. Never fabricate sources, approvals, progress or completed actions. Translate neither supplied IDs nor citation labels.',
    phase === 'WORK' ? 'Exception for verbatim source metadata: workEvidence.requirement must remain in the exact language and words of the supplied instructions, and workEvidence.excerpt in the exact words of draft. Never translate either excerpt; text and draft still use the learner locale.' : '',
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
  if (value.workOutputKind !== undefined) {
    if (!WORKSPACE_WORK_OUTPUT_KINDS.includes(value.workOutputKind as WorkspaceWorkOutputKind)) return invalidOutput();
    result.workOutputKind = value.workOutputKind as WorkspaceWorkOutputKind;
  }
  if (value.workEvidence !== undefined) {
    if (!Array.isArray(value.workEvidence) || value.workEvidence.length > 100) return invalidOutput();
    result.workEvidence = value.workEvidence.map((item) => {
      if (!item || typeof item !== 'object' || typeof item.requirement !== 'string' || typeof item.excerpt !== 'string'
        || !item.requirement.trim() || !item.excerpt.trim() || item.requirement.length > 2_000 || item.excerpt.length > 8_000) return invalidOutput();
      return { requirement: item.requirement.trim(), excerpt: item.excerpt.trim() };
    });
  }
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

/** Structural acceptance, not a replacement for the authoritative subsequent
 * pedagogical verification. Evidence must point into the real produced body. */
export function assertAutopilotWorkArtifact(output: WorkspaceAutopilotOutput, template: WorkspaceTemplate, instructions: string): void {
  const body = output.draft?.trim();
  if (!body || output.workOutputKind !== workspaceWorkOutputKind(template)
    || !output.workEvidence?.length || isCommentaryOnlyWorkDraft(body, instructions)) return invalidWorkArtifact();
  if (isTrivialUnrelatedSocialReply(body, instructions)) return invalidWorkArtifact();
  const source = normalizedWorkText(instructions);
  const artifact = normalizedWorkText(body);
  let producedEvidence = false;
  for (const evidence of output.workEvidence) {
    const requirement = normalizedWorkText(evidence.requirement);
    const excerpt = normalizedWorkText(evidence.excerpt);
    if (!requirement || !excerpt || !source.includes(requirement) || !artifact.includes(excerpt)) return invalidWorkArtifact();
    // Restating supplied data inside an actual answer is legitimate, but those
    // copied data alone cannot establish that an artifact has been produced.
    if (!source.includes(excerpt) && !isCommentaryOnlyWorkDraft(evidence.excerpt, instructions)) producedEvidence = true;
  }
  if (!producedEvidence) return invalidWorkArtifact();
}

/** Detect known non-artifact forms without a subject-specific answer key. A
 * missing legacy kind is deliberately not classified as invalid content. */
export function isCommentaryOnlyWorkDraft(body: string, instructions: string): boolean {
  const content = normalizedWorkText(body);
  const source = normalizedWorkText(instructions);
  if (!content || (source && (content === source || source.includes(content)))) return true;
  const words = content.split(' ');
  const sourceWords = new Set(source.split(' '));
  if (words.length >= 24 && words.filter((word) => sourceWords.has(word)).length / words.length > 0.92) return true;
  // An imperative is legitimate produced content when the requested deliverable
  // is itself a procedure/guide. Exact restatement above remains invalid.
  if (requestsProceduralArtifact(instructions)) return false;
  const guidance = /^(?:you (?:should|must|need to|can|will)|(?:we|i) (?:should|must|need to|will)|to (?:complete|produce|write|solve|answer|calculate)|(?:the|this) (?:task|assignment|work|draft|response) (?:asks|requires|should|must|will|is to|consists)|for [^,]+,\s*(?:calculate|provide|write|give|explain|show|use|identify)\b|(?:the|these|your) instructions (?:stress|require|emphasize|ask)\b|(?:here (?:are|is)|below (?:are|is)) (?:the )?(?:steps|method|plan)|(?:first|then|next|finally)[,:]?\s*(?:use|apply|calculate|explain|write|give|show|identify|define|compare)|(?:use|apply|calculate|write|identify|define|compare)\b|tu (?:devrais|dois|peux|vas)|vous (?:devriez|devez|pouvez|allez)|(?:il faut|il faudra|il faudrait|pense à|pensez à|on (?:doit|devrait|va))|(?:voici|suivez|suis) (?:la |les |une |un )?(?:méthode|étapes|plan|démarche)|(?:le|ce) (?:devoir|travail|sujet|brouillon|document) (?:demande|consiste|doit|devra|devrait|nécessite)|(?:pour|afin de) (?:répondre|réaliser|rédiger|résoudre|calculer)|(?:applique[rz]?|calcule[rz]?|utilise[rz]?|identifie[rz]?|rédige[rz]?|explique[rz]?|conclure|compare[rz]?|définir)\b)/iu;
  const parts = body.split(/\n+|(?<=[.!?])\s+/u)
    .map((part) => part.trim())
    .filter((part) => part && !/^#{1,6}\s/u.test(part))
    .map((part) => part.replace(/^\s*(?:[-*•]|\d+[.)])\s*/u, '').replace(/^[*_]+|[*_]+$/gu, '').trim());
  const meaningful = parts.filter((part) => normalizedWorkText(part).split(' ').length >= 2);
  const futureMethod = /^(?:(?:ensuite|puis|enfin|d['’]abord|premièrement)[,:]?\s*(?:choisir|substituer|rédiger|identifier|calculer|appliquer|utiliser|vérifier|effectuer|donner|expliquer|conclure)\b|(?:cette|la)\s+(?:démarche|méthode)\s+(?:permettra|aidera|devrait|vise à)\b)/iu;
  return meaningful.length > 0 && meaningful.filter((part) => guidance.test(part) || futureMethod.test(part)).length / meaningful.length >= 0.8;
}

function normalizedWorkText(value: string): string {
  return value.normalize('NFKC').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

function requestsProceduralArtifact(instructions: string): boolean {
  const text = instructions.normalize('NFKD').replace(/\p{M}/gu, '').toLocaleLowerCase();
  return /\b(?:redige[rz]?|ecri(?:s|re|vez)|cree[rz]?|produi(?:s|re|sez)|donne[rz]?|fourni(?:s|r|ssez)|prepare[rz]?|write|create|produce|provide|give|draft|prepare)\s+(?:[\p{L}'-]+\s+){0,5}(?:procedure|guide|protocole|protocol|instructions|tutorial|mode\s+d'emploi|methode|method)\b/u.test(text);
}

/** Reject an obvious social non-answer, not content in a different language.
 * No positive lexical overlap or subject-specific answer key is required. */
function isTrivialUnrelatedSocialReply(body: string, instructions: string): boolean {
  if (!/^(?:bonjour|bonsoir|salut|hello|hi|hey|bienvenue|welcome)\b/iu.test(body.trim())) return false;
  if (/\b(?:greeting|salutation|welcome|bienvenue|bonjour|hello|accueil)\b/iu.test(instructions)) return false;
  const parts = body.split(/(?<=[.!?])\s+|\n+/u).map((part) => part.trim()).filter(Boolean);
  const social = /^(?:(?:bonjour|bonsoir|salut|hello|hi|hey|bienvenue|welcome)\b|(?:je|nous|i|we)\b.*(?:heureux|heureuse|ravi|ravie|happy|glad|pleased|delighted|help|accompagner|apprentissage|learn)|(?:tu|vous|you)\b.*(?:revenir|return|come back|souhait|wish|want|question)|n['’]hésitez?\b.*(?:revenir|question))/iu;
  return parts.length > 0 && parts.every((part) => social.test(part));
}

function invalidWorkArtifact(): never {
  throw new ServiceUnavailableException({
    code: 'workspace_autopilot_work_artifact_required',
    message: 'The Professor returned instructions instead of a verified work draft. Your existing work is saved.',
  });
}

function invalidOutput(): never {
  throw new ServiceUnavailableException({ code: 'workspace_autopilot_invalid_result', message: 'The Professor result could not be verified. Your work is saved.' });
}
