/**
 * AI Mentor (Sprint 9.5).
 *
 * The teacher becomes a mentor: beyond day-to-day tutoring, it steps back and
 * assesses HOW the learner is doing across the things that decide success —
 * academic/university outlook, exam preparation, organization, work method, and
 * confidence. It can be honest and challenging ("you're working hard, but not in
 * the right way") because every judgement is grounded in real signals. A separate
 * engine that composes the twin, the streak and the exams; it invents nothing.
 */

/** The five facets of mentorship the engine assesses. */
export type MentorDimensionKey =
  | 'success'
  | 'exams'
  | 'organization'
  | 'method'
  | 'confidence';

/** How a dimension is doing: good / building / a concern to address. */
export type MentorRating = 'good' | 'building' | 'concern';

/** The mentor's read on one dimension, with the signals behind it. */
export interface MentorDimension {
  key: MentorDimensionKey;
  rating: MentorRating;
  /** The mentor's plain-language guidance for this dimension. */
  insight: string;
  /** The real signals the judgement rests on (traceability + explainability). */
  reasons: string[];
}

/** The mentor's full strategic guidance. */
export interface MentorGuidance {
  /** The mentor's opening line — the one thing worth hearing first. */
  headline: string;
  /** The single dimension to prioritise, or null when all is well. */
  focus: MentorDimensionKey | null;
  dimensions: MentorDimension[];
  generatedAt: string;
}
