import type { WorkspaceSourceReference } from '@second-brain/shared';

export interface WorkspaceCaptureAttachmentPlan {
  sourcesChanged: boolean;
  contentChanged: boolean;
  content: string;
}

/** Pure attachment planner used by the UI and deterministic tests. The API
 * remains authoritative for ownership and optimistic concurrency. */
export function planWorkspaceCaptureAttachment(
  currentSources: readonly WorkspaceSourceReference[],
  nextSources: readonly WorkspaceSourceReference[],
  currentContent: string,
  capturedText: string,
  attachmentId: string,
): WorkspaceCaptureAttachmentPlan {
  const normalizedText = capturedText.trim();
  const marker = workspaceCaptureMarker(attachmentId);
  const contentChanged = Boolean(normalizedText && marker && !currentContent.includes(marker));
  return {
    sourcesChanged: !sameWorkspaceSources(currentSources, nextSources),
    contentChanged,
    content: contentChanged
      ? currentContent.trim()
        ? `${currentContent.trimEnd()}\n\n${normalizedText}${marker}`
        : `${normalizedText}${marker}`
      : currentContent,
  };
}

/** Invisible, durable marker carried by the workspace draft itself. It makes
 * an append replay-safe even when the first autosave response is lost and a
 * concurrent edit is subsequently added after the captured text. */
export function workspaceCaptureMarker(attachmentId: string): string {
  const normalized = attachmentId.trim().slice(0, 200);
  if (!normalized) return '';
  // Two independent 32-bit hashes form a compact deterministic 64-bit token.
  // Keeping only the invisible token (rather than the request id) bounds the
  // persisted marker to 66 code points even for the longest allowed id.
  let high = 0x811c9dc5;
  let low = 0x9e3779b9;
  for (const character of normalized) {
    const value = character.charCodeAt(0);
    high = Math.imul(high ^ value, 0x01000193) >>> 0;
    low = Math.imul(low ^ value, 0x85ebca6b) >>> 0;
  }
  const bits = `${high.toString(2).padStart(32, '0')}${low.toString(2).padStart(32, '0')}`;
  const encoded = [...bits].map((bit) => bit === '1' ? '\u200C' : '\u200B').join('');
  return `\u2063${encoded}\u2063`;
}

/** Bounded fingerprint for create idempotency. JSON escaping can make a
 * 200k-character draft much larger than its input, so persisting a truncated
 * serialized body is unsafe. Four independent 32-bit accumulators plus the
 * exact serialized length keep the durable comparison compact and stable. */
export function workspaceCaptureSignature(serializedBody: string): string {
  const states = [0x811c9dc5, 0x9e3779b9, 0x85ebca6b, 0xc2b2ae35];
  const multipliers = [0x01000193, 0x85ebca6b, 0xc2b2ae35, 0x27d4eb2f];
  for (const character of serializedBody) {
    const value = character.charCodeAt(0);
    for (let index = 0; index < states.length; index += 1) {
      states[index] = Math.imul(states[index] ^ value, multipliers[index]) >>> 0;
    }
  }
  return `aw1-v1:${serializedBody.length}:${states.map((value) => value.toString(16).padStart(8, '0')).join('')}`;
}

export function sameWorkspaceSources(
  left: readonly WorkspaceSourceReference[],
  right: readonly WorkspaceSourceReference[],
): boolean {
  if (left.length !== right.length) return false;
  return left.every((source, index) => source.kind === right[index]?.kind && source.id === right[index]?.id);
}
