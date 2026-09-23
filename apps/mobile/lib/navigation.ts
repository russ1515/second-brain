import {
  routeMetadataFor,
  safeAuthenticatedReturnPath,
  type ParentSpace,
  type RouteExperienceType,
  type RouteMetadata,
} from '@second-brain/shared';
import type { TranslationKey } from './i18n';
import { featureFlags } from './feature-flags';

export interface PrimarySpaceDefinition {
  space: ParentSpace;
  href: '/' | '/learn' | '/brain' | '/study' | '/profile';
  icon: string;
  labelKey: TranslationKey;
}

export const PRIMARY_SPACES: readonly PrimarySpaceDefinition[] = [
  { space: 'home', href: '/', icon: '🏠', labelKey: 'tab.home' },
  { space: 'learn', href: '/learn', icon: '📚', labelKey: 'tab.learn' },
  { space: 'brain', href: '/brain', icon: '🧠', labelKey: 'tab.brain' },
  { space: 'study', href: '/study', icon: '📅', labelKey: 'tab.study' },
  { space: 'profile', href: '/profile', icon: '👤', labelKey: 'tab.profile' },
] as const;

const TITLE_KEYS: Readonly<Partial<Record<string, TranslationKey>>> = {
  '/': 'tab.home',
  '/learn': 'tab.learn',
  '/brain': 'tab.brain',
  '/study': 'tab.study',
  '/profile': 'tab.profile',
  '/onboarding': 'onb.welcome.title',
  '/lesson/[id]': 'header.lesson',
  '/lesson/new': 'header.newLesson',
  '/tutor': 'header.aiTeacher',
  '/tutor/[id]': 'header.teacher',
  '/homework/[lessonId]': 'header.homework',
  '/session/[id]': 'header.session',
  '/twin-profile': 'twin.title',
  '/memory': 'memory.title',
  '/mastery': 'mastery.title',
  '/graph': 'graph.title',
  '/strengths': 'sw.title',
  '/insights': 'insight.title',
  '/learning-dna': 'dna.title',
  '/insights-center': 'ic.title',
  '/recommendations': 'rec.title',
  '/for-you': 'reco.title',
  '/coach': 'coach.title',
  '/mentorship': 'ment.title',
  '/foresight': 'risk.title',
  '/predictions': 'pred.title',
  '/success': 'succ.title',
  '/daily-session': 'daily.title',
  '/notifications': 'notif.title',
  '/goals': 'goals.title',
  '/exams': 'exams.title',
  '/adaptive-path': 'apath.title',
  '/planner': 'plan.title',
  '/calendar': 'cal.title',
  '/library': 'lib.title',
  '/library/ask': 'lib.ask.title',
  '/research': 'research10.title',
  '/library/[id]': 'header.document',
  '/library/resource/[id]': 'header.resource',
  '/library/workspace/[id]': 'ws.title',
  '/library/workspace': 'workspace10.title',
  '/scan': 'scan.title',
  '/languages': 'header.languages',
  '/languages/[id]': 'header.language',
  '/examiner': 'examiner.title',
  '/examiner/[id]': 'examiner.title',
  '/reading': 'reading.title',
  '/reading/[id]': 'reading.title',
  '/writing': 'writing.title',
  '/writing/[id]': 'writing.title',
  '/revision': 'header.revision',
  '/revision-engine': 'revEng.title',
  '/progress': 'header.progress',
  '/privacy': 'priv.title',
  '/report-problem': 'report.title',
  '/subscription': 'sub.title',
  '/usage': 'usage.title',
  '/language-manager': 'lm.title',
  '/admin': 'admin.title',
  '/organizations': 'org.title',
  '/organizations/[id]': 'org.title',
  '/analytics': 'an.title',
  '/monitoring': 'mon.title',
  '/health': 'health.title',
  '/ai-manager': 'aim.title',
  '/plugins': 'plg.title',
  '/sync': 'sync.title',
  '/design-system': 'shell.designSystem',
};

const EXPERIENCE_TITLE_KEYS: Readonly<Record<RouteExperienceType, TranslationKey>> = {
  home: 'tab.home',
  learning: 'tab.learn',
  brain: 'tab.brain',
  review: 'tab.study',
  profile: 'tab.profile',
  tutor: 'header.aiTeacher',
  research: 'learn.deep.title',
  library: 'lib.title',
  document: 'header.document',
  workspace: 'ws.title',
  language: 'header.languages',
  goal: 'goals.title',
  calendar: 'cal.title',
  auth: 'auth.title',
  admin: 'admin.title',
  technical: 'shell.technicalArea',
  demo: 'shell.demoArea',
  legacy: 'shell.legacyArea',
};

export function primarySpace(space: ParentSpace | null): PrimarySpaceDefinition | undefined {
  return PRIMARY_SPACES.find((entry) => entry.space === space);
}

export function routeTitleKey(metadata: RouteMetadata): TranslationKey {
  return TITLE_KEYS[metadata.path] ?? EXPERIENCE_TITLE_KEYS[metadata.experienceType];
}

/**
 * A single feature flag can be narrowed to metadata paths for a progressive
 * rollout. An empty list means all registered routes; an unknown URL always
 * falls back to the existing Stack chrome.
 */
export function newAppShellEnabledForPath(pathname: string): boolean {
  if (!featureFlags.newAppShell) return false;
  const metadata = routeMetadataFor(pathname);
  if (!metadata || metadata.path === '/sign-in') return false;
  const configured: string | undefined = process.env.EXPO_PUBLIC_NEW_APP_SHELL_ROUTES?.trim();
  if (!configured) return true;
  const allowlist = configured.split(',').map((entry: string) => entry.trim()).filter(Boolean);
  if (allowlist.includes('*')) return true;
  return allowlist.some((entry: string) => routeMetadataFor(entry)?.path === metadata.path);
}

/** Never resume auth/onboarding into an unknown, public or onboarding URL. */
export function safeReturnPath(value?: string | string[]): string {
  const candidate = Array.isArray(value) ? value[0] : value;
  return safeAuthenticatedReturnPath(candidate);
}
