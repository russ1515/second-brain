import type { Card } from '@prisma/client';
import type { CardView } from '@second-brain/shared';

/** Project a persisted card into its client-facing view. */
export function toCardView(card: Card): CardView {
  return {
    id: card.id,
    deckId: card.deckId,
    front: card.front,
    back: card.back,
    state: card.state,
    due: card.due.toISOString(),
    reps: card.reps,
    lapses: card.lapses,
    sourceDocumentId: card.sourceDocumentId ?? undefined,
    createdAt: card.createdAt.toISOString(),
    updatedAt: card.updatedAt.toISOString(),
  };
}
