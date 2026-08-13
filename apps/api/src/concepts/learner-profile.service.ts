import { Injectable } from '@nestjs/common';
import type {
  ExplanationDepth,
  FocusWindow,
  LearnerBand,
  LearnerProfile,
  LearningSpeed,
  LearningStyle,
  WorkRhythm,
} from '@second-brain/shared';
import { PrismaService } from '../prisma/prisma.service';
import { MasteryService } from './mastery.service';

const DAY_MS = 86_400_000;
const MIN_EXERCISES = 4; // before we'll call a learning speed
const MIN_STYLE = 3; // before we'll name a style
const MIN_FOCUS = 4; // before we'll name a focus window

/**
 * Digital Twin — the learner PROFILE (task 4.1).
 *
 * Derives the learner's behavioural profile from the interaction data that
 * already accumulates as they use the app. Nothing is stored or hand-updated:
 * every read reflects the latest reality, so the twin "evolves after each
 * interaction" by construction, and thin evidence yields null (an honest
 * "not enough data yet") rather than a fabricated trait.
 */
@Injectable()
export class LearnerProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mastery: MasteryService,
  ) {}

  async profile(userId: string): Promise<LearnerProfile> {
    const [twin, lessons, attempts, sessions, messages, languageProfiles] =
      await Promise.all([
        this.mastery.twin(userId),
        this.prisma.lesson.findMany({
          where: { userId },
          select: { topic: true, level: true, language: true, createdAt: true },
        }),
        this.prisma.exerciseAttempt.findMany({
          where: { userId },
          select: { correct: true, createdAt: true },
        }),
        this.prisma.tutorSession.findMany({
          where: { userId },
          select: { subject: true, createdAt: true },
        }),
        this.prisma.tutorMessage.findMany({
          where: { session: { userId }, role: 'user' },
          select: { viaVoice: true, createdAt: true },
        }),
        this.prisma.languageProfile.findMany({
          where: { userId },
          select: { language: true },
        }),
      ]);

    // Real level — reuse the knowledge twin's Learning Score.
    const tracked = twin.concepts.filter(
      (c) => c.cardCount > 0 && c.mastery !== null,
    ) as { mastery: number }[];
    const score =
      tracked.length > 0
        ? Math.round(
            (tracked.reduce((s, c) => s + c.mastery, 0) / tracked.length) * 100,
          )
        : null;

    // Every timestamped interaction, for rhythm + focus window.
    const times: Date[] = [
      ...lessons.map((l) => l.createdAt),
      ...attempts.map((a) => a.createdAt),
      ...sessions.map((s) => s.createdAt),
      ...messages.map((m) => m.createdAt),
    ];
    const interactions = times.length;
    const updatedAt =
      interactions > 0
        ? new Date(Math.max(...times.map((t) => t.getTime()))).toISOString()
        : null;

    return {
      level: { band: this.band(score), score },
      learningSpeed: this.speed(attempts),
      preferredSubjects: this.subjects(lessons, sessions),
      learningStyle: this.style(
        messages.filter((m) => m.viaVoice).length,
        attempts.length,
        lessons.length,
      ),
      explanationDepth: this.depth(lessons),
      preferredLanguage: this.language(lessons, languageProfiles),
      workRhythm: this.rhythm(times),
      focusWindow: this.focus(times),
      overallProgress: {
        score,
        conceptsTracked: twin.summary.trackedConcepts,
        lessons: lessons.length,
      },
      interactions,
      updatedAt,
    };
  }

  // ── dimensions ─────────────────────────────────────────────────────────────

  private band(score: number | null): LearnerBand {
    if (score === null) return 'new';
    return score >= 80 ? 'strong' : score >= 50 ? 'building' : 'weak';
  }

  private speed(attempts: { correct: boolean }[]): LearningSpeed | null {
    if (attempts.length < MIN_EXERCISES) return null;
    const rate = attempts.filter((a) => a.correct).length / attempts.length;
    return rate >= 0.8 ? 'fast' : rate >= 0.5 ? 'steady' : 'building';
  }

  private subjects(
    lessons: { topic: string }[],
    sessions: { subject: string | null }[],
  ): string[] {
    const counts = new Map<string, number>();
    const bump = (raw: string | null | undefined) => {
      const s = raw?.trim();
      if (!s) return;
      counts.set(s, (counts.get(s) ?? 0) + 1);
    };
    lessons.forEach((l) => bump(l.topic));
    sessions.forEach((s) => bump(s.subject));
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 3)
      .map(([name]) => name);
  }

  private style(
    voiceTurns: number,
    exercises: number,
    lessons: number,
  ): LearningStyle | null {
    const total = voiceTurns + exercises + lessons;
    if (total < MIN_STYLE) return null;
    const ranked: [LearningStyle, number][] = [
      ['voice', voiceTurns],
      ['handsOn', exercises],
      ['reading', lessons],
    ];
    ranked.sort((a, b) => b[1] - a[1]);
    return ranked[0][1] > 0 ? ranked[0][0] : null;
  }

  private depth(lessons: { level: string | null }[]): ExplanationDepth | null {
    const leveled = lessons.filter((l) => l.level);
    if (leveled.length === 0) return null;
    const counts = { beginner: 0, intermediate: 0, advanced: 0 };
    for (const l of leveled) {
      if (l.level === 'beginner') counts.beginner++;
      else if (l.level === 'advanced') counts.advanced++;
      else counts.intermediate++;
    }
    const top = (Object.entries(counts) as [keyof typeof counts, number][]).sort(
      (a, b) => b[1] - a[1],
    )[0][0];
    return top === 'beginner' ? 'simple' : top === 'advanced' ? 'deep' : 'balanced';
  }

  private language(
    lessons: { language: string | null }[],
    profiles: { language: string }[],
  ): string | null {
    const counts = new Map<string, number>();
    lessons.forEach((l) => {
      if (l.language) counts.set(l.language, (counts.get(l.language) ?? 0) + 1);
    });
    profiles.forEach((p) =>
      counts.set(p.language, (counts.get(p.language) ?? 0) + 1),
    );
    if (counts.size === 0) return null;
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
  }

  private rhythm(times: Date[]): WorkRhythm | null {
    if (times.length === 0) return null;
    const cutoff = Date.now() - 7 * DAY_MS;
    const recent = times.filter((t) => t.getTime() >= cutoff).length;
    if (recent === 0) return 'occasional';
    return recent >= 12 ? 'intensive' : recent >= 4 ? 'regular' : 'occasional';
  }

  private focus(times: Date[]): FocusWindow | null {
    if (times.length < MIN_FOCUS) return null;
    const buckets: Record<FocusWindow, number> = {
      morning: 0,
      afternoon: 0,
      evening: 0,
      night: 0,
    };
    for (const t of times) buckets[this.windowOf(t.getHours())]++;
    return (Object.entries(buckets) as [FocusWindow, number][]).sort(
      (a, b) => b[1] - a[1],
    )[0][0];
  }

  private windowOf(hour: number): FocusWindow {
    if (hour >= 5 && hour <= 11) return 'morning';
    if (hour >= 12 && hour <= 17) return 'afternoon';
    if (hour >= 18 && hour <= 22) return 'evening';
    return 'night';
  }
}
