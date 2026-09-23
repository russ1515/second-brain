import type { ActionDestination } from '@second-brain/shared';

/** Resolve the normalized action contract to an existing concrete app URL. */
export function actionDestinationHref(destination: ActionDestination): string {
  const base = destination.path ?? inferredPath(destination);
  const params = destination.params ?? {};
  const query = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&');
  if (!query) return base;
  return `${base}${base.includes('?') ? '&' : '?'}${query}`;
}

function inferredPath(destination: ActionDestination): string {
  switch (destination.kind) {
    case 'concept':
      return destination.id ? `/lesson/new?conceptId=${encodeURIComponent(destination.id)}` : '/learn';
    case 'document':
      return destination.id ? `/library/${encodeURIComponent(destination.id)}` : '/library';
    case 'lesson':
      return destination.id ? `/lesson/${encodeURIComponent(destination.id)}` : '/learn';
    case 'workspace':
      return destination.id ? `/library/workspace/${encodeURIComponent(destination.id)}` : '/library/workspace';
    case 'review':
      return '/revision';
    case 'language':
      return destination.id ? `/languages/${encodeURIComponent(destination.id)}` : '/languages';
    case 'experience-session':
      return destination.id ? `/learn?experienceSessionId=${encodeURIComponent(destination.id)}` : '/learn';
    case 'route':
    default:
      return '/learn';
  }
}
