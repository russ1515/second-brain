/**
 * Central language registry for the mobile app.
 *
 * Re-exported from the shared package so the API and the app use ONE source of
 * truth for the supported languages (25+), their native/English names and flags.
 * See `@second-brain/shared` → `languages.ts`.
 */
export {
  SUPPORTED_LANGUAGES,
  SUPPORTED_LANGUAGE_CODES,
  toSupportedLanguage,
  type SupportedLanguageCode,
  type LanguageMeta,
} from '@second-brain/shared';
