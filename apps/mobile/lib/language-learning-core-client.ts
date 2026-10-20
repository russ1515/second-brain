import type {
  AssessmentSubmissionView,
  AssessmentView,
  LanguageLearningCoreView,
  LessonView,
} from '@second-brain/shared';
import { api } from './client';

/** Same server projection is used by the course and Passport. No client score
 * or local completion flag is ever sent as a mastery decision. */
export interface LanguageLearningSessionView {
  core: LanguageLearningCoreView;
  sessionId: string | null;
  content: LessonView | null;
  assessment: AssessmentView | null;
  answers: string[];
  latestSubmission: AssessmentSubmissionView | null;
  activeScope: 'lesson' | 'module' | 'level' | null;
  activeTargetId: string | null;
  remediation: boolean;
  phase?: 'teaching' | 'assessment' | 'result';
  teachingStep?: number;
  supportLanguage?: string;
  supportLanguageCode?: string;
  targetLanguage?: string;
}

const endpoint = (profileId: string, suffix = '') =>
  `/languages/${encodeURIComponent(profileId)}/learning-core${suffix}`;
const lessonEndpoint = (profileId: string, lessonId: string, suffix: string) =>
  endpoint(profileId, `/lessons/${encodeURIComponent(lessonId)}/${suffix}`);

export function loadLanguageLearningCore(profileId: string): Promise<LanguageLearningSessionView> {
  return api(endpoint(profileId));
}

export function startLanguageLearningLesson(profileId: string, lessonId: string, idempotencyKey: string): Promise<LanguageLearningSessionView> {
  return api(lessonEndpoint(profileId, lessonId, 'start'), { method: 'POST', body: { idempotencyKey } });
}

export function saveLanguageLearningAnswers(profileId: string, lessonId: string, answers: string[], phase: 'teaching' | 'assessment' = 'assessment', teachingStep?: number): Promise<LanguageLearningSessionView> {
  return api(lessonEndpoint(profileId, lessonId, 'answers'), { method: 'POST', body: { answers, phase, ...(teachingStep == null ? {} : { teachingStep }) } });
}

export function submitLanguageLearningLesson(profileId: string, lessonId: string, answers: string[], idempotencyKey: string): Promise<LanguageLearningSessionView> {
  return api(lessonEndpoint(profileId, lessonId, 'submit'), { method: 'POST', body: { answers, idempotencyKey } });
}

export function startLanguageLearningRemediation(profileId: string, lessonId: string, idempotencyKey: string): Promise<LanguageLearningSessionView> {
  return api(lessonEndpoint(profileId, lessonId, 'remediation'), { method: 'POST', body: { idempotencyKey } });
}

export function askLanguageLearningHelp(profileId: string, lessonId: string, message: string, idempotencyKey: string): Promise<{ answer: string }> {
  return api(lessonEndpoint(profileId, lessonId, 'help'), { method: 'POST', body: { message, idempotencyKey } });
}

export function startLanguageLearningAssessment(profileId: string, scope: 'module' | 'level', targetId: string, idempotencyKey: string): Promise<LanguageLearningSessionView> {
  return api(endpoint(profileId, '/assessments/start'), { method: 'POST', body: { scope, targetId, idempotencyKey } });
}

export function submitLanguageLearningAssessment(profileId: string, targetId: string, answers: string[], idempotencyKey: string): Promise<LanguageLearningSessionView> {
  return api(endpoint(profileId, `/assessments/${encodeURIComponent(targetId)}/submit`), { method: 'POST', body: { answers, idempotencyKey } });
}

export function saveLanguageLearningAssessmentAnswers(profileId: string, targetId: string, answers: string[]): Promise<LanguageLearningSessionView> {
  return api(endpoint(profileId, `/assessments/${encodeURIComponent(targetId)}/answers`), { method: 'POST', body: { answers, phase: 'assessment' } });
}

export function startNextLanguageLearningLevel(profileId: string, idempotencyKey: string): Promise<LanguageLearningSessionView> {
  return api(endpoint(profileId, '/levels/next'), { method: 'POST', body: { idempotencyKey } });
}
