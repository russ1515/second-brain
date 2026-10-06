/**
 * Central language registry (scalable i18n).
 *
 * ONE source of truth shared by the API and the mobile app: the set of
 * languages Second Brain supports, each with its native name, English name and
 * secondary icon. UI locale and learning language are deliberately separate:
 * this registry validates and presents both choices, while each experience
 * receives the relevant one explicitly. Adding a language is one entry here —
 * no engine change.
 */

export type SupportedLanguageCode =
  | 'fr' | 'en' | 'es' | 'de' | 'it' | 'pt' | 'nl' | 'pl' | 'ru' | 'zh'
  | 'ja' | 'ko' | 'ar' | 'hi' | 'tr' | 'sv' | 'vi' | 'th' | 'el' | 'cs'
  | 'ro' | 'hu' | 'da' | 'fi' | 'id' | 'nb' | 'uk' | 'ln' | 'sw' | 'wo'
  | 'ha' | 'he' | 'zh-Hant' | 'bn';

export interface LanguageMeta {
  code: SupportedLanguageCode;
  /** Name in the language itself. */
  name: string;
  englishName: string;
  /** ISO 3166-1 alpha-2 editorial marker used by the local flag asset map. */
  flagRegion: string;
  /** Historical names/codes accepted on reads but never exposed as extra choices. */
  aliases?: readonly string[];
  /** Right-to-left script. Lets every client mirror from one source of truth. */
  rtl?: boolean;
}

export const SUPPORTED_LANGUAGES: Record<SupportedLanguageCode, LanguageMeta> = {
  fr: { code: 'fr', name: 'Français', englishName: 'French', flagRegion: 'FR' },
  en: { code: 'en', name: 'English', englishName: 'English', flagRegion: 'GB' },
  es: { code: 'es', name: 'Español', englishName: 'Spanish', flagRegion: 'ES' },
  de: { code: 'de', name: 'Deutsch', englishName: 'German', flagRegion: 'DE' },
  it: { code: 'it', name: 'Italiano', englishName: 'Italian', flagRegion: 'IT' },
  pt: { code: 'pt', name: 'Português', englishName: 'Portuguese', flagRegion: 'PT' },
  nl: { code: 'nl', name: 'Nederlands', englishName: 'Dutch', flagRegion: 'NL' },
  pl: { code: 'pl', name: 'Polski', englishName: 'Polish', flagRegion: 'PL' },
  ru: { code: 'ru', name: 'Русский', englishName: 'Russian', flagRegion: 'RU' },
  zh: {
    code: 'zh',
    name: '简体中文',
    englishName: 'Chinese (Simplified)',
    flagRegion: 'CN',
    aliases: ['中文', 'Chinese'],
  },
  ja: { code: 'ja', name: '日本語', englishName: 'Japanese', flagRegion: 'JP' },
  ko: { code: 'ko', name: '한국어', englishName: 'Korean', flagRegion: 'KR' },
  ar: { code: 'ar', name: 'العربية', englishName: 'Arabic', flagRegion: 'SA', rtl: true },
  hi: { code: 'hi', name: 'हिन्दी', englishName: 'Hindi', flagRegion: 'IN' },
  tr: { code: 'tr', name: 'Türkçe', englishName: 'Turkish', flagRegion: 'TR' },
  sv: { code: 'sv', name: 'Svenska', englishName: 'Swedish', flagRegion: 'SE' },
  vi: { code: 'vi', name: 'Tiếng Việt', englishName: 'Vietnamese', flagRegion: 'VN' },
  th: { code: 'th', name: 'ไทย', englishName: 'Thai', flagRegion: 'TH' },
  el: { code: 'el', name: 'Ελληνικά', englishName: 'Greek', flagRegion: 'GR' },
  cs: { code: 'cs', name: 'Čeština', englishName: 'Czech', flagRegion: 'CZ' },
  ro: { code: 'ro', name: 'Română', englishName: 'Romanian', flagRegion: 'RO' },
  hu: { code: 'hu', name: 'Magyar', englishName: 'Hungarian', flagRegion: 'HU' },
  da: { code: 'da', name: 'Dansk', englishName: 'Danish', flagRegion: 'DK' },
  fi: { code: 'fi', name: 'Suomi', englishName: 'Finnish', flagRegion: 'FI' },
  id: { code: 'id', name: 'Bahasa Indonesia', englishName: 'Indonesian', flagRegion: 'ID' },
  nb: {
    code: 'nb',
    name: 'Norsk (bokmål)',
    englishName: 'Norwegian Bokmål',
    flagRegion: 'NO',
    aliases: ['Norsk', 'Norwegian', 'Bokmål'],
  },
  uk: { code: 'uk', name: 'Українська', englishName: 'Ukrainian', flagRegion: 'UA' },
  ln: { code: 'ln', name: 'Lingála', englishName: 'Lingala', flagRegion: 'CD' },
  sw: { code: 'sw', name: 'Kiswahili', englishName: 'Swahili', flagRegion: 'TZ' },
  wo: { code: 'wo', name: 'Wolof', englishName: 'Wolof', flagRegion: 'SN' },
  ha: { code: 'ha', name: 'Hausa', englishName: 'Hausa', flagRegion: 'NG' },
  he: { code: 'he', name: 'עברית', englishName: 'Hebrew', flagRegion: 'IL', rtl: true },
  'zh-Hant': {
    code: 'zh-Hant',
    name: '繁體中文',
    englishName: 'Chinese (Traditional)',
    flagRegion: 'TW',
    aliases: ['Traditional Chinese'],
  },
  bn: { code: 'bn', name: 'বাংলা', englishName: 'Bengali', flagRegion: 'BD' },
};

