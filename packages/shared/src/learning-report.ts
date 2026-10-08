import type {
  LearnerPassportDeclared,
  LearnerPassportLearningDna,
} from './learner-passport';
import type { LearnerProfile } from './learner-profile';
import type { EvidenceBasedLearningProgress, LearningHistoryView } from './learning-evidence';

/**
 * A privacy-minimised learning report. It deliberately separates what the
 * learner declared, what Second Brain observed, and what an assessment
 * actually measured. Raw conversations, source documents, secrets and billing
 * data never belong in this view.
 */
export interface LearningReportView {
  generatedAt: string;
  locale: string;
  /** Friendly account name only; the email address is deliberately excluded. */
  learnerName: string | null;
  declared: {
    source: 'DECLARED';
    profile: LearnerPassportDeclared;
  };
  observed: {
    source: 'OBSERVED';
    learnerProfile: LearnerProfile | null;
    learningDna: LearnerPassportLearningDna | null;
    totals: {
      lessons: number;
      tutorSessions: number;
      concepts: number;
      completedStudySessions: number;
      reviews: number;
    };
    lastLearningActivityAt: string | null;
  };
  assessed: {
    source: 'ASSESSED';
    assessmentSubmissions: number;
    averageAssessmentScore: number | null;
    exerciseAttempts: number;
    correctExerciseAttempts: number;
    averageExerciseScore: number | null;
    evidenceProgress: EvidenceBasedLearningProgress;
    completionHistory: LearningHistoryView;
    /** Honest when no official or scored evidence exists. */
    evidenceAvailable: boolean;
  };
  exclusions: readonly [
    'RAW_CONVERSATIONS',
    'FULL_DOCUMENTS',
    'AUTH_SECRETS',
    'FINANCIAL_DETAILS',
  ];
}
