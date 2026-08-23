/**
 * Second Brain — Design Tokens (UI/UX Sprint 1).
 *
 * The single source of truth for the visual language. Nothing arbitrary lives in
 * components: every colour, size, radius, shadow and duration comes from here, so
 * the same language scales across Accueil / Apprendre / Mon Cerveau / Réviser /
 * Profil, and across mobile / tablet / desktop.
 *
 * Identity: premium · intelligent · human · calm. Primary is a calm indigo
 * (intelligence, trust); the AI Accent is a distinct violet reserved for the AI
 * Professor's presence (often as an indigo→violet gradient). Neutrals are
 * warm-tinted, not cold, for a human, unclinical feel.
 *
 * Colours are values, not roles, on `palette`; the light/dark ROLE maps below map
 * roles → values so components only ever reference roles. Contrast for text roles
 * on their intended backgrounds meets WCAG AA (≥4.5:1 body, ≥3:1 large/UI).
 */

// ── raw palette (warm-tinted neutrals + brand + semantic) ────────────────────
const palette = {
  // Warm neutral ramp
  n0: '#FFFFFF',
  n50: '#FAFAF9',
  n100: '#F3F3F1',
  n150: '#EAEAE7',
  n200: '#DEDEDA',
  n300: '#C4C4BE',
  n400: '#9C9CA6',
  n500: '#6E6E7A',
  n600: '#54545F',
  n700: '#3A3A44',
  n800: '#26262E',
  n850: '#1C1C22',
  n900: '#141419',
  n950: '#0F0F13',

  // Brand — calm indigo
  indigo300: '#A5B4FC',
  indigo400: '#818CF8',
  indigo500: '#6366F1',
  indigo600: '#4F46E5',
  indigo700: '#4338CA',

  // AI accent — violet (the Professor's presence)
  violet300: '#C4B5FD',
  violet400: '#A78BFA',
  violet500: '#8B5CF6',
  violet600: '#7C3AED',

  // Semantic
  emerald400: '#34D399',
  emerald500: '#10B981',
  emerald600: '#059669',
  amber400: '#FBBF24',
  amber500: '#F59E0B',
  amber600: '#D97706',
  rose400: '#FB7185',
  rose500: '#F43F5E',
  rose600: '#E11D48',
  sky400: '#38BDF8',
  sky500: '#0EA5E9',
  sky600: '#0284C7',
} as const;

export type ColorRole =
  | 'primary' | 'primaryHover' | 'onPrimary'
  | 'aiAccent' | 'aiAccentSoft' | 'onAiAccent'
  | 'success' | 'warning' | 'error' | 'info'
  | 'successSoft' | 'warningSoft' | 'errorSoft' | 'infoSoft'
  | 'background' | 'surface' | 'surfaceElevated' | 'surfaceSunken'
  | 'textPrimary' | 'textSecondary' | 'textMuted' | 'onColor'
  | 'border' | 'borderSubtle' | 'borderStrong' | 'focus'
  | 'overlay';

export type ColorScale = Record<ColorRole, string>;

export const lightColors: ColorScale = {
  primary: palette.indigo600,
  primaryHover: palette.indigo700,
  onPrimary: palette.n0,
  aiAccent: palette.violet500,
  aiAccentSoft: '#F1ECFE',
  onAiAccent: palette.n0,
  success: palette.emerald600,
  warning: palette.amber600,
  error: palette.rose600,
  info: palette.sky600,
  successSoft: '#E7F7F0',
  warningSoft: '#FdF3E3',
  errorSoft: '#FDE9EC',
  infoSoft: '#E6F4FD',
  background: palette.n50,
  surface: palette.n0,
  surfaceElevated: palette.n0,
  surfaceSunken: palette.n100,
  textPrimary: '#17171C',
  textSecondary: palette.n600,
  textMuted: palette.n500,
  onColor: palette.n0,
  border: palette.n200,
  borderSubtle: palette.n150,
  borderStrong: palette.n300,
  focus: palette.indigo500,
  overlay: 'rgba(20,20,25,0.45)',
};

export const darkColors: ColorScale = {
  primary: palette.indigo500,
  primaryHover: palette.indigo400,
  onPrimary: palette.n0,
  aiAccent: palette.violet400,
  aiAccentSoft: '#241B3A',
  onAiAccent: palette.n950,
  success: palette.emerald400,
  warning: palette.amber400,
  error: palette.rose400,
  info: palette.sky400,
  successSoft: '#0E2A22',
  warningSoft: '#2C2211',
  errorSoft: '#2E1519',
  infoSoft: '#0C2433',
  background: palette.n950,
  surface: palette.n900,
  surfaceElevated: palette.n850,
  surfaceSunken: palette.n950,
  textPrimary: '#F5F5F4',
  textSecondary: palette.n400,
  textMuted: palette.n500,
  onColor: palette.n0,
  border: palette.n800,
  borderSubtle: palette.n850,
  borderStrong: palette.n700,
  focus: palette.indigo400,
  overlay: 'rgba(0,0,0,0.6)',
};

