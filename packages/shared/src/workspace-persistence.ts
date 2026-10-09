import type { ActionDestination } from './next-best-action';
import type { WorkspaceMessage, WorkspaceMode } from './document';
import type { ExperienceContext } from './context';

/** Target persistence contract. Lot 0 does not add a workspace database model. */
export type WorkspaceProjectStatus = 'active' | 'paused' | 'completed' | 'archived';

export const WORKSPACE_TEMPLATES = [
  'memoire',
  'tfc',
  'dissertation',
  'report',
  'article',
  'assignment',
  'academic-research',
  'other',
] as const;
export type WorkspaceTemplate = (typeof WORKSPACE_TEMPLATES)[number];

export const WORKSPACE_BRIEF_FIELDS = [
  'subject',
  'researchQuestion',
  'hypothesis',
  'methodology',
  'corpus',
  'context',
  'audience',
  'deliverable',
  'requirements',
  'evaluationCriteria',
  'recommendations',
  'publicationTarget',
  'userInstructions',
  'institutionInstructions',
] as const;
export type WorkspaceBriefField = (typeof WORKSPACE_BRIEF_FIELDS)[number];

export interface WorkspaceBrief {
  version: 1;
  fields: Partial<Record<WorkspaceBriefField, string>>;
}

export const WORKSPACE_STEP_IDS = [
  'frame-topic',
  'define-problem',
  'review-literature',
  'design-method',
  'collect-evidence',
  'analyze-evidence',
  'build-outline',
  'draft',
  'review',
  'institution-check',
  'defense',
  'analyze-prompt',
  'build-argument',
  'counterargument',
  'findings',
  'recommendations',
  'executive-summary',
  'target-publication',
  'abstract-keywords',
  'submission-check',
  'rubric-check',
  'protocol',
  'ethics',
  'define-deliverable',
  'deliver',
] as const;
export type WorkspaceStepId = (typeof WORKSPACE_STEP_IDS)[number];

export const WORKSPACE_COMPLETION_CONTROL_IDS = [
  'brief',
  'plan',
  'draft',
  'sources',
  'methodology',
  'requirements',
  'submission',
] as const;
export type WorkspaceCompletionControlId = (typeof WORKSPACE_COMPLETION_CONTROL_IDS)[number];

export interface WorkspaceTemplateDefinition {
  fields: readonly WorkspaceBriefField[];
  requiredFields: readonly WorkspaceBriefField[];
  steps: readonly WorkspaceStepId[];
  completionControls: readonly WorkspaceCompletionControlId[];
  /** Internal server-side direction. User and institution instructions always override this scaffold. */
  assistantDirective: string;
}

