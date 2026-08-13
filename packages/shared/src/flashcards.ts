/** Flashcard / spaced-repetition wire contracts, shared by API and mobile. */

/** FSRS card lifecycle state. */
export type CardState = 'new' | 'learning' | 'review' | 'relearning';

/** Review grade (Anki-style): 1=Again, 2=Hard, 3=Good, 4=Easy. */
export type ReviewRating = 1 | 2 | 3 | 4;

export interface DeckSummary {
  id: string;
  name: string;
  description?: string;
  cardCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CardView {
  id: string;
  deckId: string;
  front: string;
  back: string;
  state: CardState;
  /** When the card is next due (ISO-8601). */
  due: string;
  reps: number;
  lapses: number;
  /** Source document id, when the card was generated from one. */
  sourceDocumentId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDeckRequest {
  name: string;
  description?: string;
}

export interface UpdateDeckRequest {
  name?: string;
  description?: string;
}

export interface CreateCardRequest {
  front: string;
  back: string;
}

export interface UpdateCardRequest {
  front?: string;
  back?: string;
}

/** Grade a card during review (drives FSRS rescheduling). */
export interface ReviewCardRequest {
  rating: ReviewRating;
}

/** Outcome of a review: the rescheduled card plus the chosen interval. */
export interface ReviewResult {
  card: CardView;
  /** Days until the card is next due (0 for same-day learning steps). */
  scheduledDays: number;
}

/** The day's cross-deck review queue, respecting daily new/review limits. */
export interface ReviewQueue {
  /** Cards to study now, review cards first then new cards. */
  cards: CardView[];
  /** New cards still allowed today after the daily limit. */
  newRemaining: number;
  /** Review cards still allowed today after the daily limit. */
  reviewRemaining: number;
}

/** Generate flashcards from an ingested document via the LLM. */
export interface GenerateCardsRequest {
  /** Target deck; when omitted a new deck named after the document is created. */
  deckId?: string;
  /** How many cards to attempt to generate (default 10). */
  count?: number;
}

export interface GenerateCardsResponse {
  /** Deck the cards were added to (existing or newly created). */
  deckId: string;
  cards: CardView[];
  created: number;
}

/** Study dashboard counts for the current user. */
export interface ReviewStats {
  /** Cards due now (any state). */
  due: number;
  new: number;
  learning: number;
  review: number;
  relearning: number;
  /** Reviews graded since UTC midnight. */
  reviewsToday: number;
  /** Share of all reviews graded better than "Again" (0..1), or null if none yet. */
  retention: number | null;
}
