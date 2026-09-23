import { SetMetadata } from '@nestjs/common';
import type { AdminRole } from '@prisma/client';

export const ADMIN_CAPABILITIES = [
  'dashboard.read', 'users.read', 'users.manage', 'users.suspend', 'users.ban',
  'users.delete_request', 'users.sessions.revoke', 'admin.roles.manage',
  'learner_profile.read', 'learner_profile.restricted', 'learner_profile.highly_restricted',
  'plans.read', 'plans.manage', 'subscriptions.read', 'subscriptions.manage',
  'quotas.read', 'quotas.adjust', 'usage.read', 'costs.read', 'costs.export',
  'provider_pricing.read', 'provider_pricing.manage', 'budgets.read', 'budgets.manage', 'billing.read',
  'billing.manage', 'payments.read', 'payments.reconcile', 'bugs.read', 'bugs.manage', 'bugs.diagnose',
  'support.read', 'support.manage', 'incidents.read', 'incidents.manage',
  'error_events.read', 'error_events.sensitive', 'diagnostics.read', 'diagnostics.run',
  'infrastructure.read', 'emails.read', 'security.read', 'security.manage',
  'audit.read', 'audit.reasons.read', 'feature_flags.read', 'feature_flags.manage', 'settings.read',
  'settings.manage',
] as const;

export type AdminCapability = (typeof ADMIN_CAPABILITIES)[number];

const all = [...ADMIN_CAPABILITIES];
export const ROLE_CAPABILITIES: Record<AdminRole, readonly AdminCapability[]> = {
  SUPER_ADMIN: all,
  TECH_OPS: ['dashboard.read', 'bugs.read', 'bugs.manage', 'bugs.diagnose', 'error_events.read', 'error_events.sensitive', 'diagnostics.read', 'diagnostics.run', 'incidents.read', 'incidents.manage', 'infrastructure.read', 'usage.read', 'audit.read', 'feature_flags.read', 'feature_flags.manage'],
  SUPPORT: ['dashboard.read', 'users.read', 'users.manage', 'users.suspend', 'users.sessions.revoke', 'learner_profile.read', 'subscriptions.read', 'quotas.read', 'bugs.read', 'support.read', 'support.manage', 'incidents.read', 'diagnostics.read'],
  FINANCE: ['dashboard.read', 'users.read', 'plans.read', 'plans.manage', 'subscriptions.read', 'subscriptions.manage', 'quotas.read', 'quotas.adjust', 'usage.read', 'costs.read', 'provider_pricing.read', 'provider_pricing.manage', 'budgets.read', 'budgets.manage', 'billing.read', 'billing.manage', 'payments.read', 'payments.reconcile', 'audit.read'],
  SECURITY: ['dashboard.read', 'users.read', 'users.suspend', 'users.ban', 'users.delete_request', 'users.sessions.revoke', 'security.read', 'security.manage', 'audit.read', 'bugs.read', 'error_events.read', 'error_events.sensitive', 'incidents.read'],
  ANALYTICS: ['dashboard.read', 'users.read', 'plans.read', 'subscriptions.read', 'quotas.read', 'usage.read', 'provider_pricing.read'],
};

export const ADMIN_CAPABILITIES_KEY = 'admin:capabilities';
export const RequireAdminCapabilities = (...capabilities: AdminCapability[]) =>
  SetMetadata(ADMIN_CAPABILITIES_KEY, capabilities);

export interface AdminIdentity {
  userId: string;
  email: string;
  roles: AdminRole[];
  capabilities: AdminCapability[];
}