export const WORKSPACE_TEMPLATE_DEFINITIONS: Record<WorkspaceTemplate, WorkspaceTemplateDefinition> = {
  memoire: {
    fields: ['subject', 'researchQuestion', 'hypothesis', 'methodology', 'corpus', 'userInstructions', 'institutionInstructions'],
    requiredFields: ['subject', 'researchQuestion'],
    steps: ['frame-topic', 'define-problem', 'review-literature', 'design-method', 'collect-evidence', 'analyze-evidence', 'draft', 'institution-check', 'submission-check'],
    completionControls: ['brief', 'plan', 'draft', 'sources', 'methodology', 'requirements', 'submission'],
    assistantDirective: 'Support a long-form thesis workflow: problem framing, literature, methodology, evidence, analysis, institutional compliance and final review.',
  },
  tfc: {
    fields: ['subject', 'researchQuestion', 'methodology', 'deliverable', 'evaluationCriteria', 'userInstructions', 'institutionInstructions'],
    requiredFields: ['subject', 'deliverable'],
    steps: ['frame-topic', 'define-problem', 'design-method', 'define-deliverable', 'collect-evidence', 'analyze-evidence', 'draft', 'institution-check', 'defense'],
    completionControls: ['brief', 'plan', 'draft', 'sources', 'methodology', 'requirements', 'submission'],
    assistantDirective: 'Support a final-year project workflow: scoped problem, concrete deliverable, method, implementation or field work, results, report and defense readiness.',
  },
  dissertation: {
    fields: ['subject', 'researchQuestion', 'hypothesis', 'evaluationCriteria', 'userInstructions', 'institutionInstructions'],
    requiredFields: ['subject', 'researchQuestion'],
    steps: ['analyze-prompt', 'define-problem', 'build-outline', 'build-argument', 'counterargument', 'draft', 'rubric-check', 'review'],
    completionControls: ['brief', 'plan', 'draft', 'sources', 'requirements', 'submission'],
    assistantDirective: 'Support a dissertation workflow: analyze the prompt, formulate a defensible thesis, structure arguments and counterarguments, then review against the rubric.',
  },
  report: {
    fields: ['context', 'deliverable', 'audience', 'methodology', 'recommendations', 'userInstructions', 'institutionInstructions'],
    requiredFields: ['context', 'deliverable'],
    steps: ['frame-topic', 'collect-evidence', 'findings', 'analyze-evidence', 'recommendations', 'executive-summary', 'draft', 'review'],
    completionControls: ['brief', 'plan', 'draft', 'sources', 'requirements', 'submission'],
    assistantDirective: 'Support a report workflow: context and scope, reliable evidence, findings, analysis, actionable recommendations, executive summary and delivery checks.',
  },
  article: {
    fields: ['subject', 'researchQuestion', 'methodology', 'audience', 'publicationTarget', 'userInstructions', 'institutionInstructions'],
    requiredFields: ['subject', 'researchQuestion'],
    steps: ['target-publication', 'define-problem', 'review-literature', 'design-method', 'findings', 'analyze-evidence', 'abstract-keywords', 'submission-check'],
    completionControls: ['brief', 'plan', 'draft', 'sources', 'methodology', 'requirements', 'submission'],
    assistantDirective: 'Support an academic article workflow: audience or venue, research question, literature, method, results, discussion, abstract, keywords and submission checks.',
  },
  assignment: {
    fields: ['subject', 'deliverable', 'requirements', 'evaluationCriteria', 'userInstructions', 'institutionInstructions'],
    requiredFields: ['subject', 'requirements'],
    steps: ['analyze-prompt', 'rubric-check', 'collect-evidence', 'build-outline', 'draft', 'review', 'submission-check'],
    completionControls: ['brief', 'plan', 'draft', 'sources', 'requirements', 'submission'],
    assistantDirective: 'Support an assignment workflow: interpret the instructions and rubric, gather evidence, outline, draft, cite, review and submit.',
  },
  'academic-research': {
    fields: ['subject', 'researchQuestion', 'hypothesis', 'methodology', 'corpus', 'userInstructions', 'institutionInstructions'],
    requiredFields: ['subject', 'researchQuestion'],
    steps: ['define-problem', 'protocol', 'review-literature', 'collect-evidence', 'analyze-evidence', 'findings', 'ethics', 'deliver'],
    completionControls: ['brief', 'plan', 'draft', 'sources', 'methodology', 'requirements', 'submission'],
    assistantDirective: 'Support an academic research workflow: question or hypothesis, protocol, literature, corpus or data, analysis, synthesis, ethics and reproducible outputs.',
  },
  other: {
    fields: ['subject', 'context', 'deliverable', 'requirements', 'userInstructions', 'institutionInstructions'],
    requiredFields: ['deliverable'],
    steps: ['define-deliverable', 'analyze-prompt', 'build-outline', 'collect-evidence', 'draft', 'review', 'deliver'],
    completionControls: ['brief', 'plan', 'draft', 'sources', 'requirements', 'submission'],
    assistantDirective: 'Support the learner-defined deliverable and constraints with a flexible plan, sources, production, review and delivery workflow.',
  },
};

