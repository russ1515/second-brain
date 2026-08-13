/** Homework Engine (Sprint 3, task 3.5) wire contracts.
 *
 * After a lesson, the engine generates PERSONALISED homework: a set of exercises
 * and reflective questions calibrated to the learner's Digital Twin
 * (ConceptMastery) and grounded in their Learning Memory. */

import type { LessonExercise } from './lesson';

export interface HomeworkView {
  id: string;
  lessonId: string;
  topic: string;
  conceptId: string | null;
  language: string | null;
  /** The adaptive rationale — what this homework targets and why, written in
   *  the learner's language (e.g. "You're still shaky on X, so we drill it"). */
  focus: string;
  /** Personalised exercises, corrected by the Examiner on submission. */
  exercises: LessonExercise[];
  /** Reflective, open-ended questions to think through (not graded). */
  questions: string[];
  /** The learner's mastery of the concept when this was generated (0..100),
   *  or null when the lesson isn't tied to a tracked concept. Makes the
   *  personalisation auditable rather than a claim. */
  masteryAtGeneration: number | null;
  createdAt: string;
}
