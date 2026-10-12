import {
  RLLE_CAN_DO_MAP,
  RLLE_CURRICULUM,
  RLLE_WORLD_MISSIONS,
  type LanguageMasteryDecision,
  type LanguageProfileDetail,
  type LessonView,
  type MarkRlleAutonomyHelpRequest,
  type PronunciationCoaching,
  type RlleAutonomyHelpResponse,
  type RlleAutonomyStartResponse,
  type RlleAutonomySubmissionResponse,
  type RlleCanDoCapability,
  type RlleCourseView,
  type RlleLessonStageKind,
  type RlleMissionTurnRequest,
  type RlleMissionTurnResponse,
  type RlleSessionResponse,
  type RlleScopedMasteryStartResponse,
  type RlleScopedMasterySubmissionResponse,
  type RlleWorldMissionAttempt,
  type RlleWorldMissionTemplate,
  type RecordRlleRemediationExerciseRequest,
  type StartRlleCourseRequest,
  type StartRlleLessonRequest,
  type StartRlleMissionRequest,
  type StartRlleAutonomyRequest,
  type StartRlleRemediationRequest,
  type StartRlleScopedMasteryRequest,
  type SubmitRlleAutonomyRequest,
  type SubmitRlleScopedMasteryRequest,
  type UpdateRlleCoursePreferencesRequest,
} from '@second-brain/shared';
import { ApiError, api, apiUpload } from './client';
import type { Recording } from './recorder';

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

export interface RlleAcousticMasteryPrompt {
  exerciseIndex: number;
  referenceText: string;
  spontaneousPrompt: string;
}

