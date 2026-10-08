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
import { resolveLocale } from '../common/learning-locale';
import type { CreateLanguageProfileDto } from './dto/create-language-profile.dto';
import type { UpdateLanguageProfileDto } from './dto/update-language-profile.dto';
import { immersionRatio } from './language-modes';
import { LearningDataDeletionService } from '../experience-sessions/learning-data-deletion.service';
import { accountDataLockKey } from '../common/account-data-lock';

/** Per-language state for the learner. Vocabulary is not a new SRS: each profile
 *  owns an ordinary Deck whose cards ride the existing FSRS engine. */
@Injectable()
export class LanguageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly learningDeletions: LearningDataDeletionService,
  ) {}

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
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const [lessons, tutors, sessions] = await Promise.all([
        this.prisma.lesson.findMany({
          where: { userId, languageProfileId: id },
          select: { id: true },
        }),
        this.prisma.tutorSession.findMany({
          where: { userId, languageProfileId: id },
          select: { id: true },
        }),
        this.prisma.experienceSession.findMany({
          where: { userId, languageProfileId: id },
          select: { id: true },
        }),
      ]);

      // Every specialized entry point uses the same permanent purge boundary.
      // Each step is idempotent; a transient external-index failure leaves the
      // profile present so the learner can safely retry the deletion.
      for (const lesson of lessons) await this.learningDeletions.deleteLesson(userId, lesson.id);
      for (const tutor of tutors) await this.learningDeletions.deleteTutorSession(userId, tutor.id);
      for (const session of sessions) await this.learningDeletions.deleteSession(userId, session.id);

      const removed = await this.prisma.$transaction(async (tx) => {
        const lockKey = accountDataLockKey(userId);
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;
        const owned = await tx.languageProfile.findFirst({
          where: { id, userId },
          select: { id: true, vocabDeckId: true },
        });
        if (!owned) return true;

        // A writer that completed between the outer snapshot and this lock is
        // handled by another canonical purge pass, never detached by SetNull.
        const [remainingLessons, remainingTutors, remainingSessions] = await Promise.all([
          tx.lesson.count({ where: { userId, languageProfileId: id } }),
          tx.tutorSession.count({ where: { userId, languageProfileId: id } }),
          tx.experienceSession.count({ where: { userId, languageProfileId: id } }),
        ]);
        if (remainingLessons + remainingTutors + remainingSessions > 0) return false;

        await tx.learningCompletion.deleteMany({ where: { userId, languageProfileId: id } });
        await tx.reviewable.deleteMany({
          where: { userId, kind: 'language', refId: { startsWith: `${id}:` } },
        });
        await tx.dailyPlanItem.deleteMany({ where: { languageProfileId: id } });
        await tx.languageProfile.delete({ where: { id } });

        if (owned.vocabDeckId) {
          const [otherProfiles, resources] = await Promise.all([
            tx.languageProfile.count({ where: { vocabDeckId: owned.vocabDeckId } }),
            tx.studyResource.count({ where: { userId, deckId: owned.vocabDeckId } }),
          ]);
          if (otherProfiles === 0 && resources === 0) {
            await tx.deck.deleteMany({ where: { id: owned.vocabDeckId, userId } });
          }
        }
        return true;
      });
      if (removed) return;
    }
    throw new ConflictException('Language learning changed during deletion. Please retry.');
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

  /**
   * Resolve the three language roles used by every language-learning prompt.
   *
   * UI/support copy follows the learner's current interface locale; the target
   * remains the language profile. Keeping this in one server-side resolver
   * prevents individual activities from silently falling back to English or
   * from confusing the language being learned with the language of guidance.
   */
  async promptRoles(
    userId: string,
    profile: Pick<LanguageProfile, 'language' | 'normalizedLanguage'>,
  ): Promise<{
    interfaceLanguage: string;
    supportLanguage: string;
    targetLanguage: string;
  }> {
    const interfaceLanguage = await resolveLocale(this.prisma, userId);
    const code =
      toSupportedLanguage(profile.normalizedLanguage) ??
      toSupportedLanguage(profile.language);
    const targetLanguage = code
      ? SUPPORTED_LANGUAGES[code].englishName
      : profile.language;
    return {
      interfaceLanguage,
      supportLanguage: interfaceLanguage,
      targetLanguage,
    };
  }

  /** Every profile gets a vocabulary deck at creation, but the FK is SetNull —
   *  re-create it if the deck was deleted out from under us. */
  async ensureVocabDeck(profile: LanguageProfile): Promise<string> {
    return this.prisma.$transaction(async (tx) => {
      const lockKey = accountDataLockKey(profile.userId);
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;

      // The caller can hold a stale profile while a permanent deletion is in
      // flight. Re-read it under the same owner lock used by deletion so a
      // deck can never be created and then left orphaned by a failed attach.
      const current = await tx.languageProfile.findFirst({
        where: { id: profile.id, userId: profile.userId },
      });
      if (!current) throw new NotFoundException('Language profile not found.');

      if (current.vocabDeckId) {
        const deck = await tx.deck.findFirst({
          where: { id: current.vocabDeckId, userId: profile.userId },
          select: { id: true },
        });
        if (deck) return deck.id;
      }

      const deck = await tx.deck.create({
        data: {
          userId: profile.userId,
          name: `Vocabulary — ${current.language}`.slice(0, 200),
          description: `Vocabulary for ${current.language}, reviewed with FSRS.`,
        },
      });
      await tx.languageProfile.update({
        where: { id: current.id },
        data: { vocabDeckId: deck.id },
      });
      return deck.id;
    });
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
