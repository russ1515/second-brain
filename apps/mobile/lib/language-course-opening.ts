import type { LanguageProfileDetail } from '@second-brain/shared';
import { hasCompleteLanguageCoreCatalogue } from './language-learning-core-presentation';
import { loadLanguageProfile, loadRlleCourse, type RlleCourseLoad } from './language-rll-client';
import type { RlleCopy } from './language-rll-i18n';

export type LanguageCourseOpeningPhase = 'PROFILE' | 'LEGACY_COURSE' | 'LEARNING_CORE';
export type LanguageCourseOpeningLoad = RlleCourseLoad | { kind: 'core' };
const routeTemplates: Record<LanguageCourseOpeningPhase, string> = {
  PROFILE: '/languages/:profileId', LEGACY_COURSE: '/languages/:profileId/course',
  LEARNING_CORE: '/languages/:profileId/learning-core',
};
const safeCodes = new Set(['SESSION_EXPIRED', 'SESSION_REVOKED', 'SESSION_INVALID', 'SESSION_OR_ACCOUNT_INACTIVE', 'EMAIL_VERIFICATION_REQUIRED', 'ACCOUNT_SUSPENDED', 'ACCOUNT_BANNED', 'ACCOUNT_BLOCKED']);

/** Only bounded transport facts. Never stringify an exception, backend prose,
 * payload, actual URL/query, request id value, headers or credentials. */
export function languageCourseOpeningError(cause: unknown, phase: LanguageCourseOpeningPhase, copy: RlleCopy): string {
  const value = cause && typeof cause === 'object' ? cause as Record<string, unknown> : {};
  const status = typeof value.status === 'number' && Number.isInteger(value.status) && value.status >= 0 && value.status <= 599 ? value.status : null;
  const payload = value.payload && typeof value.payload === 'object' ? value.payload as Record<string, unknown> : {};
  const nested = payload.message && typeof payload.message === 'object' ? payload.message as Record<string, unknown> : {};
  const rawCode = typeof payload.code === 'string' ? payload.code : nested.code;
  const timedOut = status === 0 && value.message === copy('error.timeout');
  const code = typeof rawCode === 'string' && safeCodes.has(rawCode) ? rawCode : timedOut ? 'REQUEST_TIMEOUT' : status === 0 ? 'TRANSPORT_FAILURE' : status ? `HTTP_${status}` : 'UNEXPECTED_CLIENT_ERROR';
  const key = timedOut ? 'error.timeout' : status === 0 ? 'error.network' : status === 401 ? 'error.unauthorized' : status === 403 ? 'error.forbidden' : status === 404 ? 'error.notFound' : status === 409 ? 'error.conflict' : status === 429 ? 'error.rateLimit' : status != null && status >= 500 ? 'error.serverBusy' : 'error.detail';
  return `${copy(key)}\n${JSON.stringify({ phase, method: 'GET', routeTemplate: routeTemplates[phase], httpStatus: status, code, requestIdPresent: typeof value.requestId === 'string' && Boolean(value.requestId) })}`;
}

/** Core selection comes from the persisted placement, not a legacy course GET.
 * Non-Core profiles retain the existing RLLE loader/fallback unchanged. */
export async function loadLanguageCourseOpening(profileId: string, copy: RlleCopy): Promise<{ profile: LanguageProfileDetail; courseLoad: LanguageCourseOpeningLoad }> {
  let phase: LanguageCourseOpeningPhase = 'PROFILE';
  try {
    const profile = await loadLanguageProfile(profileId);
    if (hasCompleteLanguageCoreCatalogue(profile, profile.placement)) return { profile, courseLoad: { kind: 'core' } };
    phase = 'LEGACY_COURSE';
    return { profile, courseLoad: await loadRlleCourse(profileId) };
  } catch (cause) {
    throw new Error(languageCourseOpeningError(cause, phase, copy));
  }
}
