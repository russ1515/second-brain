import type { WorkspaceTemplate } from './workspace-persistence';

export const WORKSPACE_ORCHESTRATOR_POLICY_VERSION = 'aw3-deterministic-v1' as const;

export const WORKSPACE_SHELL_KINDS = [
  'assignment',
  'thesis',
  'dissertation',
  'article',
  'report',
  'general',
] as const;

export type WorkspaceShellKind = (typeof WORKSPACE_SHELL_KINDS)[number];

export const WORKSPACE_CLASSIFICATION_REASONS = [
  'explicit-template',
  'assignment-exercises',
  'thesis-research',
  'dissertation-argument',
  'article-scientific',
  'report-structure',
  'general-research',
  'conflicting-signals',
  'insufficient-signals',
] as const;

export type WorkspaceClassificationReason = (typeof WORKSPACE_CLASSIFICATION_REASONS)[number];
export type WorkspaceClassificationConfidence = 'explicit' | 'high' | 'medium' | 'insufficient';

/** Metadata must come from an authenticated, owner-scoped Library response. */
export interface TrustedWorkspaceDocumentEvidence {
  id: string;
  title?: string;
  subject?: string | null;
  summary?: string | null;
  preview?: string;
  content?: string;
}

export interface WorkspaceClassifierInput {
  /** A route or control the learner explicitly selected. Absence is not assignment. */
  explicitTemplate?: WorkspaceTemplate | null;
  title?: string;
  objective?: string;
  capturedText?: string;
  trustedDocuments?: readonly TrustedWorkspaceDocumentEvidence[];
  trustedCollectionNames?: readonly string[];
}

export interface WorkspaceClassificationResult {
  shellKind: WorkspaceShellKind;
  internalTemplate: WorkspaceTemplate;
  confidence: WorkspaceClassificationConfidence;
  reasons: WorkspaceClassificationReason[];
  policyVersion: typeof WORKSPACE_ORCHESTRATOR_POLICY_VERSION;
}

interface Candidate {
  shellKind: Exclude<WorkspaceShellKind, 'general'>;
  internalTemplate: WorkspaceTemplate;
  score: number;
  reasons: WorkspaceClassificationReason[];
}

const MAX_CLASSIFICATION_TEXT = 120_000;
const MINIMUM_DECISIVE_SCORE = 7;

/**
 * Conservative, deterministic routing only. It never calls a provider and
 * returns the adaptive fallback when signals are weak or contradictory.
 */
export function classifyWorkspace(input: WorkspaceClassifierInput): WorkspaceClassificationResult {
  if (input.explicitTemplate) {
    return result(
      workspaceShellFromTemplate(input.explicitTemplate),
      input.explicitTemplate,
      'explicit',
      ['explicit-template'],
    );
  }

  const normalized = normalizedClassifierText(input);
  const candidates = [
    assignmentCandidate(normalized),
    thesisCandidate(normalized),
    dissertationCandidate(normalized),
    articleCandidate(normalized),
    reportCandidate(normalized),
  ].filter((candidate): candidate is Candidate => candidate !== null)
    .sort((left, right) => right.score - left.score);

  const first = candidates[0];
  const second = candidates[1];
  if (first && first.score >= MINIMUM_DECISIVE_SCORE) {
    // A close conflict is intentionally not resolved by arbitrary rule order.
    if (second && second.score >= MINIMUM_DECISIVE_SCORE && first.score - second.score < 2) {
      return result('general', 'other', 'insufficient', ['conflicting-signals']);
    }
    return result(
      first.shellKind,
      first.internalTemplate,
      first.score >= 9 ? 'high' : 'medium',
      first.reasons,
    );
  }

  if (hasAny(normalized, [
    /\bacademic research\b/,
    /\brecherche academique\b/,
    /\bresearch (?:proposal|protocol)\b/,
    /\bprotocole de recherche\b/,
  ])) {
    return result('general', 'academic-research', 'medium', ['general-research']);
  }

  return result('general', 'other', 'insufficient', ['insufficient-signals']);
}

/** Resolve a six-family user choice to one of the historical eight templates. */
export function workspaceTemplateForShell(
  shellKind: WorkspaceShellKind,
  detectedTemplate?: WorkspaceTemplate,
): WorkspaceTemplate {
  switch (shellKind) {
    case 'assignment': return 'assignment';
    case 'thesis': return detectedTemplate === 'tfc' || detectedTemplate === 'memoire' ? detectedTemplate : 'memoire';
    case 'dissertation': return 'dissertation';
    case 'article': return 'article';
    case 'report': return 'report';
    case 'general': return detectedTemplate === 'academic-research' || detectedTemplate === 'other'
      ? detectedTemplate
      : 'other';
  }
}

export function workspaceShellFromTemplate(template: WorkspaceTemplate): WorkspaceShellKind {
  if (template === 'memoire' || template === 'tfc') return 'thesis';
  if (template === 'academic-research' || template === 'other') return 'general';
  return template;
}

