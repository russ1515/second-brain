/** Organizations & multi-tenancy (Sprint 8.4). Wire contracts for tenants,
 *  memberships, groups/classes. Every org resource is isolated: the API only
 *  ever returns data for organizations the caller belongs to. */

export type OrganizationType =
  | 'school'
  | 'university'
  | 'training_center'
  | 'enterprise';

export const ORGANIZATION_TYPES: readonly OrganizationType[] = [
  'school',
  'university',
  'training_center',
  'enterprise',
] as const;

export type OrgRole = 'admin' | 'teacher' | 'student';

export const ORG_ROLES: readonly OrgRole[] = ['admin', 'teacher', 'student'] as const;

export type OrgGroupKind = 'class' | 'group';

export interface OrganizationSummary {
  id: string;
  name: string;
  type: OrganizationType;
  /** The caller's role in this organization. */
  role: OrgRole;
  memberCount: number;
  createdAt: string;
}

export interface OrgMemberView {
  userId: string;
  email: string;
  displayName: string | null;
  role: OrgRole;
  createdAt: string;
}

export interface OrgGroupView {
  id: string;
  name: string;
  kind: OrgGroupKind;
  memberCount: number;
  createdAt: string;
}

export interface OrganizationDetail extends OrganizationSummary {
  members: OrgMemberView[];
  groups: OrgGroupView[];
}

export interface CreateOrganizationRequest {
  name: string;
  type: OrganizationType;
}

export interface AddMemberRequest {
  /** Email of an existing Second Brain user to add. */
  email: string;
  role: OrgRole;
}

export interface CreateGroupRequest {
  name: string;
  kind: OrgGroupKind;
}

export interface AddGroupMemberRequest {
  email: string;
  role: OrgRole;
}

// ── Tenant Intelligence Engine (Sprint 8.7 ⭐) ──
// Aggregated, ANONYMISED org insights: subject difficulty, at-risk counts and
// pedagogical recommendations — never any individual learner's data.

export interface SubjectDifficulty {
  subject: string;
  /** Average post-session mastery across the org's students (0..1). */
  avgMastery: number;
  /** How many study sessions this is based on. */
  sessions: number;
}

export interface OrgInsights {
  members: { admins: number; teachers: number; students: number };
  /** Students active in the last 7 days (count only). */
  activeStudents7d: number;
  /** Subjects where students struggle most, hardest first. */
  difficultSubjects: SubjectDifficulty[];
  /** How many students are below the mastery threshold (anonymised count). */
  strugglingStudents: number;
  /** Plain-language recommendations for admins/teachers. */
  recommendations: string[];
}
