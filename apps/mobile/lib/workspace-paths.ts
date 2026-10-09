import {
  workspaceDefaultPlan,
  type WorkspaceBriefField,
  type WorkspaceCompletionControlId,
  type WorkspacePlanItem,
  type WorkspaceStepId,
  type WorkspaceTemplate,
} from '@second-brain/shared';
import type { TranslationKey } from './i18n';

type Translate = (key: TranslationKey) => string;

const FIELD_LABELS: Record<WorkspaceBriefField, readonly TranslationKey[]> = {
  subject: ['lib.m.subject'],
  researchQuestion: ['research10.question'],
  hypothesis: ['research10.question', 'workspace10.assist.challenge'],
  methodology: ['workspace10.structure', 'workspace10.research'],
  corpus: ['workspace10.sources'],
  context: ['landing12.story.workspace.context'],
  audience: ['sub.audience.organization'],
  deliverable: ['workspace10.field.objective', 'workspace10.area.work'],
  requirements: ['workspace10.assistantQuestion'],
  evaluationCriteria: ['teacher.exam.rubric'],
  recommendations: ['org.recommendations'],
  publicationTarget: ['sub.audience.organization', 'workspace10.template.article'],
  userInstructions: ['workspace10.assistantQuestion'],
  institutionInstructions: ['profile.card.institution', 'workspace10.assistantQuestion'],
};

const STEP_LABELS: Record<WorkspaceStepId, readonly TranslationKey[]> = {
  'frame-topic': ['landing12.story.workspace.context', 'lib.m.subject'],
  'define-problem': ['research10.question'],
  'review-literature': ['workspace10.research', 'workspace10.sources'],
  'design-method': ['workspace10.structure', 'workspace10.research'],
  'collect-evidence': ['workspace10.sources'],
  'analyze-evidence': ['workspace10.assist.compare-sources'],
  'build-outline': ['workspace10.plan'],
  draft: ['workspace10.area.work'],
  review: ['workspace10.assist.check-coherence'],
  'institution-check': ['profile.card.institution', 'workspace10.assist.check-coherence'],
  defense: ['workspace10.template.tfc', 'workspace10.assist.challenge'],
  'analyze-prompt': ['workspace10.assistantQuestion', 'workspace10.assist.explain'],
  'build-argument': ['workspace10.structure', 'workspace10.assist.challenge'],
  counterargument: ['workspace10.assist.challenge'],
  findings: ['workspace10.area.work', 'workspace10.sources'],
  recommendations: ['org.recommendations'],
  'executive-summary': ['workspace10.template.report', 'workspace10.assist.structure'],
  'target-publication': ['workspace10.template.article', 'sub.audience.organization'],
  'abstract-keywords': ['workspace10.template.article', 'workspace10.assist.structure'],
  'submission-check': ['workspace10.assist.check-coherence'],
  'rubric-check': ['teacher.exam.rubric'],
  protocol: ['workspace10.research', 'workspace10.plan'],
  ethics: ['workspace10.integrity'],
  'define-deliverable': ['workspace10.field.objective', 'workspace10.area.work'],
  deliver: ['workspace10.continue'],
};

const COMPLETION_LABELS: Record<WorkspaceCompletionControlId, readonly TranslationKey[]> = {
  brief: ['workspace10.field.objective', 'workspace10.assistantQuestion'],
  plan: ['workspace10.plan'],
  draft: ['workspace10.area.work'],
  sources: ['workspace10.sources'],
  methodology: ['workspace10.structure', 'workspace10.research'],
  requirements: ['profile.card.institution', 'workspace10.assistantQuestion'],
  submission: ['workspace10.assist.check-coherence'],
};

function joinLabels(keys: readonly TranslationKey[], translate: Translate): string {
  return keys.map(translate).join(' · ');
}

export function workspaceFieldLabel(field: WorkspaceBriefField, translate: Translate): string {
  return joinLabels(FIELD_LABELS[field], translate);
}

export function workspaceCompletionLabel(id: WorkspaceCompletionControlId, translate: Translate): string {
  return joinLabels(COMPLETION_LABELS[id], translate);
}

export function localizedWorkspacePlan(template: WorkspaceTemplate, translate: Translate): WorkspacePlanItem[] {
  return workspaceDefaultPlan(template).map((item) => ({
    ...item,
    title: item.stepId ? joinLabels(STEP_LABELS[item.stepId], translate) : item.title,
  }));
}