// ── AI Professor gradient (the recognizable "intelligence present" mark) ─────
export const aiGradient = {
  light: [palette.indigo600, palette.violet500] as [string, string],
  dark: [palette.indigo500, palette.violet400] as [string, string],
};

// ── typography — one hierarchy readable without colour or icons ──────────────
export interface TypeStyle {
  fontSize: number;
  fontWeight: '400' | '500' | '600' | '700' | '800';
  lineHeight: number;
  letterSpacing: number;
}
export type TypeName =
  | 'display' | 'h1' | 'h2' | 'h3' | 'title'
  | 'bodyLarge' | 'body' | 'bodySmall' | 'caption' | 'label';

/** Style-only map — directly spreadable into a Text style. */
export const typography: Record<TypeName, TypeStyle> = {
  display: { fontSize: 40, fontWeight: '800', lineHeight: 46, letterSpacing: -0.5 },
  h1: { fontSize: 30, fontWeight: '700', lineHeight: 36, letterSpacing: -0.3 },
  h2: { fontSize: 24, fontWeight: '700', lineHeight: 30, letterSpacing: -0.2 },
  h3: { fontSize: 19, fontWeight: '700', lineHeight: 25, letterSpacing: -0.1 },
  title: { fontSize: 16, fontWeight: '600', lineHeight: 22, letterSpacing: 0 },
  bodyLarge: { fontSize: 17, fontWeight: '400', lineHeight: 26, letterSpacing: 0 },
  body: { fontSize: 15, fontWeight: '400', lineHeight: 22, letterSpacing: 0 },
  bodySmall: { fontSize: 13, fontWeight: '400', lineHeight: 19, letterSpacing: 0 },
  caption: { fontSize: 12, fontWeight: '500', lineHeight: 16, letterSpacing: 0.2 },
  label: { fontSize: 11, fontWeight: '700', lineHeight: 14, letterSpacing: 0.8 },
};

/** When to use each level (kept separate so `typography` stays style-only). */
export const typographyUsage: Record<TypeName, string> = {
  display: 'Hero / one big statement per screen',
  h1: 'Screen title',
  h2: 'Section title',
  h3: 'Sub-section / card title',
  title: 'List item / control title',
  bodyLarge: 'Lead paragraph, AI messages',
  body: 'Default paragraph text',
  bodySmall: 'Secondary text, help',
  caption: 'Meta, timestamps',
  label: 'Uppercase section labels',
};

// ── spacing — one 4-based scale; components use only these ────────────────────
export const spacing = {
  none: 0,
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 40,
  xxxl: 48,
  huge: 64,
  giant: 80,
} as const;

// ── radius ────────────────────────────────────────────────────────────────
export const radius = { xs: 6, sm: 10, md: 14, lg: 20, xl: 28, full: 999 } as const;

// ── borders (widths; the colour comes from the border* roles) ────────────────
export const borderWidth = { subtle: 1, default: 1, strong: 1.5, focus: 2 } as const;

// ── elevation (RN shadow + web boxShadow; used sparingly — no card soup) ──────
export interface Elevation {
  shadowColor: string;
  shadowOpacity: number;
  shadowRadius: number;
  shadowOffset: { width: number; height: number };
  elevation: number; // Android
  /** Pre-baked web box-shadow. */
  boxShadow: string;
}
export const elevation: Record<'none' | 'low' | 'medium' | 'high', Elevation> = {
  none: { shadowColor: '#000', shadowOpacity: 0, shadowRadius: 0, shadowOffset: { width: 0, height: 0 }, elevation: 0, boxShadow: 'none' },
  low: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2, boxShadow: '0 2px 6px rgba(0,0,0,0.06)' },
  medium: { shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 6, boxShadow: '0 6px 16px rgba(0,0,0,0.10)' },
  high: { shadowColor: '#000', shadowOpacity: 0.16, shadowRadius: 32, shadowOffset: { width: 0, height: 14 }, elevation: 14, boxShadow: '0 14px 32px rgba(0,0,0,0.16)' },
};

// ── motion — a language, not decoration (an animation must explain something) ─
export const motion = {
  duration: { fast: 140, normal: 220, slow: 360 },
  easing: {
    standard: 'cubic-bezier(0.2, 0, 0, 1)',
    enter: 'cubic-bezier(0, 0, 0, 1)',
    exit: 'cubic-bezier(0.3, 0, 1, 1)',
  },
  purpose: ['enter', 'exit', 'transform', 'feedback', 'loading', 'success'] as const,
} as const;

// ── responsive breakpoints (min-widths) ──────────────────────────────────────
export const breakpoints = { mobile: 0, tablet: 600, desktop: 1024, large: 1440 } as const;
export type BreakpointName = keyof typeof breakpoints;

// ── accessibility constants ──────────────────────────────────────────────────
export const a11y = {
  /** Minimum tappable target (pt). */
  minTouchTarget: 44,
  /** Documented contrast targets (WCAG AA). */
  contrast: { bodyText: 4.5, largeText: 3, ui: 3 },
} as const;

export { palette };
