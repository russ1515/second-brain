import type { PlanAudience, PlanSlug } from '@second-brain/shared';

/** The six seeded plans (Sprint 8.1). Names are PROVISIONAL and editable later;
 *  quotas/features are intentionally empty — per-plan limits and benefits are
 *  defined in a later task. The seed is idempotent (upsert by slug), so changing
 *  a name here updates the row without wiping quotas/features set elsewhere. */
export interface PlanSeed {
  slug: PlanSlug;
  name: string;
  tier: number;
  audience: PlanAudience;
  /** Example quota limits (Sprint 8.3). Keys match the usage metric catalog;
   *  -1 = unlimited. These are DATA — tune freely; they seed each boot for now. */
  quotas: Record<string, number>;
}

const GB = 1024 * 1024 * 1024;

export const PLAN_SEED: readonly PlanSeed[] = [
  {
    slug: 'free',
    name: 'Free',
    tier: 0,
    audience: 'individual',
    quotas: { documents: 100, storage: 10 * GB, ai_questions: 1000, voice_minutes: 300 },
  },
  {
    slug: 'pro',
    name: 'Pro',
    tier: 10,
    audience: 'individual',
    quotas: { documents: 1000, storage: 100 * GB, ai_questions: 10000, voice_minutes: 3000 },
  },
  {
    slug: 'pro_max',
    name: 'Pro Max',
    tier: 20,
    audience: 'individual',
    quotas: { documents: 5000, storage: 500 * GB, ai_questions: 50000, voice_minutes: 10000 },
  },
  {
    slug: 'team',
    name: 'Team / Business',
    tier: 30,
    audience: 'organization',
    quotas: { documents: -1, storage: -1, ai_questions: -1, voice_minutes: -1 },
  },
  {
    slug: 'school',
    name: 'School',
    tier: 40,
    audience: 'organization',
    quotas: { documents: -1, storage: -1, ai_questions: -1, voice_minutes: -1 },
  },
  {
    slug: 'enterprise',
    name: 'Enterprise',
    tier: 50,
    audience: 'organization',
    quotas: { documents: -1, storage: -1, ai_questions: -1, voice_minutes: -1 },
  },
] as const;

/** The plan every new subscriber starts on. */
export const DEFAULT_PLAN_SLUG: PlanSlug = 'free';
