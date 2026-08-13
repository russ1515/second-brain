import type { TeacherRole } from '@second-brain/shared';

/**
 * The role engine (Sprint 3, task 3.6 — Language Learning Integration).
 *
 * One engine, many roles: given the SUBJECT a learner is studying, it hands the
 * same teacher the right specialist hat. Maths → a maths teacher; Biology → a
 * biology teacher; English/French/Spanish/… → that language's teacher. Adding a
 * language or a subject is a data change here, never a new engine — which is the
 * whole point of "le moteur reste le même".
 */

interface LanguageEntry {
  /** Canonical English name used everywhere as the key. */
  canonical: string;
  emoji: string;
  /** Lower-cased names (endonyms/other languages) that should resolve here. */
  aliases: string[];
}

/** Extensible registry of teachable languages. Add a row to support one more. */
export const LANGUAGES: LanguageEntry[] = [
  { canonical: 'English', emoji: '🇬🇧', aliases: ['english', 'anglais', 'inglés', 'inglese'] },
  { canonical: 'French', emoji: '🇫🇷', aliases: ['french', 'français', 'francais'] },
  { canonical: 'Spanish', emoji: '🇪🇸', aliases: ['spanish', 'espagnol', 'español', 'espanol'] },
  { canonical: 'German', emoji: '🇩🇪', aliases: ['german', 'allemand', 'deutsch'] },
  { canonical: 'Arabic', emoji: '🇸🇦', aliases: ['arabic', 'arabe'] },
  { canonical: 'Chinese', emoji: '🇨🇳', aliases: ['chinese', 'chinois', 'mandarin'] },
  { canonical: 'Italian', emoji: '🇮🇹', aliases: ['italian', 'italien', 'italiano'] },
  { canonical: 'Portuguese', emoji: '🇵🇹', aliases: ['portuguese', 'portugais', 'português', 'portugues'] },
  { canonical: 'Japanese', emoji: '🇯🇵', aliases: ['japanese', 'japonais'] },
  { canonical: 'Russian', emoji: '🇷🇺', aliases: ['russian', 'russe'] },
  { canonical: 'Korean', emoji: '🇰🇷', aliases: ['korean', 'coréen', 'coreen'] },
  { canonical: 'Hindi', emoji: '🇮🇳', aliases: ['hindi'] },
];

/** Nicer icons for common academic subjects; everything else gets the default. */
const SUBJECT_EMOJI: { match: RegExp; emoji: string }[] = [
  { match: /\b(math|maths|mathematics|mathématiques|algebra|geometry|calculus)\b/i, emoji: '🧮' },
  { match: /\b(biolog|life science)/i, emoji: '🧬' },
  { match: /\b(physic)/i, emoji: '⚛️' },
  { match: /\b(chemi|chimie)/i, emoji: '🧪' },
  { match: /\b(histor|histoire)/i, emoji: '📜' },
  { match: /\b(geograph|géographie|geographie)/i, emoji: '🗺️' },
  { match: /\b(econom)/i, emoji: '📈' },
  { match: /\b(philosoph)/i, emoji: '🤔' },
  { match: /\b(literatur|littérature|litterature)/i, emoji: '📖' },
  { match: /\b(comput|programming|coding|informatique)/i, emoji: '💻' },
  { match: /\b(law|droit)\b/i, emoji: '⚖️' },
  { match: /\b(medic|médecine|medecine|anatomy)/i, emoji: '🩺' },
  { match: /\b(music|musique)/i, emoji: '🎵' },
  { match: /\b(art|drawing|painting)\b/i, emoji: '🎨' },
];

const DEFAULT_SUBJECT_EMOJI = '📘';
const GENERAL_EMOJI = '👨‍🏫';

/** True-ish language match: the subject IS a language (whole-word alias hit). */
function detectLanguage(subject: string): LanguageEntry | null {
  const text = subject.toLowerCase();
  for (const lang of LANGUAGES) {
    for (const alias of lang.aliases) {
      const re = new RegExp(`(^|[^\\p{L}])${escapeRegExp(alias)}([^\\p{L}]|$)`, 'iu');
      if (re.test(text)) return lang;
    }
  }
  return null;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function subjectEmoji(subject: string): string {
  return SUBJECT_EMOJI.find((s) => s.match.test(subject))?.emoji ?? DEFAULT_SUBJECT_EMOJI;
}

/** The specialist persona line appended to the base teacher prompt. */
function languagePersona(language: string): string {
  return (
    ` Right now you are the ${language} language teacher. Teach ${language} itself` +
    ` — vocabulary, grammar, pronunciation and real usage. Converse in ${language}` +
    ` at the learner's level (glossing new words in their language), and when they` +
    ` make a mistake correct it gently and explain why. Offer short drills and` +
    ` model phrases they can imitate.`
  );
}

function academicPersona(subject: string): string {
  return (
    ` Right now you are an expert ${subject} teacher. Bring the methods, rigour and` +
    ` vocabulary of ${subject}: reason in its concepts, show the working step by` +
    ` step where the subject calls for it, and use ${subject} examples the learner` +
    ` can relate to.`
  );
}

/** What the engine returns: the public role (for views) plus the persona line
 *  (server-only) to splice into the system prompt. */
export interface ResolvedRole extends TeacherRole {
  /** System-prompt fragment; empty for the general role. */
  persona: string;
}

/**
 * Resolve the teacher's role from a subject/language label. `subject` may be a
 * detected subject ("Biology"), a language name ("Spanish"), or null (nothing
 * detected yet → the general teacher, no role line).
 */
export function resolveTeacherRole(subject: string | null | undefined): ResolvedRole {
  const trimmed = subject?.trim();
  if (!trimmed) {
    return { kind: 'general', subject: null, language: null, emoji: GENERAL_EMOJI, persona: '' };
  }
  const lang = detectLanguage(trimmed);
  if (lang) {
    return {
      kind: 'language',
      subject: lang.canonical,
      language: lang.canonical,
      emoji: lang.emoji,
      persona: languagePersona(lang.canonical),
    };
  }
  return {
    kind: 'academic',
    subject: trimmed,
    language: null,
    emoji: subjectEmoji(trimmed),
    persona: academicPersona(trimmed),
  };
}

/** The public slice of a resolved role (safe to send to the client). */
export function publicRole(role: ResolvedRole): TeacherRole {
  return { kind: role.kind, subject: role.subject, language: role.language, emoji: role.emoji };
}
