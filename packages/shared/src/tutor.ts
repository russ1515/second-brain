/** Adaptive tutoring (Phase 5) wire contracts. */

import type { Citation } from './document';

export type TutorRole = 'user' | 'assistant';

/** The specialist hat the same teacher automatically wears for a subject
 *  (task 3.6). Academic subjects → subject teacher; a language → that
 *  language's teacher; nothing detected yet → the general teacher. */
export interface TeacherRole {
  kind: 'language' | 'academic' | 'general';
  /** The subject or language name (e.g. "Biology", "English"); null if general. */
  subject: string | null;
  /** Canonical language name when kind === 'language', else null. */
  language: string | null;
  /** A small icon for the role (flag for languages, subject glyph otherwise). */
  emoji: string;
}

/** Teaching Strategy Engine (Sprint 7.9, ITE): the pedagogical approaches the
 *  engine can select and blend for a session. */
export type TeachingStrategy =
  | 'socratic'
  | 'project_based'
  | 'problem_solving'
  | 'case_study'
  | 'task_based'
  | 'guided_demonstration'
  | 'active_learning'
  | 'experiential';

export const TEACHING_STRATEGIES: readonly TeachingStrategy[] = [
  'socratic',
  'project_based',
  'problem_solving',
  'case_study',
  'task_based',
  'guided_demonstration',
  'active_learning',
  'experiential',
] as const;

export interface TutorMessageView {
  id: string;
  role: TutorRole;
  content: string;
  /** Source passages the assistant grounded this reply in (assistant only). */
  citations?: Citation[];
  /** True when this turn came from a spoken interaction rather than typing. */
  viaVoice: boolean;
  createdAt: string;
}

export interface TutorSessionSummary {
  id: string;
  title: string | null;
  /** Concept this session is steering, if twin-focused. */
  focusConceptId: string | null;
  focusConceptName: string | null;
  /** The subject this session is about, once detected (task 3.6). */
  subject: string | null;
  /** The teacher role automatically selected from that subject. */
  role: TeacherRole;
  /** The teaching strategy the ITE engine selected (7.9); null until the first
   *  turn picks one. */
  strategy: TeachingStrategy | null;
  /** Why that strategy was chosen (learner-facing); null until selected. */
  strategyReason: string | null;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface TutorSessionDetail extends TutorSessionSummary {
  messages: TutorMessageView[];
}

export interface CreateTutorSessionRequest {
  title?: string;
  /** Focus the session on one of the learner's concepts. */
  focusConceptId?: string;
}

/** How fast the learner wants the teacher to go this turn (Task 3.3). */
export type TutorPace = 'slower' | 'faster';

export interface SendTutorMessageRequest {
  content: string;
  /** Ask the teacher to slow down or speed up for this reply. */
  pace?: TutorPace;
}

/** The assistant's reply to a learner message. */
export interface SendTutorMessageResponse {
  message: TutorMessageView;
}
