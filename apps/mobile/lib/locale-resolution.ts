import {
  toSupportedLanguage,
  type SupportedLanguageCode,
} from '@second-brain/shared';

/**
 * Locale signals are deliberately limited to preferences exposed by the
 * browser/device. Geographic position and IP address are neither required nor
 * consulted: language is a user preference, not an inferred nationality.
 */
export interface UiLocaleSignals {
  savedLocale?: string | null;
  browserLocales?: readonly (string | null | undefined)[];
  deviceLocale?: string | null;
}

/**
 * Resolve the initial interface language in a stable, testable order:
 *
 * 1. an explicit preference previously saved by the user;
 * 2. the browser's ordered language preferences;
 * 3. the device/Intl locale;
 * 4. English when none of those languages is supported.
 *
 * `toSupportedLanguage` owns BCP 47 normalization, so regional and script
 * variants such as `fr-CA`, `pt-BR` and `zh-Hant-TW` map to their supported
 * base catalog without changing the separate language being learned.
 */
export function resolveUiLocale({
  savedLocale,
  browserLocales = [],
  deviceLocale,
}: UiLocaleSignals): SupportedLanguageCode {
  const candidates = [savedLocale, ...browserLocales, deviceLocale];

  for (const candidate of candidates) {
    const supported = toSupportedLanguage(candidate?.trim());
    if (supported) return supported;
  }

  return 'en';
}

/** Return one canonical BCP 47 tag, accepting the underscore form sometimes
 * exposed by native runtimes for backwards compatibility. */
function canonicalLocale(value: string | null | undefined): string | null {
  const candidate = value?.trim().replaceAll('_', '-');
  if (!candidate) return null;
  try {
    return Intl.getCanonicalLocales(candidate)[0] ?? null;
  } catch {
    return null;
  }
}

/**
 * Preserve regional formatting independently from the base UI catalog.
 *
 * A saved `fr` interface choice still wins for copy, while a compatible
 * browser preference such as `fr-CA` controls dates, times, numbers and
 * currencies. Incompatible region signals are skipped; we never borrow
 * `en-US` formatting for a French interface, and fall back to `fr` instead.
 */
export function resolveFormatLocale({
  uiLocale,
  browserLocales = [],
  deviceLocale,
}: Omit<UiLocaleSignals, 'savedLocale'> & { uiLocale: SupportedLanguageCode }): string {
  for (const candidate of [...browserLocales, deviceLocale]) {
    const canonical = canonicalLocale(candidate);
    if (canonical && toSupportedLanguage(canonical) === uiLocale) return canonical;
  }

  return uiLocale;
}