/** All supported codes, in registry order (French first). */
export const SUPPORTED_LANGUAGE_CODES = Object.keys(
  SUPPORTED_LANGUAGES,
) as SupportedLanguageCode[];

/** Legacy/alternate BCP 47 language identifiers accepted on read. They never
 * create an additional choice in the public registry. */
export const LANGUAGE_CODE_ALIASES: Readonly<Record<string, SupportedLanguageCode>> = {
  no: 'nb',
  iw: 'he',
  in: 'id',
  'zh-hans': 'zh',
  'zh-cn': 'zh',
  'zh-sg': 'zh',
  'zh-hant': 'zh-Hant',
  'zh-tw': 'zh-Hant',
  'zh-hk': 'zh-Hant',
  'zh-mo': 'zh-Hant',
};

function comparableLanguageName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleLowerCase();
}

/** Narrow an arbitrary string to a supported code, or null. */
export function toSupportedLanguage(value: string | null | undefined): SupportedLanguageCode | null {
  if (!value) return null;
  const normalizedTag = value.trim().replaceAll('_', '-').toLocaleLowerCase();
  const exactCode = SUPPORTED_LANGUAGE_CODES.find((code) => code.toLocaleLowerCase() === normalizedTag);
  if (exactCode) return exactCode;

  const exactAlias = LANGUAGE_CODE_ALIASES[normalizedTag];
  if (exactAlias) return exactAlias;

  const parts = normalizedTag.split('-');
  const base = parts[0];
  if (base === 'zh') {
    // An explicit script subtag wins over a likely-script region. This keeps a
    // syntactically valid (if unusual) `zh-Hans-TW` request Simplified, while
    // script-less `zh-TW` still resolves to Traditional Chinese.
    if (parts.includes('hant')) return 'zh-Hant';
    if (parts.includes('hans')) return 'zh';
    return parts.some((part) => ['tw', 'hk', 'mo'].includes(part)) ? 'zh-Hant' : 'zh';
  }

  const baseAlias = LANGUAGE_CODE_ALIASES[base];
  if (baseAlias) return baseAlias;
  if (base in SUPPORTED_LANGUAGES) return base as SupportedLanguageCode;

  const normalized = comparableLanguageName(value);
  return SUPPORTED_LANGUAGE_CODES.find((code) => {
    const language = SUPPORTED_LANGUAGES[code];
    return [language.name, language.englishName, ...(language.aliases ?? [])]
      .some((name) => comparableLanguageName(name) === normalized);
  }) ?? null;
}

/** Provider-safe speech hint for every public language. OpenAI transcription
 * accepts ISO-639-1 language hints; Traditional Chinese therefore shares the
 * `zh` recognizer hint while the product keeps its distinct script/RTL metadata.
 * Unknown values stay undefined rather than being guessed from the UI locale. */
export function speechLanguageTag(
  value: string | null | undefined,
): SupportedLanguageCode | 'zh' | undefined {
  const code = toSupportedLanguage(value);
  if (!code) return undefined;
  return code === 'zh-Hant' ? 'zh' : code;
}
