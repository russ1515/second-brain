import type { LanguageProfileSummary } from '@second-brain/shared';
import type { RlleCourseLoad } from './language-rll-client';

export interface BrainLanguageBulletinEntry {
  profile: LanguageProfileSummary;
  course: RlleCourseLoad;
}

export interface BrainLanguageBulletinResult {
  items: BrainLanguageBulletinEntry[];
  partial: boolean;
}

interface BrainLanguageBulletinDependencies {
  listProfiles: () => Promise<LanguageProfileSummary[]>;
  loadProfile: (profileId: string) => Promise<LanguageProfileSummary>;
  loadCourse: (profileId: string) => Promise<RlleCourseLoad>;
}

/** Loads every owned language bulletin for the general Brain view while still
 * supporting a single contextual profile. One unavailable course does not hide
 * the other languages; contextual loads remain fail-loud for a useful retry. */
export async function resolveBrainLanguageBulletins(
  languageProfileId: string | undefined,
  dependencies: BrainLanguageBulletinDependencies,
): Promise<BrainLanguageBulletinResult> {
  const profiles = languageProfileId
    ? [await dependencies.loadProfile(languageProfileId)]
    : await dependencies.listProfiles();
  const settled = await Promise.allSettled(
    profiles.map(async (profile): Promise<BrainLanguageBulletinEntry> => ({
      profile,
      course: await dependencies.loadCourse(profile.id),
    })),
  );
  const items = settled.flatMap((result) => result.status === 'fulfilled' ? [result.value] : []);
  const rejected = settled.filter((result) => result.status === 'rejected');
  if (languageProfileId && rejected[0]?.status === 'rejected') throw rejected[0].reason;
  return { items, partial: rejected.length > 0 };
}
