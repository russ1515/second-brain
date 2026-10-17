import type { TranslationKey } from '../../lib/i18n';

/**
 * Public product capability facts used by the unauthenticated experience.
 *
 * This registry describes what Second Brain can honestly advertise today. It
 * intentionally contains no plan limits, prices or provider details: those
 * remain authoritative on the backend and in the authenticated product.
 */

export const PUBLIC_CAPABILITY_STATUSES = [
  'AVAILABLE',
  'BETA',
  'IN_PREPARATION',
  'COMING_SOON',
  'DISABLED',
] as const;

export type PublicCapabilityStatus = (typeof PUBLIC_CAPABILITY_STATUSES)[number];

export type CapabilityId =
  | 'web'
  | 'academicWorkspace'
  | 'pdf'
  | 'markdown'
  | 'professor'
  | 'voice'
  | 'internalResearch'
  | 'groundedWebResearch'
  | 'languages'
  | 'android'
  | 'ios'
  | 'windows'
  | 'macos';

export type PublicCapabilityId = CapabilityId;

export interface PublicCapabilityFact {
  status: PublicCapabilityStatus;
  href: string | null;
}

/**
 * Single frontend source of truth for public availability claims.
 * Links stay null until a real public destination exists.
 */
export const PUBLIC_CAPABILITIES = {
  web: { status: 'AVAILABLE', href: '/signup' },
  academicWorkspace: { status: 'AVAILABLE', href: null },
  pdf: { status: 'AVAILABLE', href: null },
  markdown: { status: 'AVAILABLE', href: null },
  professor: { status: 'AVAILABLE', href: null },
  voice: { status: 'BETA', href: null },
  internalResearch: { status: 'AVAILABLE', href: null },
  groundedWebResearch: { status: 'COMING_SOON', href: null },
  languages: { status: 'AVAILABLE', href: null },
  android: { status: 'IN_PREPARATION', href: null },
  ios: { status: 'IN_PREPARATION', href: null },
  windows: { status: 'COMING_SOON', href: null },
  macos: { status: 'COMING_SOON', href: null },
} as const satisfies Record<PublicCapabilityId, PublicCapabilityFact>;

export const PUBLIC_STATUS_LABEL_KEYS = {
  AVAILABLE: 'landing12.platform.status.available',
  BETA: 'landingV1.status.beta',
  IN_PREPARATION: 'landingV1.status.inPreparation',
  COMING_SOON: 'soon.badge',
  DISABLED: 'sub.notAvailable',
} as const satisfies Record<PublicCapabilityStatus, TranslationKey>;

export const PUBLIC_STATUS_DETAIL_KEYS = {
  AVAILABLE: 'landing12.platform.status.available',
  BETA: 'landing12.footer.beta',
  IN_PREPARATION: 'landingV1.status.mobilePreparationDetail',
  COMING_SOON: 'landing12.platform.status.coming-soon',
  DISABLED: 'sub.notAvailable',
} as const satisfies Record<PublicCapabilityStatus, TranslationKey>;

export function capability(id: CapabilityId): PublicCapabilityFact {
  return PUBLIC_CAPABILITIES[id];
}

export function publicStatusLabelKey(status: PublicCapabilityStatus): TranslationKey {
  return PUBLIC_STATUS_LABEL_KEYS[status];
}

export function publicStatusDetailKey(status: PublicCapabilityStatus): TranslationKey {
  return PUBLIC_STATUS_DETAIL_KEYS[status];
}

/**
 * Compact, localized label for public badges. Some legacy translations include
 * a truthful explanatory suffix after a middle dot or semicolon; compact badges
 * keep the localized status while the surrounding section carries the detail.
 */
export function publicStatusLabel(
  status: PublicCapabilityStatus,
  translate: (key: TranslationKey) => string,
): string {
  return translate(publicStatusLabelKey(status)).split(/[·;]/u, 1)[0]?.trim() ?? status;
}
