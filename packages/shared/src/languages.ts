/**
 * Central language registry (scalable i18n).
 *
 * ONE source of truth shared by the API and the mobile app: the set of
 * languages Second Brain supports, each with its native name, English name and
 * flag. The user's chosen language drives BOTH the UI (interface strings, with
 * English fallback) AND the AI Professor's teaching language (see
 * `localeToLanguage` / `localeDirective` on the API). Adding a language is one
 * entry here — no engine change.
 */

export type SupportedLanguageCode =
  | 'fr' | 'en' | 'es' | 'de' | 'it' | 'pt' | 'nl' | 'pl' | 'ru' | 'zh'
  | 'ja' | 'ko' | 'ar' | 'hi' | 'tr' | 'sv' | 'vi' | 'th' | 'el' | 'cs'
  | 'ro' | 'hu' | 'da' | 'fi' | 'id' | 'no' | 'uk';

export interface LanguageMeta {
  code: SupportedLanguageCode;
  /** Name in the language itself. */
  name: string;
  englishName: string;
  flag: string;
  /** Right-to-left script (Arabic). Lets the UI mirror when needed. */
  rtl?: boolean;
}

export const SUPPORTED_LANGUAGES: Record<SupportedLanguageCode, LanguageMeta> = {
  fr: { code: 'fr', name: 'Français', englishName: 'French', flag: '🇫🇷' },
  en: { code: 'en', name: 'English', englishName: 'English', flag: '🇬🇧' },
  es: { code: 'es', name: 'Español', englishName: 'Spanish', flag: '🇪🇸' },
  de: { code: 'de', name: 'Deutsch', englishName: 'German', flag: '🇩🇪' },
  it: { code: 'it', name: 'Italiano', englishName: 'Italian', flag: '🇮🇹' },
  pt: { code: 'pt', name: 'Português', englishName: 'Portuguese', flag: '🇵🇹' },
  nl: { code: 'nl', name: 'Nederlands', englishName: 'Dutch', flag: '🇳🇱' },
  pl: { code: 'pl', name: 'Polski', englishName: 'Polish', flag: '🇵🇱' },
  ru: { code: 'ru', name: 'Русский', englishName: 'Russian', flag: '🇷🇺' },
  zh: { code: 'zh', name: '中文', englishName: 'Chinese', flag: '🇨🇳' },
  ja: { code: 'ja', name: '日本語', englishName: 'Japanese', flag: '🇯🇵' },
  ko: { code: 'ko', name: '한국어', englishName: 'Korean', flag: '🇰🇷' },
  ar: { code: 'ar', name: 'العربية', englishName: 'Arabic', flag: '🇸🇦', rtl: true },
  hi: { code: 'hi', name: 'हिन्दी', englishName: 'Hindi', flag: '🇮🇳' },
  tr: { code: 'tr', name: 'Türkçe', englishName: 'Turkish', flag: '🇹🇷' },
  sv: { code: 'sv', name: 'Svenska', englishName: 'Swedish', flag: '🇸🇪' },
  vi: { code: 'vi', name: 'Tiếng Việt', englishName: 'Vietnamese', flag: '🇻🇳' },
  th: { code: 'th', name: 'ไทย', englishName: 'Thai', flag: '🇹🇭' },
  el: { code: 'el', name: 'Ελληνικά', englishName: 'Greek', flag: '🇬🇷' },
  cs: { code: 'cs', name: 'Čeština', englishName: 'Czech', flag: '🇨🇿' },
  ro: { code: 'ro', name: 'Română', englishName: 'Romanian', flag: '🇷🇴' },
  hu: { code: 'hu', name: 'Magyar', englishName: 'Hungarian', flag: '🇭🇺' },
  da: { code: 'da', name: 'Dansk', englishName: 'Danish', flag: '🇩🇰' },
  fi: { code: 'fi', name: 'Suomi', englishName: 'Finnish', flag: '🇫🇮' },
  id: { code: 'id', name: 'Bahasa Indonesia', englishName: 'Indonesian', flag: '🇮🇩' },
  no: { code: 'no', name: 'Norsk', englishName: 'Norwegian', flag: '🇳🇴' },
  uk: { code: 'uk', name: 'Українська', englishName: 'Ukrainian', flag: '🇺🇦' },
};

/** All supported codes, in registry order (French first). */
export const SUPPORTED_LANGUAGE_CODES = Object.keys(
  SUPPORTED_LANGUAGES,
) as SupportedLanguageCode[];

/** Narrow an arbitrary string to a supported code, or null. */
export function toSupportedLanguage(value: string | null | undefined): SupportedLanguageCode | null {
  if (!value) return null;
  const base = value.toLowerCase().split(/[-_]/)[0];
  return (base in SUPPORTED_LANGUAGES ? (base as SupportedLanguageCode) : null);
}
