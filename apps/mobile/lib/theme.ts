/** Legacy palette bridge.
 *
 *  The 60+ screens not yet migrated to the design-token system (`lib/design`)
 *  read their colours from this flat object. To make the WHOLE app read as one
 *  product without rewriting every screen, these values are re-pointed to the
 *  design system's DARK role palette (see `lib/design/tokens.ts` → darkColors):
 *  same keys, new premium warm-dark values + indigo/violet brand. Screens keep
 *  working unchanged; they just look like the new design.
 *
 *  Full light/dark per-screen support still requires migrating a screen to
 *  `useTokens()` (design-system theme). This bridge harmonises dark mode now. */
export const theme = {
  bg: '#0F0F13', // darkColors.background (n950)
  surface: '#141419', // darkColors.surface (n900)
  surfaceAlt: '#1C1C22', // darkColors.surfaceElevated (n850)
  border: '#26262E', // darkColors.border (n800)
  text: '#F5F5F4', // darkColors.textPrimary
  textMuted: '#9C9CA6', // darkColors.textSecondary (n400)
  textFaint: '#6E6E7A', // darkColors.textMuted (n500)
  accent: '#6366F1', // darkColors.primary (indigo500)
  accentText: '#FFFFFF', // darkColors.onPrimary
  ok: '#34D399', // darkColors.success (emerald400)
  okBg: '#0E2A22', // darkColors.successSoft
  warn: '#FBBF24', // darkColors.warning (amber400)
  danger: '#FB7185', // darkColors.error (rose400)
  dangerBg: '#2E1519', // darkColors.errorSoft
} as const;
