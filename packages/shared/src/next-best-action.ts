/** Normalized, explainable action recommendation shared by API and clients. */

export type ActionDestinationKind =
  | 'route'
  | 'concept'
  | 'document'
  | 'lesson'
  | 'workspace'
  | 'review'
  | 'language'
  | 'experience-session';

export interface ActionDestination {
  kind: ActionDestinationKind;
  /** Domain identifier when the destination is an object. */
  id?: string;
  /** Existing application path when the destination is directly navigable. */
  path?: string;
  /** Small, non-sensitive navigation parameters. */
  params?: Record<string, string | number | boolean>;
}

export interface RecommendationReason {
  /** Stable machine-readable signal name. */
  signal: string;
  /** Short label suitable for the future “Pourquoi ?” UI. */
  humanLabel: string;
  /** Verifiable product evidence; never model chain-of-thought. */
  evidence: string;
  weight?: number;
  source: string;
  timestamp: string;
}

export interface NextBestActionCommand {
  label: string;
  destination: ActionDestination;
}

export interface NextBestActionAlternative {
  id?: string;
  title: string;
  destination: ActionDestination;
}

export interface ExpectedImpact {
  kind: 'mastery' | 'memory' | 'progress' | 'goal' | 'continuity' | 'knowledge';
  label: string;
  /** Only present when a backend has measured or forecast a real delta. */
  value?: number;
  unit?: string;
}

export interface NextBestAction {
  id?: string;
  title: string;
  primaryAction: NextBestActionCommand;
  reason: string;
  estimatedDuration: number | null;
  expectedImpact: ExpectedImpact | null;
  signalsUsed: RecommendationReason[];
  alternatives: NextBestActionAlternative[];
  destination: ActionDestination;
  validUntil: string | null;
  confidence: number | null;
  source: {
    kind: 'recommendation-engine' | 'coach' | 'mentor' | 'foresight' | 'session' | 'revision' | 'goal' | 'manual';
    id?: string;
  };
}
