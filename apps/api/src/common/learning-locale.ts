import type { PrismaService } from '../prisma/prisma.service';

/**
 * Global Learning Locale (ITE Engine — language consistency).
 *
 * `Profile.preferredLanguage` is the SINGLE SOURCE OF TRUTH for the language of
 * everything Second Brain shows a given user: UI, and — crucially — every piece
 * of content the AI generates. No generator picks its own language; each reads
 * this locale and is told to produce output DIRECTLY in it (never translate).
 *
 * The one exception is language-LEARNING content, where the target language (and
 * the immersion / code-switching rules) governs the pedagogical text. That path
 * does not use `localeDirective`; it uses the language engine's own rules.
 */

const LOCALE_TO_LANGUAGE: Record<string, string> = {
  en: 'English',
  fr: 'French',
  es: 'Spanish',
  pt: 'Portuguese',
  de: 'German',
  it: 'Italian',
  nl: 'Dutch',
  ar: 'Arabic',
  ja: 'Japanese',
  zh: 'Chinese',
  ko: 'Korean',
};

export const DEFAULT_LOCALE = 'en';

/** Human language name for a locale code (falls back to the code itself). */
export function localeToLanguage(locale: string | null | undefined): string {
  if (!locale) return LOCALE_TO_LANGUAGE[DEFAULT_LOCALE];
  const base = locale.toLowerCase().split(/[-_]/)[0];
  return LOCALE_TO_LANGUAGE[base] ?? locale;
}

/** The strict instruction injected into every general (non-language-learning)
 *  generation so its output lands entirely in the learner's Learning Locale. */
export function localeDirective(locale: string | null | undefined): string {
  const language = localeToLanguage(locale);
  return (
    ` Learning Locale: write ALL of your output directly in ${language}. Think and` +
    ` generate natively in ${language} — never write in another language and translate,` +
    ` and never mix languages in the same response.`
  );
}

/** Resolve a user's Learning Locale from their profile. Best-effort: defaults to
 *  English if there is no profile or the read fails. */
export async function resolveLocale(
  prisma: PrismaService,
  userId: string,
): Promise<string> {
  try {
    const profile = await prisma.profile.findUnique({
      where: { userId },
      select: { preferredLanguage: true },
    });
    return profile?.preferredLanguage || DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}
