import type { LearningCategory } from '@second-brain/shared';

/**
 * Home personalisation from the KYC category (UI/UX Sprint 3, task 3.20).
 *
 * Same Home, but contextual: the category the learner picked during onboarding
 * (Sprint 2) tunes which real sections are emphasised and which capture entry
 * leads. It only REORDERS / emphasises existing real blocks — it never invents
 * data or adds a section. A missing category falls back to the neutral profile.
 */
export interface HomePersona {
  /** How prominent the exams block is. Academics live by exams; a young learner
   *  or a pure language learner should not be greeted by an exam countdown. */
  exams: 'high' | 'normal' | 'hidden';
  /** Which universal-input entry to surface first. */
  primaryCapture: 'write' | 'speak' | 'scan' | 'import';
  /** Simplified, more visual layout for the youngest learners. */
  simplified: boolean;
  /** Whether the mastery snapshot is worth showing prominently. */
  showMastery: boolean;
}

export function homePersona(category?: LearningCategory | null): HomePersona {
  switch (category) {
    case 'kindergarten':
    case 'primary':
      return { exams: 'hidden', primaryCapture: 'speak', simplified: true, showMastery: true };
    case 'secondary':
    case 'highschool':
      return { exams: 'high', primaryCapture: 'scan', simplified: false, showMastery: true };
    case 'university':
      return { exams: 'high', primaryCapture: 'scan', simplified: false, showMastery: true };
    case 'research':
      return { exams: 'normal', primaryCapture: 'import', simplified: false, showMastery: true };
    case 'language':
      return { exams: 'hidden', primaryCapture: 'speak', simplified: false, showMastery: true };
    case 'professional':
    case 'personal':
      return { exams: 'normal', primaryCapture: 'write', simplified: false, showMastery: true };
    default:
      return { exams: 'normal', primaryCapture: 'write', simplified: false, showMastery: true };
  }
}
