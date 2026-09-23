import type { ContextKind } from './context';

export type ParentSpace = 'home' | 'learn' | 'brain' | 'study' | 'profile';
export type RouteCategory = 'USER' | 'ADMIN' | 'TECH' | 'DEMO' | 'LEGACY';
export type RouteShellMode = 'primary' | 'secondary' | 'focused' | 'hidden';
export type RouteComposerMode = 'none' | 'universal' | 'contextual';
export type RouteExperienceType =
  | 'home'
  | 'learning'
  | 'brain'
  | 'review'
  | 'profile'
  | 'tutor'
  | 'research'
  | 'library'
  | 'document'
  | 'workspace'
  | 'language'
  | 'goal'
  | 'calendar'
  | 'auth'
  | 'admin'
  | 'technical'
  | 'demo'
  | 'legacy';

export interface RouteMetadata {
  path: string;
  parentSpace: ParentSpace | null;
  experienceType: RouteExperienceType;
  shellMode: RouteShellMode;
  immersive: boolean;
  permissions: string[];
  requiresAuth: boolean;
  allowedContexts: ContextKind[];
  composerMode: RouteComposerMode;
  resumable: boolean;
  category: RouteCategory;
}

type RouteDefaults = Omit<RouteMetadata, 'path' | 'parentSpace' | 'experienceType'>;

const DEFAULT_USER_ROUTE: RouteDefaults = {
  shellMode: 'secondary',
  immersive: false,
  permissions: [],
  requiresAuth: true,
  allowedContexts: [],
  composerMode: 'none',
  resumable: false,
  category: 'USER',
};

function route(
  path: string,
  parentSpace: ParentSpace | null,
  experienceType: RouteExperienceType,
  overrides: Partial<RouteDefaults> = {},
): RouteMetadata {
  return { path, parentSpace, experienceType, ...DEFAULT_USER_ROUTE, ...overrides };
}

const objectContexts: ContextKind[] = [
  'brain', 'document', 'document-collection', 'concept', 'lesson', 'goal', 'exam',
  'language', 'workspace', 'tutor-session', 'research', 'revision', 'learning-path',
];

/**
 * Central inventory of every current Expo route. URLs stay unchanged; category
 * and shell metadata let future lots reposition them without deleting them.
 */
