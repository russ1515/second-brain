/** Writing coach (Sprint 7.7): the teacher accompanies written productions —
 *  essays, dissertations, theses, reports, minutes, homework — and analyses them
 *  across seven dimensions, then explains precisely how to improve. General /
 *  academic writing in the learner's own language (distinct from the language-
 *  learning essay corrector, which corrects a TARGET language). */

export type WritingType =
  | 'redaction'
  | 'dissertation'
  | 'memoire'
  | 'rapport'
  | 'compte_rendu'
  | 'devoir';

export const WRITING_TYPES: readonly WritingType[] = [
  'redaction',
  'dissertation',
  'memoire',
  'rapport',
  'compte_rendu',
  'devoir',
] as const;

/** The seven things the coach analyses. Named to the spec. */
export type WritingDimensionKind =
  | 'structure'
  | 'logic'
  | 'clarity'
  | 'spelling'
  | 'grammar'
  | 'argumentation'
  | 'academic_quality';

export const WRITING_DIMENSIONS: readonly WritingDimensionKind[] = [
  'structure',
  'logic',
  'clarity',
  'spelling',
  'grammar',
  'argumentation',
  'academic_quality',
] as const;

export type WritingRating = 'good' | 'fair' | 'needs_work';

export interface WritingDimension {
  kind: WritingDimensionKind;
  rating: WritingRating;
  /** What the coach observed on this dimension, grounded in the text. */
  observation: string;
  /** Precisely how to improve it — concrete, actionable. */
  howToImprove: string;
}

export interface WritingReview {
  /** 0..100 overall academic quality. */
  score: number;
  /** Honest, encouraging overall read. */
  summary: string;
  /** What already works — improvement is never only about faults. */
  strengths: string[];
  dimensions: WritingDimension[];
  /** The most important fixes, in the order to tackle them. */
  priorities: string[];
}

export interface ReviewWritingRequest {
  type: WritingType;
  /** The learner's text. */
  text: string;
  title?: string;
  /** Optional brief/prompt the writing was meant to answer. */
  instructions?: string;
}

export interface WritingSubmissionView {
  id: string;
  type: WritingType;
  title: string | null;
  text: string;
  score: number;
  review: WritingReview;
  createdAt: string;
}

export interface WritingSubmissionSummary {
  id: string;
  type: WritingType;
  title: string | null;
  score: number;
  createdAt: string;
}