export const WORKSPACE_STEP_FALLBACK_TITLES: Record<WorkspaceStepId, string> = {
  'frame-topic': 'Frame the topic and scope',
  'define-problem': 'Define the problem or research question',
  'review-literature': 'Review the literature and sources',
  'design-method': 'Define the methodology',
  'collect-evidence': 'Gather sources, data or evidence',
  'analyze-evidence': 'Analyze the evidence',
  'build-outline': 'Build the detailed outline',
  draft: 'Draft the work',
  review: 'Review coherence and accuracy',
  'institution-check': 'Check institutional instructions',
  defense: 'Prepare the defense',
  'analyze-prompt': 'Analyze the instructions',
  'build-argument': 'Build the argument',
  counterargument: 'Address counterarguments',
  findings: 'Present the findings',
  recommendations: 'Formulate recommendations',
  'executive-summary': 'Write the executive summary',
  'target-publication': 'Define the audience or publication target',
  'abstract-keywords': 'Prepare the abstract and keywords',
  'submission-check': 'Complete the delivery checks',
  'rubric-check': 'Check the evaluation rubric',
  protocol: 'Define the research protocol',
  ethics: 'Check ethics and reproducibility',
  'define-deliverable': 'Define the expected deliverable',
  deliver: 'Prepare the final delivery',
};

export interface WorkspaceCitationReference {
  id: string;
  title: string;
  kind: 'document' | 'brain' | 'external' | 'web';
  documentId?: string;
  url?: string;
  domain?: string;
  provider?: string;
  publishedAt?: string | null;
  retrievedAt?: string;
  quality?: string;
  excerpt?: string | null;
}

export interface WorkspaceSourceReference {
  kind: 'document' | 'collection' | 'research-source';
  id: string;
  title?: string;
  /** Research transfer snapshot. Provenance remains usable if the source changes. */
  question?: string;
  synthesis?: string;
  citations?: WorkspaceCitationReference[];
}

export interface WorkspacePlanItem {
  id: string;
  title: string;
  order: number;
  completed: boolean;
  stepId?: WorkspaceStepId;
}

export interface WorkspaceDraft {
  format: 'markdown' | 'plain-text' | 'structured';
  content: string;
  revision: number;
  updatedAt: string;
}

export interface WorkspaceProgress {
  currentStep?: string;
  completedSteps: string[];
  totalSteps?: number;
  workflow?: {
    version: 1;
    brief: WorkspaceBrief;
  };
}

export interface WorkspaceCompletionCheck {
  id: WorkspaceCompletionControlId;
  passed: boolean;
  required: boolean;
}

export interface WorkspaceAssistantHistoryEntry extends WorkspaceMessage {
  id: string;
  createdAt: string;
}