export const ROUTE_METADATA: readonly RouteMetadata[] = [
  route('/', 'home', 'home', { shellMode: 'primary', requiresAuth: false, allowedContexts: objectContexts, composerMode: 'universal' }),
  route('/learn', 'learn', 'learning', { shellMode: 'primary', allowedContexts: objectContexts, composerMode: 'universal' }),
  route('/brain', 'brain', 'brain', { shellMode: 'primary', allowedContexts: ['brain', 'concept', 'document', 'learning-path', 'language'], composerMode: 'contextual' }),
  route('/study', 'study', 'review', { shellMode: 'primary', allowedContexts: ['revision', 'concept', 'exam', 'goal', 'learning-path'] }),
  route('/profile', 'profile', 'profile', { shellMode: 'primary', allowedContexts: ['user-profile', 'language'] }),

  route('/sign-in', null, 'auth', { shellMode: 'hidden', requiresAuth: false }),
  route('/onboarding', 'profile', 'profile', { shellMode: 'focused', immersive: true, allowedContexts: ['user-profile', 'goal', 'language'] }),
  route('/lesson/[id]', 'learn', 'learning', { allowedContexts: ['lesson', 'concept', 'document', 'goal'], composerMode: 'contextual', resumable: true }),
  route('/lesson/new', 'learn', 'learning', { allowedContexts: ['concept', 'document', 'goal'], composerMode: 'contextual' }),
  route('/tutor', 'learn', 'tutor', { allowedContexts: objectContexts, composerMode: 'contextual' }),
  route('/tutor/[id]', 'learn', 'tutor', { shellMode: 'focused', immersive: true, allowedContexts: objectContexts, composerMode: 'contextual', resumable: true }),
  route('/homework/[lessonId]', 'learn', 'learning', { allowedContexts: ['lesson', 'concept', 'goal'], resumable: true }),
  route('/session/[id]', 'study', 'learning', { shellMode: 'focused', immersive: true, allowedContexts: objectContexts, composerMode: 'contextual', resumable: true }),

  route('/twin-profile', 'brain', 'brain', { allowedContexts: ['brain', 'concept', 'learning-path'] }),
  route('/memory', 'brain', 'brain', { allowedContexts: ['brain', 'concept', 'revision'] }),
  route('/mastery', 'brain', 'brain', { allowedContexts: ['brain', 'concept'] }),
  route('/graph', 'brain', 'brain', { allowedContexts: ['brain', 'concept', 'document'] }),
  route('/strengths', 'brain', 'brain', { allowedContexts: ['brain', 'concept'] }),
  route('/insights', 'brain', 'brain', { allowedContexts: ['brain', 'concept', 'goal'] }),
  route('/learning-dna', 'brain', 'brain', { allowedContexts: ['brain', 'user-profile'] }),
  route('/insights-center', 'brain', 'brain', { allowedContexts: ['brain', 'concept', 'goal', 'exam'] }),

  route('/recommendations', 'home', 'home', { allowedContexts: objectContexts }),
  route('/for-you', 'home', 'home', { allowedContexts: objectContexts }),
  route('/coach', 'home', 'goal', { allowedContexts: ['goal', 'exam', 'learning-path', 'revision'] }),
  route('/mentorship', 'home', 'goal', { allowedContexts: ['goal', 'exam', 'learning-path'] }),
  route('/foresight', 'brain', 'brain', { allowedContexts: ['goal', 'exam', 'brain', 'learning-path'] }),
  route('/predictions', 'brain', 'brain', { allowedContexts: ['goal', 'exam', 'brain'] }),
  route('/success', 'home', 'goal', { allowedContexts: ['goal', 'exam', 'brain'] }),
  route('/daily-session', 'home', 'learning', { allowedContexts: objectContexts, resumable: true }),
  route('/notifications', 'home', 'home'),
  route('/goals', 'home', 'goal', { allowedContexts: ['goal', 'exam', 'learning-path'] }),
  route('/exams', 'home', 'goal', { allowedContexts: ['exam', 'goal', 'revision'] }),
  route('/adaptive-path', 'home', 'goal', { allowedContexts: ['learning-path', 'goal', 'concept'], resumable: true }),
  route('/planner', 'home', 'calendar', { allowedContexts: ['goal', 'exam', 'learning-path', 'revision'] }),
  route('/calendar', 'home', 'calendar', { allowedContexts: ['goal', 'exam', 'learning-path', 'revision'] }),

  route('/library', 'learn', 'library', { allowedContexts: ['document', 'document-collection', 'concept'], composerMode: 'contextual' }),
  route('/library/ask', 'learn', 'research', { allowedContexts: ['document', 'document-collection', 'concept', 'research'], composerMode: 'contextual', resumable: true }),
  route('/research', 'learn', 'research', { allowedContexts: ['brain', 'document', 'document-collection', 'concept', 'research', 'workspace'], composerMode: 'contextual', resumable: true }),
  route('/library/[id]', 'learn', 'document', { allowedContexts: ['document', 'concept', 'goal'], composerMode: 'contextual' }),
  route('/library/resource/[id]', 'learn', 'document', { allowedContexts: ['document', 'lesson', 'concept'] }),
  route('/library/workspace/[id]', 'learn', 'workspace', { shellMode: 'focused', immersive: true, allowedContexts: ['workspace', 'document', 'document-collection', 'research', 'goal'], composerMode: 'contextual', resumable: true }),
  route('/library/workspace', 'learn', 'workspace', { allowedContexts: ['workspace', 'document', 'document-collection', 'research', 'goal'], composerMode: 'contextual', resumable: true }),
  route('/scan', 'learn', 'document', { shellMode: 'focused', immersive: true, allowedContexts: ['document', 'goal'] }),
  route('/languages', 'learn', 'language', { allowedContexts: ['language', 'goal'] }),
  route('/languages/[id]', 'learn', 'language', { allowedContexts: ['language', 'goal', 'lesson', 'tutor-session'], composerMode: 'contextual', resumable: true }),
  route('/languages/[id]/course', 'learn', 'language', { allowedContexts: ['language', 'goal', 'lesson', 'tutor-session', 'revision'], composerMode: 'contextual', resumable: true }),
  route('/languages/[id]/course/lesson', 'learn', 'language', { allowedContexts: ['language', 'goal', 'lesson', 'tutor-session', 'revision'], composerMode: 'contextual', resumable: true }),
  route('/languages/[id]/course/missions', 'learn', 'language', { allowedContexts: ['language', 'goal', 'tutor-session', 'revision'], composerMode: 'contextual', resumable: true }),
  route('/languages/[id]/course/can-do', 'learn', 'language', { allowedContexts: ['language', 'goal', 'tutor-session', 'revision'], resumable: true }),
  route('/examiner', 'learn', 'learning', { allowedContexts: ['exam', 'lesson', 'concept', 'goal'] }),
  route('/examiner/[id]', 'learn', 'learning', { allowedContexts: ['exam', 'lesson', 'concept', 'goal'], resumable: true }),
  route('/reading', 'learn', 'learning', { allowedContexts: ['document', 'concept', 'goal'] }),
  route('/reading/[id]', 'learn', 'learning', { allowedContexts: ['document', 'concept', 'goal'], resumable: true }),
  route('/writing', 'learn', 'workspace', { allowedContexts: ['workspace', 'document', 'goal'] }),
  route('/writing/[id]', 'learn', 'workspace', { allowedContexts: ['workspace', 'document', 'goal'], composerMode: 'contextual', resumable: true }),

  route('/revision', 'study', 'review', { allowedContexts: ['revision', 'concept', 'document', 'exam', 'goal', 'language'], resumable: true }),
  route('/revision-engine', 'study', 'legacy', { allowedContexts: ['revision', 'concept'], category: 'LEGACY' }),
  route('/progress', 'study', 'review', { allowedContexts: ['revision', 'concept', 'goal', 'exam'] }),

  route('/privacy', 'profile', 'profile', { allowedContexts: ['user-profile'] }),
  route('/report-problem', 'profile', 'profile', { allowedContexts: ['user-profile'] }),
  route('/subscription', 'profile', 'profile', { allowedContexts: ['user-profile'] }),
  route('/usage', 'profile', 'profile', { allowedContexts: ['user-profile'] }),
  route('/language-manager', 'profile', 'profile', { allowedContexts: ['user-profile', 'language'] }),

  route('/admin', null, 'admin', { shellMode: 'hidden', permissions: ['admin'], category: 'ADMIN' }),
  route('/organizations', null, 'admin', { shellMode: 'hidden', permissions: ['organization:read'], category: 'ADMIN' }),
  route('/organizations/[id]', null, 'admin', { shellMode: 'hidden', permissions: ['organization:read'], category: 'ADMIN' }),
  route('/analytics', null, 'admin', { shellMode: 'hidden', permissions: ['admin'], category: 'ADMIN' }),
  route('/monitoring', null, 'technical', { shellMode: 'hidden', permissions: ['admin'], category: 'TECH' }),
  route('/health', null, 'technical', { shellMode: 'hidden', category: 'TECH' }),
  route('/ai-manager', null, 'technical', { shellMode: 'hidden', permissions: ['admin'], category: 'TECH' }),
  route('/plugins', null, 'technical', { shellMode: 'hidden', permissions: ['admin'], category: 'TECH' }),
  route('/sync', null, 'technical', { shellMode: 'hidden', category: 'TECH' }),
  route('/design-system', null, 'demo', { shellMode: 'hidden', category: 'DEMO' }),
] as const;

