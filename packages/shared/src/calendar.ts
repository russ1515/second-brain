/** Smart Calendar (Sprint 5, task 5.4).
 *
 * Not a classic agenda: it is generated automatically from everything the
 * engines have scheduled — exams, homework, practicals, languages, AI sessions,
 * revisions and objectives. The learner may add or remove their OWN entries
 * (exams, objectives…), but the AI-generated ones stay: the AI has priority. */

export type CalendarEntryKind =
  | 'exam'
  | 'homework'
  | 'practical'
  | 'language'
  | 'aiSession'
  | 'revision'
  | 'quiz'
  | 'objective'
  | 'deadline';

/** A user-editable event kind (the subset the learner can create). */
export type UserEventKind = 'exam' | 'objective' | 'deadline';

export interface CalendarEntry {
  id: string;
  kind: CalendarEntryKind;
  title: string;
  /** 'ai' = auto-generated (priority, read-only); 'user' = the learner's own. */
  source: 'ai' | 'user';
  /** True only for the learner's own entries. */
  editable: boolean;
}

export interface CalendarDay {
  /** YYYY-MM-DD. */
  date: string;
  /** True when this is today. */
  today: boolean;
  entries: CalendarEntry[];
}

export interface CalendarView {
  days: CalendarDay[];
}

export interface CreateCalendarEventRequest {
  /** YYYY-MM-DD. */
  date: string;
  kind: UserEventKind;
  title: string;
}