export interface PersistentWorkspace {
  id: string;
  userId: string;
  title: string;
  template: WorkspaceTemplate;
  objective: string;
  dueAt: string | null;
  status: WorkspaceProjectStatus;
  mode: WorkspaceMode;
  context: ExperienceContext;
  sources: WorkspaceSourceReference[];
  plan: WorkspacePlanItem[];
  draft: WorkspaceDraft;
  assistantHistory: WorkspaceAssistantHistoryEntry[];
  brief: WorkspaceBrief;
  completionChecks: WorkspaceCompletionCheck[];
  progress: WorkspaceProgress;
  autosaveRevision: number;
  experienceSessionId: string | null;
  resumeTarget: ActionDestination;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceSummary {
  id: string;
  title: string;
  template: WorkspaceTemplate;
  status: WorkspaceProjectStatus;
  sourceCount: number;
  completedSteps: number;
  totalSteps: number;
  updatedAt: string;
  resumeTarget: ActionDestination;
}

export interface WorkspacePage {
  items: WorkspaceSummary[];
  nextCursor: string | null;
}

export interface CreateWorkspaceRequest {
  title: string;
  template: WorkspaceTemplate;
  objective: string;
  dueAt?: string;
  sources?: WorkspaceSourceReference[];
  plan?: WorkspacePlanItem[];
  brief?: WorkspaceBrief;
  initialContent?: string;
}

export interface UpdateWorkspaceRequest {
  title?: string;
  objective?: string;
  dueAt?: string | null;
  status?: WorkspaceProjectStatus;
  mode?: WorkspaceMode;
  sources?: WorkspaceSourceReference[];
  plan?: WorkspacePlanItem[];
  brief?: WorkspaceBrief;
  progress?: WorkspaceProgress;
}

export interface WorkspaceAutosaveRequest {
  workspaceId: string;
  /** Optimistic concurrency token; stale writes must be rejected. */
  expectedRevision: number;
  draft: Omit<WorkspaceDraft, 'revision' | 'updatedAt'>;
}

export interface WorkspaceAutosaveResult {
  saved: boolean;
  revision: number;
  updatedAt: string;
}

export const WORKSPACE_ASSIST_ACTIONS = [
  'explain',
  'challenge',
  'suggest',
  'structure',
  'compare-sources',
  'check-coherence',
  'rephrase',
] as const;
export type WorkspaceAssistAction = (typeof WORKSPACE_ASSIST_ACTIONS)[number];

export interface PersistentWorkspaceAssistRequest {
  action: WorkspaceAssistAction;
  message?: string;
  selectedText?: string;
}

export interface PersistentWorkspaceAssistResponse {
  reply: WorkspaceAssistantHistoryEntry;
}

export type WorkspaceSaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error' | 'offline';

/** A progress percentage is legitimate only when it comes from real plan items. */
export function workspaceProgressFromPlan(
  plan: readonly WorkspacePlanItem[],
  workflow?: WorkspaceProgress['workflow'],
): WorkspaceProgress {
  return {
    currentStep: plan.find((item) => !item.completed)?.id,
    completedSteps: plan.filter((item) => item.completed).map((item) => item.id),
    totalSteps: plan.length,
    ...(workflow ? { workflow } : {}),
  };
}

export function emptyWorkspaceBrief(): WorkspaceBrief {
  return { version: 1, fields: {} };
}

export function workspaceDefaultPlan(template: WorkspaceTemplate): WorkspacePlanItem[] {
  return WORKSPACE_TEMPLATE_DEFINITIONS[template].steps.map((stepId, order) => ({
    id: `template:${stepId}`,
    stepId,
    title: WORKSPACE_STEP_FALLBACK_TITLES[stepId],
    order,
    completed: false,
  }));
}

export function workspaceCompletionChecks(input: {
  template: WorkspaceTemplate;
  brief: WorkspaceBrief;
  plan: readonly WorkspacePlanItem[];
  sources: readonly WorkspaceSourceReference[];
  draftContent: string;
}): WorkspaceCompletionCheck[] {
  const definition = WORKSPACE_TEMPLATE_DEFINITIONS[input.template];
  const fields = input.brief.fields;
  const requiredBriefReady = definition.requiredFields.every((field) => Boolean(fields[field]?.trim()));
  const methodReady = !definition.fields.includes('methodology') || Boolean(fields.methodology?.trim());
  const requirementsReady = Boolean(
    fields.userInstructions?.trim()
    || fields.institutionInstructions?.trim()
    || fields.requirements?.trim()
    || fields.evaluationCriteria?.trim(),
  );
  const passed: Record<WorkspaceCompletionControlId, boolean> = {
    brief: requiredBriefReady,
    plan: input.plan.length > 0 && input.plan.every((item) => item.completed),
    draft: input.draftContent.trim().length > 0,
    sources: input.sources.length > 0,
    methodology: methodReady,
    requirements: requirementsReady,
    submission: input.plan.length > 0
      && input.plan[input.plan.length - 1]!.completed
      && input.draftContent.trim().length > 0,
  };
  return definition.completionControls.map((id) => ({
    id,
    passed: passed[id],
    required: id !== 'sources' && id !== 'requirements',
  }));
}
