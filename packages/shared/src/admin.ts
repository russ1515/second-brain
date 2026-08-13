/** Platform admin back office (Sprint 8.5). Superadmin-only views across ALL
 *  tenants: users, subscriptions, statistics, AI usage, incidents, audit logs
 *  and user reports. */

import type { PlanSlug } from './subscription';

export interface AdminStats {
  totalUsers: number;
  suspendedUsers: number;
  totalOrganizations: number;
  /** Count of subscriptions per plan slug. */
  subscriptionsByPlan: Record<string, number>;
  /** Sum of all paid invoices, in minor currency units. */
  invoicesTotal: number;
  totalDocuments: number;
  openIncidents: number;
  openReports: number;
}

export interface AdminUserRow {
  id: string;
  email: string;
  displayName: string | null;
  planSlug: PlanSlug | null;
  isAdmin: boolean;
  suspended: boolean;
  createdAt: string;
}

export interface AdminUsersResponse {
  items: AdminUserRow[];
  total: number;
}

// ── AI usage monitoring ──

export interface AiUsageRow {
  userId: string;
  email: string;
  aiQuestions: number;
  voiceMinutes: number;
}

export interface AiUsageView {
  period: string;
  totals: { aiQuestions: number; voiceMinutes: number };
  top: AiUsageRow[];
}

// ── Incidents ──

export type IncidentSeverity = 'low' | 'medium' | 'high' | 'critical';
export const INCIDENT_SEVERITIES: readonly IncidentSeverity[] = [
  'low',
  'medium',
  'high',
  'critical',
] as const;

export type IncidentStatus = 'open' | 'investigating' | 'resolved';
export const INCIDENT_STATUSES: readonly IncidentStatus[] = [
  'open',
  'investigating',
  'resolved',
] as const;

export interface IncidentView {
  id: string;
  title: string;
  description: string | null;
  severity: IncidentSeverity;
  status: IncidentStatus;
  createdAt: string;
  resolvedAt: string | null;
}

export interface CreateIncidentRequest {
  title: string;
  description?: string;
  severity: IncidentSeverity;
}

export interface UpdateIncidentStatusRequest {
  status: IncidentStatus;
}

// ── Audit log ──

export interface AuditLogView {
  id: string;
  actorId: string | null;
  action: string;
  detail: string | null;
  createdAt: string;
}

// ── Reports / signalements ──

export type ReportStatus = 'open' | 'reviewed' | 'dismissed';

export interface ReportView {
  id: string;
  reporterId: string | null;
  category: string;
  message: string;
  status: ReportStatus;
  createdAt: string;
  reviewedAt: string | null;
}

export interface CreateReportRequest {
  category: string;
  message: string;
}

export interface ResolveReportRequest {
  status: 'reviewed' | 'dismissed';
}

export interface SetUserPlanRequest {
  slug: PlanSlug;
}
