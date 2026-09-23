import {
  RLLE_LANDING_DEMO_BLUEPRINT,
  SUPPORTED_LANGUAGE_CODES,
  SUPPORTED_LANGUAGES,
  type PlanSlug,
  type SupportedLanguageCode,
} from '@second-brain/shared';
import type { TranslationKey } from '../../lib/i18n';

/**
 * Public Landing content contract.
 *
 * Commercial and distribution facts live in this one small registry so the
 * presentation never grows a second, contradictory source of truth. Prices,
 * quotas and store links deliberately stay absent until a real public value is
 * configured. Product examples are static demonstrations, never user data.
 */

export type LandingAnchor =
  | 'product'
  | 'features'
  | 'languages'
  | 'how'
  | 'brain'
  | 'download'
  | 'privacy'
  | 'pricing'
  | 'faq'
  | 'contact';

export const LANDING_NAV_ITEMS: readonly {
  id: LandingAnchor;
  labelKey: TranslationKey;
}[] = [
  { id: 'product', labelKey: 'landing12.nav.product' },
  { id: 'how', labelKey: 'landing12.nav.how' },
  { id: 'languages', labelKey: 'landing12.nav.languages' },
  { id: 'pricing', labelKey: 'landing12.nav.pricing' },
  { id: 'download', labelKey: 'landing12.nav.download' },
  { id: 'faq', labelKey: 'landing12.nav.faq' },
  { id: 'contact', labelKey: 'landing12.nav.contact' },
] as const;

export type ProductStoryStageId =
  | 'documents'
  | 'brain'
  | 'professor'
  | 'oral'
  | 'review'
  | 'workspace';

export const PRODUCT_STORY_STAGES: readonly {
  id: ProductStoryStageId;
  icon: string;
  titleKey: TranslationKey;
  shortKey: TranslationKey;
  descriptionKey: TranslationKey;
}[] = [
  { id: 'documents', icon: '▤', titleKey: 'landing12.story.documents.title', shortKey: 'landing12.story.documents.short', descriptionKey: 'landing12.story.documents.desc' },
  { id: 'brain', icon: '◉', titleKey: 'landing12.story.brain.title', shortKey: 'landing12.story.brain.short', descriptionKey: 'landing12.story.brain.desc' },
  { id: 'professor', icon: '✦', titleKey: 'landing12.story.professor.title', shortKey: 'landing12.story.professor.short', descriptionKey: 'landing12.story.professor.desc' },
  { id: 'oral', icon: '●', titleKey: 'landing12.story.oral.title', shortKey: 'landing12.story.oral.short', descriptionKey: 'landing12.story.oral.desc' },
  { id: 'review', icon: '↻', titleKey: 'landing12.story.review.title', shortKey: 'landing12.story.review.short', descriptionKey: 'landing12.story.review.desc' },
  { id: 'workspace', icon: '⌁', titleKey: 'landing12.story.workspace.title', shortKey: 'landing12.story.workspace.short', descriptionKey: 'landing12.story.workspace.desc' },
] as const;

export type CapabilityId =
  | 'brain'
  | 'professor'
  | 'learn'
  | 'documents'
  | 'review'
  | 'research'
  | 'workspace'
  | 'languages'
  | 'voice'
  | 'next';

