import { SUPPORTED_LANGUAGES, toSupportedLanguage } from '@second-brain/shared';
import type { PrismaService } from '../prisma/prisma.service';

/**
 * Global Learning Locale (scalable i18n — drives the AI Professor's language).
 *
 * `Profile.preferredLanguage` is the SINGLE SOURCE OF TRUTH for the language of
 * everything Second Brain shows a given user: UI, and — crucially — every piece
 * of content the AI generates. No generator picks its own language; each reads
 * this locale and is told to produce output DIRECTLY in it (never translate).
 * The set of languages comes from the shared registry (25+), so adding one is a
 * single entry there — this engine never changes.
 *
 * The one exception is language-LEARNING content, where the target language (and
 * the immersion / code-switching rules) governs the pedagogical text. That path
 * does not use `localeDirective`; it uses the language engine's own rules.
 */

export const DEFAULT_LOCALE = 'en';

/** Human (English) language name for a locale code, e.g. "fr" → "French".
 *  Falls back to the code itself for anything outside the registry. */
export function localeToLanguage(locale: string | null | undefined): string {
  const code = toSupportedLanguage(locale);
  if (code) return SUPPORTED_LANGUAGES[code].englishName;
  return SUPPORTED_LANGUAGES[DEFAULT_LOCALE].englishName;
}

/** Native language name, e.g. "fr" → "Français". */
export function localeToNativeName(locale: string | null | undefined): string {
  const code = toSupportedLanguage(locale);
  return code ? SUPPORTED_LANGUAGES[code].name : SUPPORTED_LANGUAGES[DEFAULT_LOCALE].name;
}

/**
 * The strict pedagogical + language directive injected into every general
 * (non-language-learning) generation so the AI Professor teaches, explains,
 * questions and evaluates EXCLUSIVELY in the learner's Learning Locale.
 */
export function localeDirective(locale: string | null | undefined): string {
  const english = localeToLanguage(locale);
  const native = localeToNativeName(locale);
  return `

======================================================================
CRITICAL PEDAGOGICAL & LANGUAGE DIRECTIVE
======================================================================
User's Target Instruction Language: ${english} (${native})

You are the AI Professor for Second Brain. You MUST teach, explain, interact,
generate exercises, provide feedback, and write all titles and descriptions
naturally, fluently and EXCLUSIVELY in ${english}.

Rules:
1. ALL generated pedagogical content (lessons, quizzes, reviews, explanations,
   corrections) must be written directly in ${english} — never write in another
   language and translate, and never mix languages in one response.
2. If the learner is studying a FOREIGN language, provide that language's
   practice/examples as needed, but keep your explanations and guidance in
   ${english}.
3. Keep a natural, encouraging, highly educational tone in ${english}.
======================================================================
`.trimEnd();
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
