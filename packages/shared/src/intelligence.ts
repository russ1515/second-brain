/** Advanced Intelligence (Sprint 9). The proactive mentor layer: the AI observes
 *  the learner and takes initiatives, always explaining why. */

export type InitiativeKind =
  | 'advance'
  | 'slow_down'
  | 'review_due'
  | 'comeback'
  | 'streak';

export type InitiativeStatus = 'active' | 'acted' | 'dismissed';

export interface InitiativeView {
  id: string;
  kind: InitiativeKind;
  title: string;
  message: string;
  /** Higher = more important. */
  priority: number;
  status: InitiativeStatus;
  /** Plain-language reasons the AI acted — "the AI always explains why". */
  reasons: string[];
  createdAt: string;
}