export interface RlleAcousticMasteryResponse {
  attemptId: string;
  outcome: 'evaluated' | 'not-evaluable';
  decision: LanguageMasteryDecision;
  criteria: Array<{ id: string; met: boolean; score: number | null }>;
  assessmentSubmissionId: string | null;
  completionId: string | null;
  replayed: boolean;
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

export function startRlleAutonomy(
  profileId: string,
  request: StartRlleAutonomyRequest,
): Promise<RlleAutonomyStartResponse> {
  return api<RlleAutonomyStartResponse>(endpoint(profileId, '/course/autonomy/start'), {
    method: 'POST',
    body: request,
  });
}

export function markRlleAutonomyHelp(
  profileId: string,
  request: MarkRlleAutonomyHelpRequest,
): Promise<RlleAutonomyHelpResponse> {
  return api<RlleAutonomyHelpResponse>(endpoint(profileId, '/course/autonomy/help'), {
    method: 'POST',
    body: request,
  });
}

export function submitRlleAutonomy(
  profileId: string,
  request: SubmitRlleAutonomyRequest,
): Promise<RlleAutonomySubmissionResponse> {
  return api<RlleAutonomySubmissionResponse>(endpoint(profileId, '/course/autonomy/submit'), {
    method: 'POST',
    body: request,
  });
}

export function startRlleRemediation(
  profileId: string,
  request: StartRlleRemediationRequest,
): Promise<RlleSessionResponse> {
  return api<RlleSessionResponse>(endpoint(profileId, '/course/remediation/start'), {
    method: 'POST',
    body: request,
  });
}

export function startRlleScopedMastery(
  profileId: string,
  request: StartRlleScopedMasteryRequest,
): Promise<RlleScopedMasteryStartResponse> {
  return api<RlleScopedMasteryStartResponse>(endpoint(profileId, '/course/mastery/start'), {
    method: 'POST',
    body: request,
  });
}

export function submitRlleScopedMastery(
  profileId: string,
  request: SubmitRlleScopedMasteryRequest,
): Promise<RlleScopedMasterySubmissionResponse> {
  return api<RlleScopedMasterySubmissionResponse>(endpoint(profileId, '/course/mastery/submit'), {
    method: 'POST',
    body: request,
  });
}

/** Resolve the actual, versioned voice exercise attached to the active lesson.
 * The server remains authoritative and validates this index/reference again;
 * this projection exists only so the learner can see what to record. */
export async function loadRlleAcousticMasteryPrompt(
  lessonId: string,
): Promise<RlleAcousticMasteryPrompt | null> {
  const lesson = await api<LessonView>(`/lessons/${encodeURIComponent(lessonId)}`);
  const exerciseIndex = lesson.exercises.findIndex(
    (exercise) => exercise.languageFormat === 'voice-pronunciation'
      && Boolean(exercise.audioText?.trim()),
  );
  if (exerciseIndex < 0) return null;
  const exercise = lesson.exercises[exerciseIndex]!;
  return {
    exerciseIndex,
    referenceText: exercise.audioText!.trim(),
    spontaneousPrompt: exercise.question.trim(),
  };
}

function audioExtension(mimeType: string): 'mp4' | 'ogg' | 'wav' | 'webm' {
  if (mimeType.includes('mp4')) return 'mp4';
  if (mimeType.includes('ogg')) return 'ogg';
  if (mimeType.includes('wav')) return 'wav';
  return 'webm';
}

/** Submit the two independent native-audio observations required by the
 * versioned pronunciation rubric. A retry deliberately reuses the stable
 * server operation key; no client duration or client-authored score is sent. */
export async function submitRlleAcousticMastery(
  profileId: string,
  request: {
    experienceSessionId: string;
    lessonId: string;
    targetId: string;
    idempotencyKey: string;
    exerciseIndex: number;
    scriptedRecording: Recording;
    spontaneousRecording: Recording;
    remediationPlanId?: string;
  },
): Promise<RlleAcousticMasteryResponse> {
  const form = new FormData();
  form.append(
    'scriptedAudio',
    request.scriptedRecording.blob,
    `scripted-pronunciation.${audioExtension(request.scriptedRecording.mimeType)}`,
  );
  form.append(
    'spontaneousAudio',
    request.spontaneousRecording.blob,
    `spontaneous-pronunciation.${audioExtension(request.spontaneousRecording.mimeType)}`,
  );
  form.append('experienceSessionId', request.experienceSessionId);
  form.append('lessonId', request.lessonId);
  form.append('targetId', request.targetId);
  form.append('idempotencyKey', request.idempotencyKey);
  form.append('exerciseIndex', String(request.exerciseIndex));
  if (request.remediationPlanId) {
    form.append('remediationPlanId', request.remediationPlanId);
  }
  return apiUpload<RlleAcousticMasteryResponse>(
    endpoint(profileId, '/course/mastery/acoustic'),
    form,
  );
}

/** Records only an already-persisted ExerciseAttempt. Replaying the exact
 * request is safe because the API de-duplicates the canonical evidence by the
 * exerciseAttemptId-derived evidence id. */
export function recordRlleRemediationExercise(
  profileId: string,
  request: RecordRlleRemediationExerciseRequest,
): Promise<unknown> {
  return api(endpoint(profileId, '/course/remediation/evidence'), {
    method: 'POST',
    body: request,
  });
}

export async function submitRllePronunciationTraining(
  profileId: string,
  request: {
    experienceSessionId: string;
    lessonId: string;
    exerciseIndex: number;
    recording: Recording;
  },
): Promise<{ coaching: PronunciationCoaching; course: RlleCourseView }> {
  const form = new FormData();
  const extension = request.recording.mimeType.includes('mp4')
    ? 'mp4'
    : request.recording.mimeType.includes('ogg')
      ? 'ogg'
      : 'webm';
  form.append('audio', request.recording.blob, `language-training.${extension}`);
  form.append('experienceSessionId', request.experienceSessionId);
  form.append('lessonId', request.lessonId);
  form.append('exerciseIndex', String(request.exerciseIndex));
  if (request.recording.durationMs !== undefined) {
    form.append('durationMs', String(request.recording.durationMs));
  }
  return apiUpload<{ coaching: PronunciationCoaching; course: RlleCourseView }>(
    endpoint(profileId, '/course/training/pronunciation'),
    form,
  );
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
