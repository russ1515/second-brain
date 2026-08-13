import {
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { StudySession } from '@prisma/client';
import type {
  CardView,
  LearningPathItem,
  SessionPlan,
  SessionReport,
  StartSessionRequest,
} from '@second-brain/shared';
import { PrismaService } from '../prisma/prisma.service';
import { LessonService } from '../lessons/lesson.service';
import { LearningPathService } from '../concepts/learning-path.service';
import { MasteryService } from '../concepts/mastery.service';

const DEFAULT_MINUTES = 20;
const ACTIONABLE = ['at_risk', 'ready', 'in_progress'];

/**
 * The Session Orchestrator (task 3.7) — the spine of a study session.
 *
 * Instead of the learner clicking between lesson, exercises, flashcards and
 * revision, one session runs the whole loop: the AI picks the target, snapshots
 * the Digital Twin, generates the lesson, and — at the end — recomputes the twin
 * so the learner sees exactly what moved (Learning Score, mastery, FSRS queue).
 * It composes the existing engines rather than reimplementing them.
 */
@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly lessons: LessonService,
    private readonly learningPath: LearningPathService,
    private readonly mastery: MasteryService,
  ) {}

  /** Open the session: pick what to study, snapshot the twin, build the lesson. */
  async start(userId: string, dto: StartSessionRequest): Promise<SessionPlan> {
    const scoreBefore = await this.learningScore(userId);

    // The AI chooses the target: an explicit concept, else the most actionable
    // one from the learning path, else the caller's fallback topic.
    let conceptId: string | null = dto.conceptId ?? null;
    let subject: string | null = null;
    let masteryBefore: number | null = null;

    if (!conceptId) {
      const target = await this.pickTarget(userId);
      if (target) {
        conceptId = target.conceptId;
        subject = target.name;
        masteryBefore = target.mastery;
      }
    }
    if (conceptId && !subject) {
      const m = await this.mastery.conceptMastery(userId, conceptId).catch(() => null);
      subject = m?.name ?? null;
      masteryBefore = m?.mastery ?? null;
    }
    if (!conceptId && dto.topic?.trim()) {
      subject = dto.topic.trim();
    }
    if (!subject) {
      throw new UnprocessableEntityException(
        'Nothing to study yet — add a concept, or start a session with a topic.',
      );
    }

    // Generate the lesson that anchors the session (ties flashcards to the
    // concept so completing the loop actually grows the Digital Twin).
    const lesson = await this.lessons.generate(userId, {
      ...(conceptId ? { conceptId } : { topic: subject }),
    });

    const session = await this.prisma.studySession.create({
      data: {
        userId,
        conceptId,
        lessonId: lesson.id,
        subject,
        status: 'learning',
        learningScoreBefore: scoreBefore,
        masteryBefore,
      },
    });

    return {
      sessionId: session.id,
      lessonId: lesson.id,
      conceptId,
      subject,
      planMessage:
        `Today we'll work on ${subject}. I'll guide you through the lesson, ` +
        `questions, exercises and their correction, a summary, then flashcards — ` +
        `and close by updating your Digital Twin.`,
      estimatedMinutes: DEFAULT_MINUTES,
      learningScoreBefore: toPercent(scoreBefore),
    };
  }

  /** Close the session: recompute the twin and report what moved. */
  async complete(userId: string, sessionId: string): Promise<SessionReport> {
    const session = await this.requireOwned(userId, sessionId);
    if (!session.lessonId) {
      throw new UnprocessableEntityException('This session has no lesson to complete.');
    }

    const scoreAfter = await this.learningScore(userId);
    const masteryAfter = session.conceptId
      ? (await this.mastery.conceptMastery(userId, session.conceptId).catch(() => null))?.mastery ??
        null
      : null;

    // FSRS queue: the flashcards this session scheduled and their next due date.
    const cards = await this.lessons.flashcards(userId, session.lessonId).catch(() => [] as CardView[]);
    const cardsScheduled = cards.length;
    const nextReviewInDays = this.soonestDueInDays(cards);

    // Graded work this session (the Examiner persists every attempt).
    const attempts = await this.prisma.exerciseAttempt.findMany({
      where: { userId, lessonId: session.lessonId },
      select: { correct: true },
    });
    const exercisesAttempted = attempts.length;
    const exercisesCorrect = attempts.filter((a) => a.correct).length;

    // Only overwrite the "after" snapshot the first time it completes.
    if (session.status !== 'done') {
      await this.prisma.studySession.update({
        where: { id: session.id },
        data: {
          status: 'done',
          learningScoreAfter: scoreAfter,
          masteryAfter,
          completedAt: new Date(),
        },
      });
    }

    const before = toPercent(session.learningScoreBefore);
    const after = toPercent(scoreAfter);
    return {
      sessionId: session.id,
      subject: session.subject,
      conceptId: session.conceptId,
      lessonId: session.lessonId,
      exercisesAttempted,
      exercisesCorrect,
      cardsScheduled,
      nextReviewInDays,
      learningScoreBefore: before,
      learningScoreAfter: after,
      scoreDelta: before !== null && after !== null ? after - before : null,
      masteryBefore: toPercent(session.masteryBefore),
      masteryAfter: toPercent(masteryAfter),
      conceptTracked: masteryAfter !== null,
    };
  }

  // ── internals ────────────────────────────────────────────────────────────

  /** The most actionable concept to study now (weakest / most at-risk first). */
  private async pickTarget(userId: string): Promise<LearningPathItem | null> {
    const { items } = await this.learningPath.next(userId).catch(() => ({ items: [] }));
    return items.find((i) => ACTIONABLE.includes(i.status)) ?? null;
  }

  /** Learning Score as a 0..1 mean of tracked mastery, or null if none tracked. */
  private async learningScore(userId: string): Promise<number | null> {
    const twin = await this.mastery.twin(userId).catch(() => null);
    return twin?.summary.averageMastery ?? null;
  }

  private soonestDueInDays(cards: CardView[]): number | null {
    if (cards.length === 0) return null;
    const now = Date.now();
    const soonest = Math.min(...cards.map((c) => new Date(c.due).getTime()));
    return Math.max(0, Math.ceil((soonest - now) / 86_400_000));
  }

  private async requireOwned(userId: string, id: string): Promise<StudySession> {
    const session = await this.prisma.studySession.findUnique({ where: { id } });
    if (!session || session.userId !== userId) {
      throw new NotFoundException('Study session not found.');
    }
    return session;
  }
}

/** 0..1 → 0..100 (rounded), preserving null. */
function toPercent(value: number | null | undefined): number | null {
  return value === null || value === undefined ? null : Math.round(value * 100);
}
