import type { TeacherRole } from '@second-brain/shared';
import type { Locale } from './i18n';

/**
 * Format the auto-selected teacher role (task 3.6) as a human label, in the
 * interface language. Languages get proper localised names and French elision
 * ("Professeur d'anglais" vs "Professeur de français"); academic subjects keep
 * the classified label. The role's emoji is rendered separately by the caller.
 */

/** Canonical (English) language name → localised display name. */
const LANGUAGE_NAMES: Record<string, { en: string; fr: string }> = {
  English: { en: 'English', fr: 'anglais' },
  French: { en: 'French', fr: 'français' },
  Spanish: { en: 'Spanish', fr: 'espagnol' },
  German: { en: 'German', fr: 'allemand' },
  Arabic: { en: 'Arabic', fr: 'arabe' },
  Chinese: { en: 'Chinese', fr: 'chinois' },
  Italian: { en: 'Italian', fr: 'italien' },
  Portuguese: { en: 'Portuguese', fr: 'portugais' },
  Japanese: { en: 'Japanese', fr: 'japonais' },
  Russian: { en: 'Russian', fr: 'russe' },
  Korean: { en: 'Korean', fr: 'coréen' },
  Hindi: { en: 'Hindi', fr: 'hindi' },
};

/** French: "de" elides to "d'" before a vowel (or silent h). */
function frenchDe(word: string): string {
  return /^[aàâäeéèêëiîïoôöuùûühy]/i.test(word) ? `d'${word}` : `de ${word}`;
}

export function teacherRoleLabel(role: TeacherRole, locale: Locale): string {
  if (role.kind === 'general' || !role.subject) {
    return locale === 'fr' ? 'Professeur' : 'Teacher';
  }
  if (role.kind === 'language' && role.language) {
    const names = LANGUAGE_NAMES[role.language];
    if (locale === 'fr') {
      const fr = names?.fr ?? role.language.toLowerCase();
      return `Professeur ${frenchDe(fr)}`;
    }
    return `${names?.en ?? role.language} teacher`;
  }
  // Academic subject — the classified label stays as-is.
  return locale === 'fr' ? `Professeur de ${role.subject}` : `${role.subject} teacher`;
}
