/** Analytics & Business Intelligence (Sprint 8.6). Platform-wide indicators that
 *  drive continuous improvement. Admin-only. */

export interface ActiveUsers {
  /** Active in the last 24h / 7d / 30d. */
  dau: number;
  wau: number;
  mau: number;
}

export interface FeatureUsage {
  feature: string;
  count: number;
}

export interface AnalyticsOverview {
  activeUsers: ActiveUsers;
  /** DAU / MAU — how "sticky" the product is (0..1). */
  stickiness: number;
  /** Share of users older than 7 days who were active in the last 7 days (0..1). */
  retention7d: number;
  totalUsers: number;
  newUsers7d: number;
  /** Total study time across completed study sessions, in minutes. */
  studyMinutes: number;
  /** Average post-session concept mastery (0..1), or null with no data. */
  avgMastery: number | null;
  lessonsCompleted: number;
  /** Paid subscribers / total users (0..1). */
  conversionRate: number;
  paidUsers: number;
  /** Sum of paid invoices, in minor currency units. */
  revenue: number;
  /** AI consumption this period. */
  aiUsage: { aiQuestions: number; voiceMinutes: number };
  /** Most-used features, ranked. */
  topFeatures: FeatureUsage[];
}
