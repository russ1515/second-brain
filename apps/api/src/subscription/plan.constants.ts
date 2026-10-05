import type { PlanAudience, PlanSlug } from '@second-brain/shared';

/** Defaults used only when a catalog row is created. Existing commercial
 *  configuration is immutable at boot and changes through versioned, audited
 *  workflows or additive migrations. */
export interface PlanSeed {
  slug: PlanSlug;
  name: string;
  tier: number;
  audience: PlanAudience;
  /** Legacy compatibility quota limits. They seed new rows only; existing plan
   *  quotas are never replaced during application boot. */
  quotas: Record<string, number>;
  priceMonthly: number | null;
  priceYearly: number | null;
  currency: string;
  publicV1: boolean;
  fallbackRatio: number;
}

const GB = 1024 * 1024 * 1024;

export const PLAN_SEED: readonly PlanSeed[] = [
  {
    slug: 'free',
    name: 'Free',
    tier: 0,
    audience: 'individual',
    quotas: { documents: 100, storage: 10 * GB, ai_questions: 1000, voice_minutes: 300 },
    priceMonthly: 0,
    priceYearly: 0,
    currency: 'usd',
    publicV1: true,
    fallbackRatio: 0,
  },
  {
    slug: 'pro',
    name: 'Pro',
    tier: 10,
    audience: 'individual',
    quotas: { documents: 1000, storage: 100 * GB, ai_questions: 10000, voice_minutes: 3000 },
    priceMonthly: 499,
    priceYearly: 4900,
    currency: 'usd',
    publicV1: true,
    fallbackRatio: 0.5,
  },
  {
    slug: 'pro_max',
    name: 'Pro Max',
    tier: 20,
    audience: 'individual',
    quotas: { documents: 5000, storage: 500 * GB, ai_questions: 50000, voice_minutes: 10000 },
    priceMonthly: 1500,
    priceYearly: 15000,
    currency: 'usd',
    publicV1: true,
    fallbackRatio: 0.5,
  },
  {
    slug: 'team',
    name: 'Team / Business',
    tier: 30,
    audience: 'organization',
    quotas: { documents: -1, storage: -1, ai_questions: -1, voice_minutes: -1 },
    priceMonthly: null,
    priceYearly: null,
    currency: 'usd',
    publicV1: false,
    fallbackRatio: 0.5,
  },
  {
    slug: 'school',
    name: 'School',
    tier: 40,
    audience: 'organization',
    quotas: { documents: -1, storage: -1, ai_questions: -1, voice_minutes: -1 },
    priceMonthly: null,
    priceYearly: null,
    currency: 'usd',
    publicV1: false,
    fallbackRatio: 0.5,
  },
  {
    slug: 'enterprise',
    name: 'Enterprise',
    tier: 50,
    audience: 'organization',
    quotas: { documents: -1, storage: -1, ai_questions: -1, voice_minutes: -1 },
    priceMonthly: null,
    priceYearly: null,
    currency: 'usd',
    publicV1: false,
    fallbackRatio: 0.5,
  },
] as const;

/** The plan every new subscriber starts on. */
export const DEFAULT_PLAN_SLUG: PlanSlug = 'free';
