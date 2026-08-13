import { Injectable, NotFoundException } from '@nestjs/common';
import type { CardView, ReviewRating, ReviewResult } from '@second-brain/shared';
import { PrismaService } from '../prisma/prisma.service';
import { FsrsService } from './fsrs.service';
import { toCardView } from './card.mapper';

const DEFAULT_DUE_LIMIT = 50;
const MAX_DUE_LIMIT = 200;

/** FSRS review flow: due queues and grading. */
@Injectable()
export class ReviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fsrs: FsrsService,
  ) {}

  /** Cards in a deck that are due for review now (new cards are due immediately). */
  async dueCards(
    userId: string,
    deckId: string,
    limit = DEFAULT_DUE_LIMIT,
  ): Promise<CardView[]> {
    const deck = await this.prisma.deck.findUnique({ where: { id: deckId } });
    if (!deck || deck.userId !== userId) {
      throw new NotFoundException('Deck not found.');
    }
    const cards = await this.prisma.card.findMany({
      where: { deckId, due: { lte: new Date() } },
      orderBy: { due: 'asc' },
      take: Math.min(Math.max(limit, 1), MAX_DUE_LIMIT),
    });
    return cards.map(toCardView);
  }

  /** Grade a card and reschedule it via FSRS, recording a review log. */
  async review(
    userId: string,
    cardId: string,
    rating: ReviewRating,
  ): Promise<ReviewResult> {
    const card = await this.prisma.card.findUnique({ where: { id: cardId } });
    if (!card || card.userId !== userId) {
      throw new NotFoundException('Card not found.');
    }

    const { update, previousState, scheduledDays } = this.fsrs.review(card, rating);

    // Persist the new schedule and the review event atomically.
    const [updated] = await this.prisma.$transaction([
      this.prisma.card.update({ where: { id: cardId }, data: update }),
      this.prisma.reviewLog.create({
        data: {
          cardId,
          userId,
          rating,
          state: previousState,
          scheduledDays,
        },
      }),
    ]);

    return { card: toCardView(updated), scheduledDays };
  }
}
