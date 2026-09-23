import { resolveUXFeatureFlags } from '@second-brain/shared';

/**
 * Client-side rollout mirror. Expo requires public values to be referenced
 * statically at build time; all missing/invalid values fail closed.
 */
export const featureFlags = resolveUXFeatureFlags({
  newAppShell: process.env.EXPO_PUBLIC_FEATURE_NEW_APP_SHELL,
  experienceSessions: process.env.EXPO_PUBLIC_FEATURE_EXPERIENCE_SESSIONS,
  universalComposer: process.env.EXPO_PUBLIC_FEATURE_UNIVERSAL_COMPOSER,
  newHomeNBA: process.env.EXPO_PUBLIC_FEATURE_NEW_HOME_NBA,
  newBrain: process.env.EXPO_PUBLIC_FEATURE_NEW_BRAIN,
  documentIntelligence: process.env.EXPO_PUBLIC_FEATURE_DOCUMENT_INTELLIGENCE,
  newTutorExperience: process.env.EXPO_PUBLIC_FEATURE_NEW_TUTOR_EXPERIENCE,
  newLanding: process.env.EXPO_PUBLIC_FEATURE_NEW_LANDING,
});
