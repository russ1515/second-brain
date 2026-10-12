import { useEffect, useState } from 'react';
import {
  toSupportedLanguage,
  type LanguageProfileSummary,
  type SupportedLanguageCode,
} from '@second-brain/shared';
import { api } from './client';
import { useI18n } from './i18n';

/** Resolve the persisted teaching-language SOURCE against the current account
 * interface locale. The learning target is deliberately never a fallback. */
export function teachingSpeechLanguage(
  profile: Pick<LanguageProfileSummary, 'teachingLanguageSource' | 'nativeLanguageCode'>,
  interfaceLocale: string,
): SupportedLanguageCode | undefined {
  if (profile.teachingLanguageSource === 'native') {
    return profile.nativeLanguageCode ?? undefined;
  }
  return toSupportedLanguage(interfaceLocale) ?? undefined;
}

/** Load the authoritative language-profile choice for Tutor surfaces that only
 * receive a profile id. Undefined means "let the backend choose", never "use
 * the target language". */
export function useTeachingSpeechLanguage(
  languageProfileId?: string,
): SupportedLanguageCode | undefined {
  const { locale } = useI18n();
  const [loaded, setLoaded] = useState<{
    id: string;
    profile: LanguageProfileSummary;
  } | null>(null);

  useEffect(() => {
    let active = true;
    setLoaded(null);
    if (!languageProfileId) return () => { active = false; };
    void api<LanguageProfileSummary>(`/languages/${languageProfileId}`)
      .then((value) => { if (active) setLoaded({ id: languageProfileId, profile: value }); })
      .catch(() => { if (active) setLoaded(null); });
    return () => { active = false; };
  }, [languageProfileId]);

  if (!loaded || loaded.id !== languageProfileId) return undefined;
  return teachingSpeechLanguage(loaded.profile, locale);
}
