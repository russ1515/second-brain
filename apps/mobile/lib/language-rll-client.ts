import {
  RLLE_CAN_DO_MAP,
  RLLE_CURRICULUM,
  RLLE_WORLD_MISSIONS,
  type LanguageProfileDetail,
  type RlleCanDoCapability,
  type RlleCourseView,
  type RlleLessonStageKind,
  type RlleMissionTurnRequest,
  type RlleMissionTurnResponse,
  type RlleSessionResponse,
  type RlleWorldMissionAttempt,
  type RlleWorldMissionTemplate,
  type StartRlleCourseRequest,
  type StartRlleLessonRequest,
  type StartRlleMissionRequest,
  type UpdateRlleCoursePreferencesRequest,
} from '@second-brain/shared';
import { ApiError, api } from './client';

export interface RlleCurriculumPreview {
  kind: 'preview';
  /** Static pedagogical spine only; it contains no learner progress. */
  units: typeof RLLE_CURRICULUM;
  missions: typeof RLLE_WORLD_MISSIONS;
  canDo: typeof RLLE_CAN_DO_MAP;
}

export type RlleCourseLoad =
  | { kind: 'live'; course: RlleCourseView }
  | RlleCurriculumPreview;

export interface RlleMissionCatalogItem extends RlleWorldMissionTemplate {
  attempt: RlleWorldMissionAttempt | null;
  available: boolean | null;
}

export interface RlleMissionCatalog {
  items: RlleMissionCatalogItem[];
  live: boolean;
}

function endpoint(profileId: string, suffix: string): string {
  return `/languages/${encodeURIComponent(profileId)}${suffix}`;
}

function isUnavailable(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 404 || error.status === 501);
}

/** A 404 from an older API yields a clearly labelled static preview, never
 * fabricated progress. Network/server failures still surface to the screen. */
export async function loadRlleCourse(profileId: string): Promise<RlleCourseLoad> {
  try {
    return { kind: 'live', course: await api<RlleCourseView>(endpoint(profileId, '/course')) };
  } catch (error) {
    if (!isUnavailable(error)) throw error;
    return {
      kind: 'preview',
      units: RLLE_CURRICULUM,
      missions: RLLE_WORLD_MISSIONS,
      canDo: RLLE_CAN_DO_MAP,
    };
  }
}

export function startRlleCourse(profileId: string, request: StartRlleCourseRequest): Promise<RlleSessionResponse> {
  return api<RlleSessionResponse>(endpoint(profileId, '/course/start'), {
    method: 'POST',
    body: request,
  });
}

export function startRlleLesson(profileId: string, request: StartRlleLessonRequest): Promise<RlleSessionResponse> {
  return api<RlleSessionResponse>(endpoint(profileId, '/course/lessons/start'), {
    method: 'POST',
    body: request,
  });
}

export function updateRlleCoursePreferences(
  profileId: string,
  request: UpdateRlleCoursePreferencesRequest,
): Promise<RlleCourseView> {
  return api<RlleCourseView>(endpoint(profileId, '/course/preferences'), {
    method: 'PATCH',
    body: request,
  });
}

export function advanceRlleLesson(
  profileId: string,
  experienceSessionId: string,
  lessonId: string,
  completedStage: RlleLessonStageKind,
): Promise<RlleCourseView> {
  return api<RlleCourseView>(endpoint(profileId, '/course/advance'), {
    method: 'POST',
    body: { experienceSessionId, lessonId, completedStage },
  });
}

export async function loadRlleMissions(profileId: string): Promise<RlleMissionCatalog> {
  try {
    const payload = await api<unknown>(endpoint(profileId, '/missions'));
    const rawItems = Array.isArray(payload)
      ? payload
      : payload && typeof payload === 'object' && 'items' in payload && Array.isArray((payload as { items: unknown }).items)
        ? (payload as { items: unknown[] }).items
        : [];
    const byId = new Map<string, Partial<RlleMissionCatalogItem>>();
    for (const item of rawItems) {
      if (item && typeof item === 'object' && typeof (item as { id?: unknown }).id === 'string') {
        byId.set((item as { id: string }).id, item as Partial<RlleMissionCatalogItem>);
      }
    }
    return {
      live: true,
      items: RLLE_WORLD_MISSIONS.map((template) => {
        const live = byId.get(template.id);
        return {
          ...template,
          ...(live ?? {}),
          attempt: live?.attempt ?? null,
          available: typeof live?.available === 'boolean' ? live.available : null,
        };
      }),
    };
  } catch (error) {
    if (!isUnavailable(error)) throw error;
    return {
      live: false,
      items: RLLE_WORLD_MISSIONS.map((template) => ({ ...template, attempt: null, available: null })),
    };
  }
}

export function startRlleMission(profileId: string, request: StartRlleMissionRequest): Promise<RlleSessionResponse> {
  return api<RlleSessionResponse>(endpoint(profileId, `/missions/${encodeURIComponent(request.missionId)}/start`), {
    method: 'POST',
    body: request,
  });
}

export function sendRlleMissionTurn(
  profileId: string,
  missionId: string,
  request: RlleMissionTurnRequest,
): Promise<RlleMissionTurnResponse> {
  return api<RlleMissionTurnResponse>(endpoint(profileId, `/missions/${encodeURIComponent(missionId)}/turn`), {
    method: 'POST',
    body: request,
  });
}

export async function loadRlleCanDo(profileId: string): Promise<{ items: RlleCanDoCapability[]; live: boolean }> {
  try {
    const payload = await api<unknown>(endpoint(profileId, '/can-do'));
    const items = Array.isArray(payload)
      ? payload
      : payload && typeof payload === 'object' && 'items' in payload && Array.isArray((payload as { items: unknown }).items)
        ? (payload as { items: unknown[] }).items
        : [];
    return { items: items as RlleCanDoCapability[], live: true };
  } catch (error) {
    if (!isUnavailable(error)) throw error;
    return { items: [], live: false };
  }
}

export async function resumeRlleSession(sessionId: string): Promise<void> {
  await api(`/experience-sessions/${encodeURIComponent(sessionId)}/resume`, { method: 'POST' });
}

export async function pauseRlleSession(sessionId: string): Promise<void> {
  await api(`/experience-sessions/${encodeURIComponent(sessionId)}/pause`, { method: 'POST' });
}

export async function loadLanguageProfile(profileId: string): Promise<LanguageProfileDetail> {
  return api<LanguageProfileDetail>(endpoint(profileId, ''));
}
