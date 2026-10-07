import { Injectable } from '@nestjs/common';
import type { LearningReportView } from '@second-brain/shared';
import { toSupportedLanguage } from '@second-brain/shared';
import { LearnerPassportService } from '../onboarding/learner-passport.service';
import { PrismaService } from '../prisma/prisma.service';

/** Builds a read-only, non-billable and privacy-minimised learning report. */
@Injectable()
export class LearningReportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passports: LearnerPassportService,
  ) {}

  async get(userId: string, requestedLocale?: string): Promise<LearningReportView> {
    const [passport, profile, totals, latest, assessment, attempts, correctAttempts] =
      await Promise.all([
        this.passports.get(userId),
        this.prisma.profile.findUnique({
          where: { userId },
          select: { preferredLanguage: true, displayName: true },
        }),
        Promise.all([
          this.prisma.lesson.count({ where: { userId } }),
          this.prisma.tutorSession.count({ where: { userId } }),
          this.prisma.concept.count({ where: { userId } }),
          this.prisma.studySession.count({ where: { userId, status: 'done' } }),
          this.prisma.reviewLog.count({ where: { userId } }),
        ]),
        Promise.all([
          this.prisma.lesson.findFirst({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            select: { createdAt: true },
          }),
          this.prisma.tutorSession.findFirst({
            where: { userId },
            orderBy: { updatedAt: 'desc' },
            select: { updatedAt: true },
          }),
          this.prisma.studySession.findFirst({
            where: { userId },
            orderBy: { startedAt: 'desc' },
            select: { startedAt: true },
          }),
        ]),
        this.prisma.assessmentSubmission.aggregate({
          where: { userId },
          _count: { _all: true },
          _avg: { score: true },
        }),
        this.prisma.exerciseAttempt.aggregate({
          where: { userId },
          _count: { _all: true },
          _avg: { score: true },
        }),
        this.prisma.exerciseAttempt.count({ where: { userId, correct: true } }),
      ]);

    const lastLearningActivityAt = latest
      .flatMap((entry) => (entry ? Object.values(entry) : []))
      .filter((value): value is Date => value instanceof Date)
      .sort((a, b) => b.getTime() - a.getTime())[0]
      ?.toISOString() ?? null;
    const locale =
      toSupportedLanguage(requestedLocale) ??
      toSupportedLanguage(profile?.preferredLanguage) ??
      'en';
    const assessmentSubmissions = assessment._count._all;
    const exerciseAttempts = attempts._count._all;

    return {
      generatedAt: new Date().toISOString(),
      locale,
      learnerName: profile?.displayName?.trim() || null,
      declared: { source: 'DECLARED', profile: passport.declared },
      observed: {
        source: 'OBSERVED',
        learnerProfile: passport.observed.learnerProfile,
        learningDna: passport.observed.learningDna,
        totals: {
          lessons: totals[0],
          tutorSessions: totals[1],
          concepts: totals[2],
          completedStudySessions: totals[3],
          reviews: totals[4],
        },
        lastLearningActivityAt,
      },
      assessed: {
        source: 'ASSESSED',
        assessmentSubmissions,
        averageAssessmentScore: assessment._avg.score,
        exerciseAttempts,
        correctExerciseAttempts: correctAttempts,
        averageExerciseScore: attempts._avg.score,
        evidenceAvailable: assessmentSubmissions + exerciseAttempts > 0,
      },
      exclusions: [
        'RAW_CONVERSATIONS',
        'FULL_DOCUMENTS',
        'AUTH_SECRETS',
        'FINANCIAL_DETAILS',
      ],
    };
  }
}