function assignmentCandidate(text: string): Candidate | null {
  const direct = hasAny(text, [
    /\bdevoir(?:s)?\b/,
    /\bhomework\b/,
    /\bassignment(?:s)?\b/,
    /\bproblem set\b/,
    /\bserie d[' ]exercices\b/,
  ]);
  const exerciseItems = countMatches(text, /(?:^|\n)\s*(?:exercice|exercise|question|probleme|problem)\s*\d+\b/g);
  const severalQuestions = exerciseItems >= 2 || (hasAny(text, [/\bquestions?\b/]) && countMatches(text, /\?/g) >= 2);
  if (!direct && !severalQuestions) return null;
  return candidate('assignment', 'assignment', direct ? 9 : 7, 'assignment-exercises');
}

function thesisCandidate(text: string): Candidate | null {
  const tfc = hasAny(text, [
    /\btfc\b/,
    /\btravail de fin (?:de cycle|d[' ]etudes?)\b/,
    /\bfinal[- ]year project\b/,
  ]);
  const direct = tfc || hasAny(text, [
    /\bmemoire(?: de recherche| universitaire| de master)?\b/,
    /\bmaster(?:'s)? thesis\b/,
    /\bresearch thesis\b/,
    /\bresearch dissertation\b/,
  ]);
  const avoidsComputerMemory = !hasAny(text, [/\bmemoire (?:vive|ram|informatique)\b/]);
  const structured = hasAny(text, [/\bproblematique\b/, /\bresearch question\b/])
    && hasAny(text, [/\bmethodologie\b/, /\bmethodology\b/])
    && hasAny(text, [/\brecherche\b/, /\bresearch\b/]);
  if ((!direct || !avoidsComputerMemory) && !structured) return null;
  return candidate('thesis', tfc ? 'tfc' : 'memoire', direct && avoidsComputerMemory ? 10 : 7, 'thesis-research');
}

function dissertationCandidate(text: string): Candidate | null {
  const triad = orderedSignals(text, [
    /\bthese\b/,
    /\bantithese\b/,
    /\bsynthese\b/,
  ]) || orderedSignals(text, [
    /\bthesis\b/,
    /\b(?:antithesis|counterargument)\b/,
    /\bsynthesis\b/,
  ]);
  const direct = hasAny(text, [
    /\bessai argumentatif\b/,
    /\bargumentative essay\b/,
    /\bdissertation argumentative\b/,
  ]);
  if (!triad && !direct) return null;
  return candidate('dissertation', 'dissertation', triad ? 10 : 9, 'dissertation-argument');
}

function articleCandidate(text: string): Candidate | null {
  const direct = hasAny(text, [
    /\barticle scientifique\b/,
    /\bscientific article\b/,
    /\bresearch (?:article|paper)\b/,
    /\bimrad\b/,
  ]);
  const sections = countPresent(text, [
    /(?:^|\n)\s*(?:abstract|resume)\b/,
    /(?:^|\n)\s*(?:methodology|methods?|methodologie)\b/,
    /(?:^|\n)\s*(?:results?|resultats?)\b/,
    /(?:^|\n)\s*discussion\b/,
    /(?:^|\n)\s*(?:references|bibliographie|keywords?|mots[- ]cles)\b/,
  ]);
  if (!direct && sections < 3) return null;
  return candidate('article', 'article', direct ? 10 : 8, 'article-scientific');
}

function reportCandidate(text: string): Candidate | null {
  const direct = hasAny(text, [
    /\brapport (?:de stage|de mission|technique)\b/,
    /\b(?:internship|mission|technical) report\b/,
  ]);
  const reportLabel = hasAny(text, [/\brapport\b/, /\breport\b/]);
  const sections = countPresent(text, [
    /(?:^|\n)\s*(?:activites?|activities)\b/,
    /(?:^|\n)\s*(?:resultats?|results?|findings)\b/,
    /(?:^|\n)\s*(?:recommandations?|recommendations?)\b/,
  ]);
  if (!direct && !(reportLabel && sections >= 2)) return null;
  return candidate('report', 'report', direct ? 10 : 8, 'report-structure');
}

function normalizedClassifierText(input: WorkspaceClassifierInput): string {
  const documents = input.trustedDocuments ?? [];
  const values = [
    input.title,
    input.objective,
    input.capturedText,
    ...documents.flatMap((document) => [
      document.title,
      document.subject,
      document.summary,
      document.preview,
      document.content,
    ]),
    ...(input.trustedCollectionNames ?? []),
  ];
  return normalizeText(values.filter((value): value is string => typeof value === 'string').join('\n'))
    .slice(0, MAX_CLASSIFICATION_TEXT);
}

function normalizeText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’‘`]/g, "'")
    .replace(/\r\n?/g, '\n')
    .toLowerCase();
}

function candidate(
  shellKind: Candidate['shellKind'],
  internalTemplate: WorkspaceTemplate,
  score: number,
  reason: WorkspaceClassificationReason,
): Candidate {
  return { shellKind, internalTemplate, score, reasons: [reason] };
}

function result(
  shellKind: WorkspaceShellKind,
  internalTemplate: WorkspaceTemplate,
  confidence: WorkspaceClassificationConfidence,
  reasons: WorkspaceClassificationReason[],
): WorkspaceClassificationResult {
  return {
    shellKind,
    internalTemplate,
    confidence,
    reasons,
    policyVersion: WORKSPACE_ORCHESTRATOR_POLICY_VERSION,
  };
}

function hasAny(value: string, patterns: readonly RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(value));
}

function countPresent(value: string, patterns: readonly RegExp[]): number {
  return patterns.reduce((total, pattern) => total + (pattern.test(value) ? 1 : 0), 0);
}

function countMatches(value: string, pattern: RegExp): number {
  return value.match(pattern)?.length ?? 0;
}

function orderedSignals(value: string, patterns: readonly RegExp[]): boolean {
  let cursor = 0;
  for (const pattern of patterns) {
    const match = value.slice(cursor).match(pattern);
    if (!match?.index && match?.index !== 0) return false;
    cursor += match.index + match[0].length;
  }
  return true;
}
