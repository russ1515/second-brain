import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import type {
  ConsentKey,
  ConsentView,
  DataExportResponse,
} from '@second-brain/shared';
import { CONSENT_KEYS } from '@second-brain/shared';
import { PrismaService } from '../prisma/prisma.service';
import { DOCUMENT_CHUNKS_COLLECTION } from '../qdrant/qdrant.constants';
import { QdrantService } from '../qdrant/qdrant.service';

/**
 * Privacy & GDPR (Sprint 8.7). The three user rights: portability (export),
 * erasure (delete) and consent. Deletion is guarded by password re-entry, then
 * removes external vectors before relying on the schema's ON DELETE CASCADE
 * for relational data.
 */
@Injectable()
export class PrivacyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly qdrant: QdrantService,
  ) {}

  // ── consent ──────────────────────────────────────────────────────────────

  async getConsents(userId: string): Promise<ConsentView[]> {
    const rows = await this.prisma.consent.findMany({ where: { userId } });
    const byKey = new Map(rows.map((c) => [c.key, c]));
    return CONSENT_KEYS.map((key) => {
      const row = byKey.get(key);
      return {
        key,
        granted: row?.granted ?? false,
        updatedAt: row?.updatedAt.toISOString() ?? null,
      };
    });
  }

  async setConsent(
    userId: string,
    key: ConsentKey,
    granted: boolean,
  ): Promise<ConsentView> {
    const row = await this.prisma.consent.upsert({
      where: { userId_key: { userId, key } },
      create: { userId, key, granted },
      update: { granted },
    });
    return { key, granted: row.granted, updatedAt: row.updatedAt.toISOString() };
  }

  // ── erasure ──────────────────────────────────────────────────────────────

  async deleteAccount(userId: string, password: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });
    if (!user) throw new NotFoundException('Account not found.');
    const ok = await argon2.verify(user.passwordHash, password).catch(() => false);
    if (!ok) throw new ForbiddenException('Incorrect password.');
    // External vectors are not covered by SQL cascades. Delete them first: if
    // Qdrant is unavailable, retain the account so erasure can be retried and
    // no ownerless vectors are left behind.
    try {
      await this.qdrant.deleteByUser(DOCUMENT_CHUNKS_COLLECTION, userId);
    } catch {
      throw new ServiceUnavailableException({
        code: 'PRIVACY_ERASURE_UNAVAILABLE',
        message: 'Account deletion is temporarily unavailable. Please retry.',
        retryable: true,
      });
    }

    // ON DELETE CASCADE removes all relational data owned by the user.
    await this.prisma.user.delete({ where: { id: userId } });
  }

  // ── portability ──────────────────────────────────────────────────────────

  async exportData(userId: string): Promise<DataExportResponse> {
    const [
      account,
      authenticationActivity,
      onboarding,
      subscription,
      invoices,
      payments,
      documents,
      documentChunks,
      collections,
      studyResources,
      decks,
      cards,
      reviewLogs,
      concepts,
      conceptEdges,
      conceptCardLinks,
      conceptDocumentLinks,
      lessons,
      languageProfiles,
      tutorSessions,
      achievements,
      exerciseAttempts,
      dailyPlans,
      notifications,
      goals,
      exams,
      successPredictions,
      calendarEvents,
      reviewables,
      studySessions,
      homework,
      assessments,
      assessmentSubmissions,
      writing,
      reading,
      usage,
      memberships,
      groupMemberships,
      consents,
      aiInitiatives,
      coachProfile,
      learningPredictions,
      recommendations,
      mentorGuidance,
      learningDna,
      submittedReports,
      auditActivity,
    ] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          emailVerified: true,
          twoFactorEnabled: true,
          isAdmin: true,
          suspendedAt: true,
          lastActiveAt: true,
          createdAt: true,
          updatedAt: true,
          profile: true,
        },
      }),
      Promise.all([
        this.prisma.session.findMany({
          where: { userId },
          select: {
            id: true,
            userAgent: true,
            ipAddress: true,
            expiresAt: true,
            revokedAt: true,
            createdAt: true,
          },
        }),
        this.prisma.emailVerificationToken.findMany({
          where: { userId },
          select: { id: true, expiresAt: true, consumedAt: true, createdAt: true },
        }),
        this.prisma.emailOtp.findMany({
          where: { userId },
          select: {
            id: true,
            purpose: true,
            expiresAt: true,
            consumedAt: true,
            attempts: true,
            createdAt: true,
          },
        }),
        this.prisma.recoveryCode.findMany({
          where: { userId },
          select: { id: true, usedAt: true, createdAt: true },
        }),
      ]).then(([sessions, emailVerification, emailOtps, recoveryCodes]) => ({
        sessions,
        emailVerification,
        emailOtps,
        recoveryCodes,
      })),
      this.prisma.onboardingProfile.findUnique({ where: { userId } }),
      this.prisma.subscription.findUnique({
        where: { userId },
        include: { plan: true },
      }),
      this.prisma.invoice.findMany({ where: { userId } }),
      this.prisma.payment.findMany({ where: { userId } }),
      this.prisma.document.findMany({ where: { userId } }),
      this.prisma.documentChunk.findMany({ where: { userId } }),
      this.prisma.collection.findMany({ where: { userId } }),
      this.prisma.studyResource.findMany({ where: { userId } }),
      this.prisma.deck.findMany({ where: { userId } }),
      this.prisma.card.findMany({ where: { userId } }),
      this.prisma.reviewLog.findMany({ where: { userId } }),
      this.prisma.concept.findMany({ where: { userId } }),
      this.prisma.conceptEdge.findMany({ where: { userId } }),
      this.prisma.conceptCard.findMany({ where: { concept: { userId } } }),
      this.prisma.conceptDocument.findMany({ where: { concept: { userId } } }),
      this.prisma.lesson.findMany({ where: { userId } }),
      this.prisma.languageProfile.findMany({ where: { userId } }),
      this.prisma.tutorSession.findMany({
        where: { userId },
        include: { messages: true },
      }),
      this.prisma.achievement.findMany({ where: { userId } }),
      this.prisma.exerciseAttempt.findMany({ where: { userId } }),
      this.prisma.dailyPlan.findMany({ where: { userId }, include: { items: true } }),
      this.prisma.notification.findMany({ where: { userId } }),
      this.prisma.goal.findMany({ where: { userId } }),
      this.prisma.exam.findMany({ where: { userId } }),
      this.prisma.successPrediction.findMany({ where: { userId } }),
      this.prisma.calendarEvent.findMany({ where: { userId } }),
      this.prisma.reviewable.findMany({ where: { userId } }),
      this.prisma.studySession.findMany({ where: { userId } }),
      this.prisma.homework.findMany({ where: { userId } }),
      this.prisma.assessment.findMany({ where: { userId } }),
      this.prisma.assessmentSubmission.findMany({ where: { userId } }),
      this.prisma.writingSubmission.findMany({ where: { userId } }),
      this.prisma.readingExercise.findMany({ where: { userId } }),
      this.prisma.usageCounter.findMany({ where: { userId } }),
      this.prisma.membership.findMany({
        where: { userId },
        include: { organization: true },
      }),
      this.prisma.groupMember.findMany({
        where: { userId },
        include: { group: { include: { organization: true } } },
      }),
      this.prisma.consent.findMany({ where: { userId } }),
      this.prisma.aiInitiative.findMany({ where: { userId } }),
      this.prisma.coachProfile.findUnique({ where: { userId } }),
      this.prisma.learningPrediction.findMany({ where: { userId } }),
      this.prisma.recommendation.findMany({ where: { userId } }),
      this.prisma.mentorGuidance.findUnique({ where: { userId } }),
      this.prisma.learningDna.findUnique({ where: { userId } }),
      this.prisma.report.findMany({ where: { reporterId: userId } }),
      this.prisma.auditLog.findMany({ where: { actorId: userId } }),
    ]);

    return {
      generatedAt: new Date().toISOString(),
      data: {
        account,
        authenticationActivity,
        onboarding,
        subscription,
        invoices,
        payments,
        documents,
        documentChunks,
        collections,
        studyResources,
        decks,
        cards,
        reviewLogs,
        concepts,
        conceptEdges,
        conceptCardLinks,
        conceptDocumentLinks,
        lessons,
        languageProfiles,
        tutorSessions,
        achievements,
        exerciseAttempts,
        dailyPlans,
        notifications,
        goals,
        exams,
        successPredictions,
        calendarEvents,
        reviewables,
        studySessions,
        homework,
        assessments,
        assessmentSubmissions,
        writing,
        reading,
        usage,
        memberships,
        groupMemberships,
        consents,
        aiInitiatives,
        coachProfile,
        learningPredictions,
        recommendations,
        mentorGuidance,
        learningDna,
        submittedReports,
        auditActivity,
      },
    };
  }
}
