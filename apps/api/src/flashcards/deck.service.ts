import { Injectable, NotFoundException } from '@nestjs/common';
import type { Deck } from '@prisma/client';
import type { DeckSummary } from '@second-brain/shared';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateDeckDto } from './dto/create-deck.dto';
import type { UpdateDeckDto } from './dto/update-deck.dto';

@Injectable()
export class DeckService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateDeckDto): Promise<DeckSummary> {
    const deck = await this.prisma.deck.create({
      data: {
        userId,
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
      },
    });
    return this.toSummary(deck, 0);
  }

  async list(userId: string): Promise<DeckSummary[]> {
    const decks = await this.prisma.deck.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { cards: true } } },
    });
    return decks.map((d) => this.toSummary(d, d._count.cards));
  }

  async get(userId: string, id: string): Promise<DeckSummary> {
    const deck = await this.requireOwned(userId, id);
    const cardCount = await this.prisma.card.count({ where: { deckId: id } });
    return this.toSummary(deck, cardCount);
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateDeckDto,
  ): Promise<DeckSummary> {
    await this.requireOwned(userId, id);
    const deck = await this.prisma.deck.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description.trim() || null }
          : {}),
      },
    });
    const cardCount = await this.prisma.card.count({ where: { deckId: id } });
    return this.toSummary(deck, cardCount);
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.requireOwned(userId, id);
    await this.prisma.deck.delete({ where: { id } }); // cards cascade
  }

  /** Load a deck and assert the caller owns it. */
  private async requireOwned(userId: string, id: string): Promise<Deck> {
    const deck = await this.prisma.deck.findUnique({ where: { id } });
    if (!deck || deck.userId !== userId) {
      throw new NotFoundException('Deck not found.');
    }
    return deck;
  }

  private toSummary(deck: Deck, cardCount: number): DeckSummary {
    return {
      id: deck.id,
      name: deck.name,
      description: deck.description ?? undefined,
      cardCount,
      createdAt: deck.createdAt.toISOString(),
      updatedAt: deck.updatedAt.toISOString(),
    };
  }
}