export const LANDING_CAPABILITIES: readonly {
  id: CapabilityId;
  icon: string;
  titleKey: TranslationKey;
  descriptionKey: TranslationKey;
  group: 'personal' | 'understand' | 'practice' | 'produce';
}[] = [
  { id: 'brain', icon: '◉', titleKey: 'landing12.feature.brain.title', descriptionKey: 'landing12.feature.brain.desc', group: 'personal' },
  { id: 'professor', icon: '✦', titleKey: 'landing12.feature.professor.title', descriptionKey: 'landing12.feature.professor.desc', group: 'personal' },
  { id: 'learn', icon: '＋', titleKey: 'landing12.feature.learn.title', descriptionKey: 'landing12.feature.learn.desc', group: 'understand' },
  { id: 'documents', icon: '▤', titleKey: 'landing12.feature.documents.title', descriptionKey: 'landing12.feature.documents.desc', group: 'understand' },
  { id: 'research', icon: '⌕', titleKey: 'landing12.feature.research.title', descriptionKey: 'landing12.feature.research.desc', group: 'understand' },
  { id: 'review', icon: '↻', titleKey: 'landing12.feature.review.title', descriptionKey: 'landing12.feature.review.desc', group: 'practice' },
  { id: 'languages', icon: '文', titleKey: 'landing12.feature.languages.title', descriptionKey: 'landing12.feature.languages.desc', group: 'practice' },
  { id: 'voice', icon: '●', titleKey: 'landing12.feature.voice.title', descriptionKey: 'landing12.feature.voice.desc', group: 'practice' },
  { id: 'workspace', icon: '⌁', titleKey: 'landing12.feature.workspace.title', descriptionKey: 'landing12.feature.workspace.desc', group: 'produce' },
  { id: 'next', icon: '→', titleKey: 'landing12.feature.next.title', descriptionKey: 'landing12.feature.next.desc', group: 'produce' },
] as const;

export const CAPABILITY_GROUPS = ['personal', 'understand', 'practice', 'produce'] as const;

export type PublicPlatformId = 'web' | 'android' | 'ios' | 'windows' | 'macos';
export type PublicPlatformStatus = 'available' | 'prepared' | 'coming-soon';

/** Store URLs are null because none exists in the repository or public config. */
export const PUBLIC_PLATFORMS: readonly {
  id: PublicPlatformId;
  icon: string;
  status: PublicPlatformStatus;
  href: string | null;
}[] = [
  { id: 'web', icon: '◎', status: 'available', href: '/sign-in' },
  { id: 'android', icon: '▯', status: 'prepared', href: null },
  { id: 'ios', icon: '▯', status: 'prepared', href: null },
  { id: 'windows', icon: '▣', status: 'coming-soon', href: null },
  { id: 'macos', icon: '▣', status: 'coming-soon', href: null },
] as const;

export type PublicPlanId = 'free' | 'pro' | 'max';

/**
 * The slugs map to the real backend catalog. Commercial fields intentionally do
 * not live here: the authenticated `/plans` endpoint remains authoritative.
 */
export const PUBLIC_PLAN_PRESENTATION: readonly {
  id: PublicPlanId;
  backendSlug: PlanSlug;
  commercialDetails: 'known-free' | 'pending-public-beta';
}[] = [
  { id: 'free', backendSlug: 'free', commercialDetails: 'known-free' },
  { id: 'pro', backendSlug: 'pro', commercialDetails: 'pending-public-beta' },
  { id: 'max', backendSlug: 'pro_max', commercialDetails: 'pending-public-beta' },
] as const;

export const CONTACT_TOPICS = [
  'general',
  'technical',
  'billing',
  'privacy',
  'problem',
  'feedback',
] as const;

export const FAQ_ITEMS = Array.from({ length: 12 }, (_, index) => index + 1);

export const RLLE_PUBLIC_DEMO = RLLE_LANDING_DEMO_BLUEPRINT;

export interface PublicLanguageOption {
  code: SupportedLanguageCode;
  nativeName: string;
  displayName: string;
  symbol: string;
  rtl: boolean;
}

/** Native name + localized UI name carry meaning; flags stay decorative. */
export function publicLanguageOptions(locale: string): PublicLanguageOption[] {
  let displayNames: Intl.DisplayNames | null = null;
  try {
    displayNames = new Intl.DisplayNames([locale], { type: 'language' });
  } catch {
    displayNames = null;
  }
  return SUPPORTED_LANGUAGE_CODES.map((code) => {
    const meta = SUPPORTED_LANGUAGES[code];
    return {
      code,
      nativeName: meta.name,
      displayName: displayNames?.of(code) ?? meta.englishName,
      symbol: meta.neutralIcon ? '◉' : meta.flag,
      rtl: Boolean(meta.rtl),
    };
  });
}

/** Optional public support address. Empty means the UI must stay non-sending. */
export const PUBLIC_SUPPORT_EMAIL = process.env.EXPO_PUBLIC_SUPPORT_EMAIL?.trim() || null;
