import type { ContextItem } from '@second-brain/shared';

export interface TutorRetrievalScope {
  /** Tutor never searches the whole Library implicitly. */
  explicit: boolean;
  documentIds: string[];
  collectionIds: string[];
}

/**
 * A new Tutor session is isolated from unrelated lessons and documents. Only a
 * document/collection the learner explicitly attached may enter retrieval.
 * Language, goal and concept contexts still steer teaching, but they never
 * silently widen RAG to the whole Library.
 */
export function tutorRetrievalScope(
  contexts: readonly ContextItem[],
): TutorRetrievalScope {
  const documentIds = references(contexts, 'document');
  const collectionIds = references(contexts, 'document-collection');
  return {
    explicit: documentIds.length > 0 || collectionIds.length > 0,
    documentIds,
    collectionIds,
  };
}

function references(
  contexts: readonly ContextItem[],
  kind: ContextItem['kind'],
): string[] {
  return [
    ...new Set(
      contexts
        .filter((item) => item.kind === kind && item.referenceId)
        .map((item) => item.referenceId as string),
    ),
  ];
}
