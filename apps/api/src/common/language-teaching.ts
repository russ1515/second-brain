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
import { DEFAULT_LOCALE, resolveLocale } from './learning-locale';

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
  const rawInterface = await resolveLocale(prisma, userId);
  const interfaceCode = toSupportedLanguage(rawInterface) ?? DEFAULT_LOCALE;
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
