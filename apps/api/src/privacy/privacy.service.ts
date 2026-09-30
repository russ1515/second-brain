import {
  ConflictException,
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
import { PrivateMediaService } from '../media/private-media.service';
import { accountDataLockKey } from '../common/account-data-lock';

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
    private readonly privateMedia: PrivateMediaService,
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
    // Phase 1 commits a durable writer barrier before any external data is
    // removed. Ingestion takes this same lock and only accepts active owners.
    // Keep updatedAt as an optimistic token so a failed pre-cleanup restore
    // cannot overwrite a concurrent Admin account-state workflow.
    const deletion = await this.prisma.$transaction(async (tx) => {
      const lockKey = accountDataLockKey(userId);
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;
      const current = await tx.user.findUnique({
        where: { id: userId },
        select: { id: true, accountStatus: true, updatedAt: true },
      });
      if (!current) throw new NotFoundException('Account not found.');
      if (current.accountStatus === 'deletion_pending') {
        const administrativeRequest = await tx.accountDeletionRequest.findFirst({
          where: { userId, status: { in: ['requested', 'approved'] } },
          select: { id: true },
        });
        if (administrativeRequest) {
          throw new ConflictException('Account deletion is managed by an administrative workflow.');
        }
        // A prior self-erasure reached its durable barrier but failed during
        // cleanup. Resume it without ever reactivating a possibly partial account.
        return { stagedAt: current.updatedAt, canRestoreActive: false };
      }
      if (current.accountStatus !== 'active') {
        // Do not reinterpret an Admin-managed deletion/suspension workflow as
        // an immediate self-erasure request that bypasses its audit state.
        throw new ConflictException('Account deletion cannot start from its current state.');
      }
      const staged = await tx.user.update({
        where: { id: userId },
        data: { accountStatus: 'deletion_pending' },
        select: { updatedAt: true },
      });
      return { stagedAt: staged.updatedAt, canRestoreActive: true };
    }, { timeout: 60_000 });

    // Phase 2 keeps the same writer lock until Qdrant and the hard SQL delete
    // have reached a terminal state. The SQL delete is deliberately executed
    // by the regular client: it commits before the tombstone is purged, while
    // this transaction exists only to own the advisory lock.
    const purged = await this.prisma.$transaction(async (tx) => {
      const lockKey = accountDataLockKey(userId);
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;

      const staged = await tx.user.findFirst({
        where: {
          id: userId,
          accountStatus: 'deletion_pending',
          updatedAt: deletion.stagedAt,
        },
        select: { id: true },
      });
      if (!staged) {
        throw new ConflictException('Account deletion state changed before cleanup.');
      }

      try {
        await this.qdrant.deleteByUser(DOCUMENT_CHUNKS_COLLECTION, userId);
      } catch {
        // Qdrant failed before any destructive local mutation. Restore only the
        // exact row staged by this request; never overwrite an Admin transition.
        if (deletion.canRestoreActive) {
          await tx.user.updateMany({
            where: {
              id: userId,
              accountStatus: 'deletion_pending',
              updatedAt: deletion.stagedAt,
            },
            data: { accountStatus: 'active' },
          });
        }
        return false;
      }

      // Once Qdrant has been purged, any later failure intentionally leaves the
      // durable deletion_pending barrier in place. The media helper restores its
      // tombstone when the independently committed SQL delete fails.
      await this.privateMedia.deleteUserMediaAnd(userId, async () => {
        await this.prisma.user.delete({ where: { id: userId } });
      });
      return true;
    }, { timeout: 60_000 });

    if (!purged) {
      throw new ServiceUnavailableException({
        code: 'PRIVACY_ERASURE_UNAVAILABLE',
        message: 'Account deletion is temporarily unavailable. Please retry.',
        retryable: true,
      });
    }
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
      this.prisma.assessment.findMany({
        where: { userId },
        // `questions` contains server-side answer keys and grading rubrics.
        // Export learner-owned metadata and submissions, never solution data.
        select: {
          id: true,
          userId: true,
          type: true,
          topic: true,
          title: true,
          level: true,
          conceptId: true,
          createdAt: true,
        },
      }),
      this.prisma.assessmentSubmission.findMany({ where: { userId } }),
      this.prisma.writingSubmission.findMany({ where: { userId } }),
      this.prisma.readingExercise.findMany({
        where: { userId },
        // The persisted question payload includes answer keys. Learner results
        // remain portable, but the private marking material does not.
        select: {
          id: true,
          userId: true,
          level: true,
          topic: true,
          title: true,
          text: true,
          score: true,
          adaptedLevel: true,
          result: true,
          createdAt: true,
        },
      }),
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

    const privateMedia = await this.privateMedia.exportUserMedia(
      userId,
      documents.map((document) => document.id),
    );

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
        privateMedia,
      },
    };
  }
}
