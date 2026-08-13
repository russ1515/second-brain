import { Injectable, NotFoundException } from '@nestjs/common';
import type { Card } from '@prisma/client';
import type { CardView } from '@second-brain/shared';
import { PrismaService } from '../prisma/prisma.service';
import { toCardView } from './card.mapper';
import type { CreateCardDto } from './dto/create-card.dto';
import type { UpdateCardDto } from './dto/update-card.dto';

@Injectable()
export class CardService {
  constructor(private readonly prisma: PrismaService) {}

  /** Add a card to a deck the caller owns. New cards start due immediately. */
  async create(
    userId: string,
    deckId: string,
    dto: CreateCardDto,
  ): Promise<CardView> {
    await this.requireOwnedDeck(userId, deckId);
    const card = await this.prisma.card.create({
      data: {
        deckId,
        userId,
        front: dto.front.trim(),
        back: dto.back.trim(),
      },
    });
    return toCardView(card);
  }

  async listByDeck(userId: string, deckId: string): Promise<CardView[]> {
    await this.requireOwnedDeck(userId, deckId);
    const cards = await this.prisma.card.findMany({
      where: { deckId },
      orderBy: { createdAt: 'asc' },
    });
    return cards.map((c) => toCardView(c));
  }

  async get(userId: string, cardId: string): Promise<CardView> {
    return toCardView(await this.requireOwnedCard(userId, cardId));
  }

  async update(
    userId: string,
    cardId: string,
    dto: UpdateCardDto,
  ): Promise<CardView> {
    await this.requireOwnedCard(userId, cardId);
    const card = await this.prisma.card.update({
      where: { id: cardId },
      data: {
        ...(dto.front !== undefined ? { front: dto.front.trim() } : {}),
        ...(dto.back !== undefined ? { back: dto.back.trim() } : {}),
      },
    });
    return toCardView(card);
  }

  async remove(userId: string, cardId: string): Promise<void> {
    await this.requireOwnedCard(userId, cardId);
    await this.prisma.card.delete({ where: { id: cardId } });
  }

  // ── ownership ────────────────────────────────────────────────────────────

  private async requireOwnedDeck(userId: string, deckId: string): Promise<void> {
    const deck = await this.prisma.deck.findUnique({ where: { id: deckId } });
    if (!deck || deck.userId !== userId) {
      throw new NotFoundException('Deck not found.');
    }
  }

  private async requireOwnedCard(userId: string, cardId: string): Promise<Card> {
    const card = await this.prisma.card.findUnique({ where: { id: cardId } });
    if (!card || card.userId !== userId) {
      throw new NotFoundException('Card not found.');
    }
    return card;
  }
}