/**
 * Resolve metadata for either a registered template (`/lesson/[id]`) or a
 * concrete Expo pathname (`/lesson/clx123`). Static routes win before dynamic
 * templates, so `/lesson/new` can never be mistaken for `/lesson/[id]`.
 * Query strings, hashes and trailing slashes are ignored deliberately: they do
 * not change the experience or its shell contract.
 */
export function routeMetadataFor(path: string): RouteMetadata | undefined {
  const normalized = normalizeRoutePath(path);
  const exact = ROUTE_METADATA.find((entry) => entry.path === normalized);
  if (exact) return exact;
  return ROUTE_METADATA.find((entry) => routeTemplateMatches(entry.path, normalized));
}

export function normalizeRoutePath(path: string): string {
  const withoutQuery = path.trim().split(/[?#]/, 1)[0] ?? '';
  if (!withoutQuery || withoutQuery === '/') return '/';
  const withLeadingSlash = withoutQuery.startsWith('/') ? withoutQuery : `/${withoutQuery}`;
  return withLeadingSlash.replace(/\/{2,}/g, '/').replace(/\/$/, '');
}

export function routeTemplateMatches(template: string, concretePath: string): boolean {
  const templateSegments = normalizeRoutePath(template).split('/').filter(Boolean);
  const pathSegments = normalizeRoutePath(concretePath).split('/').filter(Boolean);
  if (templateSegments.length !== pathSegments.length) return false;
  return templateSegments.every((segment, index) => {
    if (/^\[[^/]+\]$/.test(segment)) return pathSegments[index].length > 0;
    return segment === pathSegments[index];
  });
}

/**
 * Validate a post-authentication destination against the route registry. The
 * returned value is always an internal normalized path; unknown, public and
 * onboarding destinations fall back to Home.
 */
export function safeAuthenticatedReturnPath(candidate?: string | null): string {
  if (!candidate) return '/';
  const metadata = routeMetadataFor(candidate);
  if (!metadata?.requiresAuth || metadata.path === '/onboarding') return '/';
  const trimmed = candidate.trim();
  const suffixIndex = trimmed.search(/[?#]/);
  const suffix = suffixIndex >= 0 ? trimmed.slice(suffixIndex) : '';
  return `${normalizeRoutePath(trimmed)}${suffix}`;
}

export function validateRouteMetadataRegistry(
  routes: readonly RouteMetadata[] = ROUTE_METADATA,
): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const metadata of routes) {
    if (seen.has(metadata.path)) errors.push(`Duplicate route metadata: ${metadata.path}`);
    seen.add(metadata.path);
    if (metadata.shellMode === 'primary' && metadata.parentSpace === null) {
      errors.push(`Primary route has no parent space: ${metadata.path}`);
    }
    if (metadata.category !== 'USER' && metadata.shellMode === 'primary') {
      errors.push(`Non-user route uses the primary shell: ${metadata.path}`);
    }
    if (!metadata.requiresAuth && metadata.permissions.length > 0) {
      errors.push(`Public route declares permissions: ${metadata.path}`);
    }
  }
  return errors;
}
