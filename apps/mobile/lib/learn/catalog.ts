import type { LearningCategory } from '@second-brain/shared';

/**
 * Apprendre catalog (UI/UX Sprint 4).
 *
 * The six pedagogical CAPABILITIES and the pedagogical MODES that make up the
 * Learn workspace. Everything here only ROUTES into flows that already exist
 * (tutor, lessons, library, examiner, languages, scan) — Sprint 4 is UX over
 * the existing engines, no new business logic. Copy is French (product voice),
 * matching the onboarding catalog; folding into i18n is later content work.
 *
 * Academic Workspace is a CAPABILITY under Apprendre — never a seventh main tab.
 */

export type CapabilityKey = 'conv' | 'lang' | 'course' | 'lib' | 'work' | 'eval';

export interface Capability {
  key: CapabilityKey;
  icon: string;
  title: string;
  subtitle: string;
  /** Existing route this capability opens. */
  route: string;
  /** Extra items shown on the card (e.g. task types for Travaux). */
  tags?: string[];
}

export const CAPABILITIES: Capability[] = [
  {
    key: 'conv',
    icon: '💬',
    title: 'Conversation & Professeur IA',
    subtitle: 'Parle avec ton professeur — à l’écrit ou à l’oral.',
    route: '/tutor',
  },
  {
    key: 'lang',
    icon: '🌍',
    title: 'Langues & Immersion',
    subtitle: 'Apprends une langue ou étudie dans une langue étrangère.',
    route: '/languages',
  },
  {
    key: 'course',
    icon: '📖',
    title: 'Cours & Contenu',
    subtitle: 'Une vraie leçon construite pour toi, à ton niveau.',
    route: '/lesson/new',
  },
  {
    key: 'lib',
    icon: '📚',
    title: 'Bibliothèque',
    subtitle: 'Tes documents, prêts à être enseignés.',
    route: '/library',
  },
  {
    key: 'work',
    icon: '🎓',
    title: 'Travaux',
    subtitle: 'Academic Workspace — TP, devoirs, rapports, projets.',
    route: '/library',
    tags: ['TP', 'Devoir', 'Rapport', 'Projet', 'Mémoire', 'Dissertation', 'Étude de cas', 'Exercice', 'Examen'],
  },
  {
    key: 'eval',
    icon: '📝',
    title: 'Évaluations & Examens',
    subtitle: 'Quiz, exercices, examens blancs — à partir de ce que tu étudies.',
    route: '/examiner',
  },
];

// ── Pedagogical modes (4.1) ──────────────────────────────────────────────────
export type ModeKey = 'teach' | 'explain' | 'discuss' | 'oralex' | 'oralexam' | 'guided';

export interface TeachingMode {
  key: ModeKey;
  icon: string;
  label: string;
  desc: string;
  route: string;
  /** Passed to the destination so it can honour the mode later. */
  mode: string;
  /** Voice-first mode. */
  oral?: boolean;
}

export const MODES: TeachingMode[] = [
  { key: 'teach', icon: '👨‍🏫', label: 'Enseigner', desc: 'Le professeur construit une véritable leçon.', route: '/lesson/new', mode: 'teach' },
  { key: 'explain', icon: '💡', label: 'Expliquer', desc: '« Explique-moi ça » — au niveau défini par ton profil.', route: '/tutor', mode: 'explain' },
  { key: 'discuss', icon: '💬', label: 'Discuter', desc: 'Conversation pédagogique libre.', route: '/tutor', mode: 'discuss' },
  { key: 'oralex', icon: '🎙️', label: 'Exercice oral', desc: 'Le professeur pose des questions et évalue tes réponses.', route: '/tutor', mode: 'oral_exercise', oral: true },
  { key: 'oralexam', icon: '🎓', label: 'Examen oral', desc: 'Le professeur devient examinateur.', route: '/examiner', mode: 'oral_exam', oral: true },
  { key: 'guided', icon: '🧭', label: 'Session guidée', desc: 'Le système construit une séance complète.', route: '/daily-session', mode: 'guided' },
];

// ── Universal entry (4, convergence) ─────────────────────────────────────────
export interface StartEntry {
  key: 'write' | 'speak' | 'drop' | 'scan';
  icon: string;
  label: string;
  route: string;
}

export const START_ENTRIES: StartEntry[] = [
  { key: 'write', icon: '✍️', label: 'Écrire', route: '/tutor' },
  { key: 'speak', icon: '🎤', label: 'Parler', route: '/tutor' },
  { key: 'drop', icon: '📎', label: 'Déposer un document', route: '/library' },
  { key: 'scan', icon: '📷', label: 'Scanner', route: '/scan' },
];

/** Ingestion sources (4.2). */
export const SOURCES: { icon: string; label: string }[] = [
  { icon: '📄', label: 'PDF' },
  { icon: '📸', label: 'Photo' },
  { icon: '📷', label: 'Scan' },
  { icon: '📚', label: 'Livre' },
  { icon: '📓', label: 'Cahier' },
  { icon: '📝', label: 'Note' },
  { icon: '💻', label: 'Code' },
  { icon: '🎤', label: 'Audio' },
];

// ── KYC personalisation (4 — adaptation) ─────────────────────────────────────
export interface LearnPersona {
  /** Capability order, most-relevant first for this learner. */
  order: CapabilityKey[];
  /** Which mode leads the selector. */
  primaryMode: ModeKey;
  /** A denser, more academic framing (vs a lighter, more visual one). */
  academic: boolean;
  intro: string;
}

export function learnPersona(category?: LearningCategory | null): LearnPersona {
  switch (category) {
    case 'kindergarten':
    case 'primary':
      return {
        order: ['conv', 'course', 'lang', 'lib', 'eval', 'work'],
        primaryMode: 'teach',
        academic: false,
        intro: 'Dépose une photo ou pose une question — on apprend ensemble.',
      };
    case 'secondary':
    case 'highschool':
      return {
        order: ['course', 'conv', 'eval', 'lib', 'work', 'lang'],
        primaryMode: 'teach',
        academic: true,
        intro: 'Tes cours, tes exercices, tes examens — commence par ce que tu veux travailler.',
      };
    case 'university':
      return {
        order: ['lib', 'work', 'course', 'conv', 'eval', 'lang'],
        primaryMode: 'explain',
        academic: true,
        intro: 'Dépose un document ou un travail, et ton professeur prend le relais.',
      };
    case 'research':
      return {
        order: ['lib', 'conv', 'work', 'course', 'eval', 'lang'],
        primaryMode: 'discuss',
        academic: true,
        intro: 'Tes sources et tes travaux — analyse-les avec ton professeur.',
      };
    case 'language':
      return {
        order: ['lang', 'conv', 'course', 'lib', 'eval', 'work'],
        primaryMode: 'discuss',
        academic: false,
        intro: 'Conversation, prononciation, vocabulaire — ta langue commence ici.',
      };
    default:
      return {
        order: ['conv', 'course', 'lib', 'lang', 'work', 'eval'],
        primaryMode: 'explain',
        academic: false,
        intro: 'Tout ce que tu veux apprendre, comprendre ou travailler commence ici.',
      };
  }
}
