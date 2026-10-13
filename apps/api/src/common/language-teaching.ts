import type { LanguageProfile } from '@prisma/client';
import type {
  LanguageTeachingSource,
  SupportedLanguageCode,
} from '@second-brain/shared';
import {
  SUPPORTED_LANGUAGES,
  toSupportedLanguage,
} from '@second-brain/shared';
import type { PrismaService } from '../prisma/prisma.service';
import { DEFAULT_LOCALE } from './learning-locale';

export interface LanguageTeachingRoles {
  interfaceLanguage: string;
  supportLanguage: string;
  supportLanguageCode: SupportedLanguageCode;
  targetLanguage: string;
  teachingLanguageSource: LanguageTeachingSource;
}

type TeachingProfile = Pick<
  LanguageProfile,
  'language' | 'normalizedLanguage' | 'nativeLanguage' | 'teachingLanguageSource'
>;

/** Resolve the language-learning path's instruction language from persisted,
 * trusted state. The target language never participates in this decision. */
export async function resolveLanguageTeachingRoles(
  prisma: PrismaService,
  userId: string,
  profile: TeachingProfile,
): Promise<LanguageTeachingRoles> {
  const interfaceCode = await resolveInterfaceLocale(prisma, userId);
  const nativeCode = toSupportedLanguage(profile.nativeLanguage);
  const source: LanguageTeachingSource = profile.teachingLanguageSource === 'native'
    ? 'native'
    : 'interface';
  // A legacy/inconsistent row must fail safely in the known UI locale rather
  // than guessing from the target language.
  const supportCode = source === 'native' && nativeCode ? nativeCode : interfaceCode;
  const targetCode = toSupportedLanguage(profile.normalizedLanguage)
    ?? toSupportedLanguage(profile.language);

  return {
    interfaceLanguage: SUPPORTED_LANGUAGES[interfaceCode].englishName,
    supportLanguage: SUPPORTED_LANGUAGES[supportCode].englishName,
    supportLanguageCode: supportCode,
    targetLanguage: targetCode
      ? SUPPORTED_LANGUAGES[targetCode].englishName
      : profile.language,
    teachingLanguageSource: source,
  };
}

/** Resolve the account UI locale from the same persisted fields exposed by the
 * Learner Passport. `Profile.preferredLanguage` is a legacy/general learning
 * locale and may legitimately differ after the learner changes the interface;
 * it is therefore only a compatibility fallback. */
async function resolveInterfaceLocale(
  prisma: PrismaService,
  userId: string,
): Promise<SupportedLanguageCode> {
  // Some isolated unit stores predate OnboardingProfile. Detect that shape
  // explicitly; do not swallow a real database failure and silently switch the
  // learner to English.
  if ('onboardingProfile' in prisma && prisma.onboardingProfile) {
    const onboarding = await prisma.onboardingProfile.findUnique({
      where: { userId },
      select: { extra: true, languages: true },
    });
    const persisted = jsonString(onboarding?.extra, 'interfaceLanguage')
      ?? jsonString(onboarding?.languages, 'interface');
    const code = toSupportedLanguage(persisted);
    if (code) return code;
  }

  const legacy = await prisma.profile.findUnique({
    where: { userId },
    select: { preferredLanguage: true },
  });
  return toSupportedLanguage(legacy?.preferredLanguage) ?? DEFAULT_LOCALE;
}

function jsonString(value: unknown, key: string): string | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const candidate = (value as Record<string, unknown>)[key];
  return typeof candidate === 'string' ? candidate : undefined;
}
