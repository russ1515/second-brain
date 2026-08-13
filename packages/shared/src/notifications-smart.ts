/** Smart Notifications (Sprint 5, task 5.6).
 *
 * Notifications become pedagogical — never generic. Each one is assembled from
 * the engines and carries a justification (the data-backed "why"): a short
 * review that would lift a concept's mastery by X%, an exam in N days whose plan
 * was reorganised, or an unlocked next topic. Structured so the app renders the
 * message and its justification in the learner's language. */

export type SmartNotificationKind =
  /** A short review that would raise a concept's mastery. */
  | 'review'
  /** An upcoming exam whose plan was auto-reorganised. */
  | 'exam'
  /** A prerequisite mastered — a new topic can begin. */
  | 'unlock'
  /** A recall drop is coming; act before it's forgotten. */
  | 'forecast';

export interface SmartNotification {
  kind: SmartNotificationKind;
  /** The concept/subject in play. */
  subject?: string;
  /** Minutes for a suggested review. */
  minutes?: number;
  /** A percentage (mastery gain, forgetting threshold). */
  percent?: number;
  /** Days (until an exam / a forecast crossing). */
  days?: number;
  /** The next topic that just became available (unlock). */
  nextSubject?: string;
  /** A route the app can launch to act on it. */
  route?: string;
}

export interface SmartNotificationsView {
  /** The learner's name for the greeting, when known. */
  greetingName: string | null;
  notifications: SmartNotification[];
}
