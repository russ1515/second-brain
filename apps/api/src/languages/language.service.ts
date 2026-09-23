import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { LanguageProfile } from '@prisma/client';
import type {
  CefrLevel,
  LanguageMode,
  LanguageProfileDetail,
  LanguageProfileSummary,
} from '@second-brain/shared';
import { SUPPORTED_LANGUAGES, toSupportedLanguage } from '@second-brain/shared';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateLanguageProfileDto } from './dto/create-language-profile.dto';
import type { UpdateLanguageProfileDto } from './dto/update-language-profile.dto';
import { immersionRatio } from './language-modes';

/** Per-language state for the learner. Vocabulary is not a new SRS: each profile
 *  owns an ordinary Deck whose cards ride the existing FSRS engine. */
@Injectable()
export class LanguageService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    userId: string,
    dto: CreateLanguageProfileDto,
  ): Promise<LanguageProfileSummary> {
    const languageCode = toSupportedLanguage(dto.language);
    if (!languageCode) throw new BadRequestException('Unsupported learning language.');
    const language = SUPPORTED_LANGUAGES[languageCode].englishName;
    const normalizedLanguage = languageCode;
    const existing = (await this.prisma.languageProfile.findMany({ where: { userId } }))
      .find((profile) => toSupportedLanguage(profile.normalizedLanguage) === languageCode || toSupportedLanguage(profile.language) === languageCode);
    if (existing) {
      throw new ConflictException(`You are already learning ${existing.language}.`);
    }

    // The vocabulary deck is the link between a language and FSRS.
    const deck = await this.prisma.deck.create({
      data: {
        userId,
        name: `Vocabulary — ${language}`.slice(0, 200),
        description: `Vocabulary for ${language}, reviewed with FSRS.`,
      },
    });

    const profile = await this.prisma.languageProfile.create({
      data: {
        userId,
        language,
        normalizedLanguage,
        nativeLanguage: this.canonicalLanguageName(dto.nativeLanguage),
        mode: dto.mode ?? 'beginner',
        cefrLevel: dto.cefrLevel ?? 'A1',
        goal: dto.goal?.trim() || null,
        vocabDeckId: deck.id,
      },
    });
    return this.summary(userId, profile);
  }

  async list(userId: string): Promise<LanguageProfileSummary[]> {
    const profiles = await this.prisma.languageProfile.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: { select: { tutorSessions: true, lessons: true } },
        tutorSessions: { select: { updatedAt: true }, orderBy: { updatedAt: 'desc' }, take: 1 },
        lessons: { select: { createdAt: true }, orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });
    const deckIds = profiles.map((profile) => profile.vocabDeckId).filter((id): id is string => !!id);
    const [totals, due] = deckIds.length ? await Promise.all([
      this.prisma.card.groupBy({ by: ['deckId'], where: { userId, deckId: { in: deckIds } }, _count: { _all: true } }),
      this.prisma.card.groupBy({ by: ['deckId'], where: { userId, deckId: { in: deckIds }, due: { lte: new Date() } }, _count: { _all: true } }),
    ]) : [[], []];
    const totalByDeck = new Map(totals.map((row) => [row.deckId, row._count._all]));
    const dueByDeck = new Map(due.map((row) => [row.deckId, row._count._all]));
    return profiles.map((profile) => this.toSummary(profile, {
      vocabCount: profile.vocabDeckId ? totalByDeck.get(profile.vocabDeckId) ?? 0 : 0,
      vocabDue: profile.vocabDeckId ? dueByDeck.get(profile.vocabDeckId) ?? 0 : 0,
      lessonCount: profile._count.lessons,
      sessionCount: profile._count.tutorSessions,
      lastActivityAt: this.latestDate(profile.tutorSessions[0]?.updatedAt, profile.lessons[0]?.createdAt),
    }));
  }

  async get(userId: string, id: string): Promise<LanguageProfileDetail> {
    const profile = await this.requireOwned(userId, id);
    const [vocabCount, vocabDue, lessonCount, sessionCount, lastSession, lastLesson] = await Promise.all([
      this.countVocab(userId, profile.vocabDeckId),
      this.countVocabDue(userId, profile.vocabDeckId),
      this.prisma.lesson.count({ where: { userId, languageProfileId: id } }),
      this.prisma.tutorSession.count({ where: { userId, languageProfileId: id } }),
      this.prisma.tutorSession.findFirst({ where: { userId, languageProfileId: id }, orderBy: { updatedAt: 'desc' }, select: { updatedAt: true } }),
      this.prisma.lesson.findFirst({ where: { userId, languageProfileId: id }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } }),
    ]);
    return {
      ...this.toSummary(profile, { vocabCount, vocabDue, lessonCount, sessionCount, lastActivityAt: this.latestDate(lastSession?.updatedAt, lastLesson?.createdAt) }),
      immersionRatio:
        profile.mode === 'immersion' ? immersionRatio(profile.cefrLevel) : null,
    };
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateLanguageProfileDto,
  ): Promise<LanguageProfileSummary> {
    await this.requireOwned(userId, id);
    const profile = await this.prisma.languageProfile.update({
      where: { id },
      data: {
        ...(dto.mode !== undefined ? { mode: dto.mode } : {}),
        ...(dto.cefrLevel !== undefined ? { cefrLevel: dto.cefrLevel } : {}),
        ...(dto.nativeLanguage !== undefined
          ? { nativeLanguage: this.canonicalLanguageName(dto.nativeLanguage) }
          : {}),
        ...(dto.goal !== undefined ? { goal: dto.goal.trim() || null } : {}),
      },
    });
    return this.summary(userId, profile);
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.requireOwned(userId, id);
    // The vocabulary deck is deliberately left behind: those are real FSRS cards
    // with real review history, and dropping a language should not silently
    // destroy the learner's memory of it.
    await this.prisma.languageProfile.delete({ where: { id } });
  }

  /** Load an owned profile, or 404. Shared with the other language services. */
  async requireOwned(userId: string, id: string): Promise<LanguageProfile> {
    const profile = await this.prisma.languageProfile.findUnique({
      where: { id },
    });
    if (!profile || profile.userId !== userId) {
      throw new NotFoundException('Language profile not found.');
    }
    return profile;
  }

  /** Every profile gets a vocabulary deck at creation, but the FK is SetNull —
   *  re-create it if the deck was deleted out from under us. */
  async ensureVocabDeck(profile: LanguageProfile): Promise<string> {
    if (profile.vocabDeckId) {
      const deck = await this.prisma.deck.findUnique({
        where: { id: profile.vocabDeckId },
      });
      if (deck) return deck.id;
    }
    const deck = await this.prisma.deck.create({
      data: {
        userId: profile.userId,
        name: `Vocabulary — ${profile.language}`.slice(0, 200),
        description: `Vocabulary for ${profile.language}, reviewed with FSRS.`,
      },
    });
    await this.prisma.languageProfile.update({
      where: { id: profile.id },
      data: { vocabDeckId: deck.id },
    });
    return deck.id;
  }

  // ── internals ────────────────────────────────────────────────────────────

  private canonicalLanguageName(language?: string): string | null {
    if (!language?.trim()) return null;
    const code = toSupportedLanguage(language);
    return code ? SUPPORTED_LANGUAGES[code].englishName : language.trim();
  }

  private countVocab(userId: string, deckId: string | null): Promise<number> {
    if (!deckId) return Promise.resolve(0);
    return this.prisma.card.count({ where: { userId, deckId } });
  }

  private countVocabDue(userId: string, deckId: string | null): Promise<number> {
    if (!deckId) return Promise.resolve(0);
    return this.prisma.card.count({
      where: { userId, deckId, due: { lte: new Date() } },
    });
  }

  private toSummary(
    profile: LanguageProfile,
    stats: { vocabCount: number; vocabDue: number; lessonCount: number; sessionCount: number; lastActivityAt: string | null },
  ): LanguageProfileSummary {
    const languageCode = toSupportedLanguage(profile.normalizedLanguage) ?? toSupportedLanguage(profile.language);
    const nativeLanguageCode = toSupportedLanguage(profile.nativeLanguage);
    return {
      id: profile.id,
      language: profile.language,
      languageCode,
      nativeLanguage: profile.nativeLanguage,
      nativeLanguageCode,
      mode: profile.mode as LanguageMode,
      cefrLevel: profile.cefrLevel as CefrLevel,
      goal: profile.goal,
      vocabDeckId: profile.vocabDeckId,
      ...stats,
      cefrLevelSource: 'declared',
      evaluatedCefrLevel: null,
      createdAt: profile.createdAt.toISOString(),
      updatedAt: profile.updatedAt.toISOString(),
    };
  }

  private async summary(userId: string, profile: LanguageProfile): Promise<LanguageProfileSummary> {
    const [vocabCount, vocabDue, lessonCount, sessionCount, lastSession, lastLesson] = await Promise.all([
      this.countVocab(userId, profile.vocabDeckId),
      this.countVocabDue(userId, profile.vocabDeckId),
      this.prisma.lesson.count({ where: { userId, languageProfileId: profile.id } }),
      this.prisma.tutorSession.count({ where: { userId, languageProfileId: profile.id } }),
      this.prisma.tutorSession.findFirst({ where: { userId, languageProfileId: profile.id }, orderBy: { updatedAt: 'desc' }, select: { updatedAt: true } }),
      this.prisma.lesson.findFirst({ where: { userId, languageProfileId: profile.id }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } }),
    ]);
    return this.toSummary(profile, {
      vocabCount, vocabDue, lessonCount, sessionCount,
      lastActivityAt: this.latestDate(lastSession?.updatedAt, lastLesson?.createdAt),
    });
  }

  private latestDate(...dates: Array<Date | undefined>): string | null {
    const timestamps = dates.filter((value): value is Date => value instanceof Date).map((value) => value.getTime());
    return timestamps.length ? new Date(Math.max(...timestamps)).toISOString() : null;
  }
}
