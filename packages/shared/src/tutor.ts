/** Adaptive tutoring (Phase 5) wire contracts. */

import type { Citation } from './document';
import type { ContextItemInput } from './context';
import type { ExperienceSession, InputModality } from './experience-session';

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
  /** Conservative presentation blocks derived from explicit Markdown sections.
   *  The original content remains the source of truth. */
  blocks: TutorMessageBlock[];
}

export const TUTOR_MESSAGE_BLOCK_KINDS = [
  'TEXT',
  'TEACHING_BLOCK',
  'EXAMPLE',
  'QUESTION',
  'EXERCISE',
  'QUIZ',
  'SUMMARY',
  'SOURCE',
  'ACTION',
  'PROGRESS',
] as const;

export type TutorMessageBlockKind = (typeof TUTOR_MESSAGE_BLOCK_KINDS)[number];

export interface TutorMessageBlock {
  kind: TutorMessageBlockKind;
  content: string;
  title?: string;
  citation?: Citation;
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
  /** Stable localization key for clients that should not display the legacy
   *  English reason in another interface language. */
  strategyReasonCode: string | null;
  messageCount: number;
  /** Present on the Lot 6 API. Optional keeps older consumers compatible. */
  experienceSession?: ExperienceSession | null;
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
  /** Learner-facing objective, kept separately from the compact title. */
  objective?: string;
  /** Product intention such as understand, learn, practice or free. */
  intent?: string;
  /** Existing pedagogical mode requested by the entry experience. */
  mode?: string;
  inputModality?: InputModality;
  activeContexts?: ContextItemInput[];
  documentId?: string;
  goalId?: string;
  languageProfileId?: string;
}

/** How fast the learner wants the teacher to go this turn (Task 3.3). */
export type TutorPace = 'slower' | 'faster';

export interface SendTutorMessageRequest {
  content: string;
  /** Ask the teacher to slow down or speed up for this reply. */
  pace?: TutorPace;
  /** Marks an already-transcribed microphone turn without uploading the audio twice. */
  viaVoice?: boolean;
}

/** The assistant's reply to a learner message. */
export interface SendTutorMessageResponse {
  message: TutorMessageView;
}

/**
 * Turn explicit Markdown sections into stable presentation blocks without
 * asking another model or guessing hidden pedagogy. Unlabelled prose remains
 * TEXT; citations are appended as SOURCE blocks.
 */
export function parseTutorMessageBlocks(
  content: string,
  citations: readonly Citation[] = [],
): TutorMessageBlock[] {
  const sections = splitMarkdownSections(content.trim());
  const blocks: TutorMessageBlock[] = sections
    .filter((section) => section.content.length > 0)
    .map((section) => ({
      kind: section.title ? classifyHeading(section.title) : 'TEXT',
      content: section.content,
      ...(section.title ? { title: section.title } : {}),
    }));

  for (const citation of citations) {
    blocks.push({
      kind: 'SOURCE',
      title: citation.documentTitle,
      content: citation.content?.trim() || citation.documentTitle,
      citation,
    });
  }
  return blocks.length > 0 ? blocks : [{ kind: 'TEXT', content: '' }];
}

function splitMarkdownSections(content: string): Array<{ title?: string; content: string }> {
  if (!content) return [];
  const lines = content.split(/\r?\n/);
  const sections: Array<{ title?: string; content: string }> = [];
  let title: string | undefined;
  let body: string[] = [];
  const flush = () => {
    const text = body.join('\n').trim();
    if (text) sections.push({ ...(title ? { title } : {}), content: text });
    body = [];
  };
  for (const line of lines) {
    const heading = /^#{1,3}\s+(.+?)\s*$/.exec(line);
    if (!heading) {
      body.push(line);
      continue;
    }
    flush();
    title = heading[1].trim();
  }
  flush();
  return sections;
}

function classifyHeading(raw: string): TutorMessageBlockKind {
  const heading = raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (/exemple|example|analogie|analogy/.test(heading)) return 'EXAMPLE';
  if (/question|comprehension|check/.test(heading)) return 'QUESTION';
  if (/exercice|exercise|pratique|practice/.test(heading)) return 'EXERCISE';
  if (/quiz|qcm|mcq/.test(heading)) return 'QUIZ';
  if (/resume|summary|a retenir|key points/.test(heading)) return 'SUMMARY';
  if (/source|reference|citation/.test(heading)) return 'SOURCE';
  if (/prochaine etape|next step|action|continue/.test(heading)) return 'ACTION';
  if (/progress|progression|avancee/.test(heading)) return 'PROGRESS';
  if (/explication|explanation|lecon|lesson|concept/.test(heading)) return 'TEACHING_BLOCK';
  return 'TEXT';
}
