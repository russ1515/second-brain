/** Subscription Engine (Sprint 8.1). Generic architecture for plans, quotas,
 *  features and billing. Per-plan limits & benefits are intentionally NOT defined
 *  here yet — the maps are open-ended so they can be filled later without a
 *  breaking change. */

/** The six seeded plans. Names are provisional; the slug is the stable id. */
export type PlanSlug =
  | 'free'
  | 'pro'
  | 'pro_max'
  | 'team'
  | 'school'
  | 'enterprise';

export const PLAN_SLUGS: readonly PlanSlug[] = [
  'free',
  'pro',
  'pro_max',
  'team',
  'school',
  'enterprise',
] as const;

export type PlanAudience = 'individual' | 'organization';

export type SubscriptionStatus =
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'canceled'
  | 'incomplete';

/** A generic quota map: limit per key. A missing key or -1 means "unlimited". */
export type QuotaMap = Record<string, number>;
/** A generic feature-flag map: whether a capability is enabled. */
export type FeatureMap = Record<string, boolean>;

export interface PlanView {
  id: string;
  slug: PlanSlug;
  name: string;
  tier: number;
  audience: PlanAudience;
  quotas: QuotaMap;
  features: FeatureMap;
  /** Minor currency units (e.g. cents); null until pricing is set. */
  priceMonthly: number | null;
  priceYearly: number | null;
  currency: string;
  isActive: boolean;
}

export interface SubscriptionView {
  id: string;
  planSlug: PlanSlug;
  planName: string;
  status: SubscriptionStatus;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  trialEndsAt: string | null;
}

/** The effective entitlements for a subscriber — the resolved plan's quotas and
 *  features, used by the rest of the app to gate capability. */
export interface EntitlementsView {
  planSlug: PlanSlug;
  status: SubscriptionStatus;
  quotas: QuotaMap;
  features: FeatureMap;
}

export interface ChangePlanRequest {
  slug: PlanSlug;
}
