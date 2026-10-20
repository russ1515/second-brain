import type {
  LanguagePlacementView,
  SaveLanguagePlacementProgressRequest,
  StartLanguagePlacementRequest,
  SubmitLanguagePlacementRequest,
} from '@second-brain/shared';
import { api } from './client';

function placementPath(profileId: string): string {
  return `/languages/${encodeURIComponent(profileId)}/placement`;
}

/** The server owns classification and persistence. The client never converts a
 * mark, self-estimate or answer count into a CEFR/product level. */
export function loadLanguagePlacement(profileId: string): Promise<LanguagePlacementView> {
  return api<LanguagePlacementView>(placementPath(profileId));
}

export function startLanguagePlacement(
  profileId: string,
  request: StartLanguagePlacementRequest,
): Promise<LanguagePlacementView> {
  return api<LanguagePlacementView>(`${placementPath(profileId)}/start`, {
    method: 'POST', body: request,
  });
}

/** Answer/cursor persistence only: this endpoint never invokes a provider. */
export function saveLanguagePlacementProgress(
  profileId: string,
  request: SaveLanguagePlacementProgressRequest,
): Promise<LanguagePlacementView> {
  return api<LanguagePlacementView>(`${placementPath(profileId)}/progress`, {
    method: 'POST', body: request,
  });
}

export function submitLanguagePlacement(
  profileId: string,
  request: SubmitLanguagePlacementRequest,
): Promise<LanguagePlacementView> {
  return api<LanguagePlacementView>(`${placementPath(profileId)}/submit`, {
    method: 'POST', body: request,
  });
}
