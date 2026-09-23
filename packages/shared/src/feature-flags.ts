export const UX_FEATURE_FLAG_KEYS = [
  'newAppShell',
  'experienceSessions',
  'universalComposer',
  'newHomeNBA',
  'newBrain',
  'documentIntelligence',
  'newTutorExperience',
  'newLanding',
] as const;

export type UXFeatureFlag = (typeof UX_FEATURE_FLAG_KEYS)[number];
export type UXFeatureFlags = Readonly<Record<UXFeatureFlag, boolean>>;

export const DISABLED_UX_FEATURE_FLAGS: UXFeatureFlags = {
  newAppShell: false,
  experienceSessions: false,
  universalComposer: false,
  newHomeNBA: false,
  newBrain: false,
  documentIntelligence: false,
  newTutorExperience: false,
  newLanding: false,
};

/** Resolve only explicit true values. Missing/invalid flags fail closed. */
export function resolveUXFeatureFlags(
  source: Partial<Record<UXFeatureFlag, string | boolean | undefined>>,
): UXFeatureFlags {
  return Object.fromEntries(
    UX_FEATURE_FLAG_KEYS.map((key) => [key, source[key] === true || source[key] === 'true']),
  ) as unknown as UXFeatureFlags;
}
