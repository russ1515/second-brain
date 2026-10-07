import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  LearningResetRequirements,
  LearningResetResponse,
  ResetLearningRequest,
} from '@second-brain/shared';
import type { Prisma } from '@prisma/client';
import * as argon2 from 'argon2';
import { accountDataLockKey } from '../common/account-data-lock';
import { PrivateMediaService } from '../media/private-media.service';
import { PrismaService } from '../prisma/prisma.service';
import { DOCUMENT_CHUNKS_COLLECTION } from '../qdrant/qdrant.constants';
import { QdrantService } from '../qdrant/qdrant.service';
import { CacheService } from '../redis/cache.service';

const RESET_CONFIRMATION = 'RÉINITIALISER';

/**
 * Clears the authenticated owner's pedagogical workspace without mutating the
 * account, security, billing, entitlements, consumed quota or interface locale.
 */
@Injectable()
export class LearningResetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly qdrant: QdrantService,
    private readonly privateMedia: PrivateMediaService,
    private readonly config: ConfigService,
    private readonly cache: CacheService,
  ) {}

  async getRequirements(userId: string): Promise<LearningResetRequirements> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { twoFactorEnabled: true },
    });
    if (!user) throw new NotFoundException('Account not found.');
    return { mfaRequired: user.twoFactorEnabled };
  }

  async resetLearning(
    userId: string,
    sessionId: string,
    request: ResetLearningRequest,
  ): Promise<LearningResetResponse> {
    // DTO validation owns the normal HTTP path; this guard also protects direct
    // service use and future transports from weakening the strong confirmation.
    if (request.confirmation !== RESET_CONFIRMATION) {
      throw new ForbiddenException({ code: 'LEARNING_RESET_CONFIRMATION_REQUIRED' });
    }

    const resetAt = await this.prisma.$transaction(async (lockTx) => {
      const lockKey = accountDataLockKey(userId);
      await lockTx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;

      const [user, session] = await Promise.all([
        lockTx.user.findUnique({
          where: { id: userId },
          select: {
            passwordHash: true,
            twoFactorEnabled: true,
            accountStatus: true,
          },
        }),
        lockTx.session.findFirst({
          where: {
            id: sessionId,
            userId,
            revokedAt: null,
            expiresAt: { gt: new Date() },
          },
          select: { mfaVerifiedAt: true },
        }),
      ]);
      if (!user || !session) throw new NotFoundException('Active session not found.');
      if (user.accountStatus !== 'active') {
        throw new ConflictException({ code: 'ACCOUNT_NOT_ACTIVE' });
      }

      const passwordMatches = await argon2
        .verify(user.passwordHash, request.password)
        .catch(() => false);
      if (!passwordMatches) {
        throw new ForbiddenException({ code: 'REAUTHENTICATION_FAILED' });
      }

      if (user.twoFactorEnabled && !this.isRecentMfa(session.mfaVerifiedAt)) {
        throw new ForbiddenException({
          code: 'MFA_STEP_UP_REQUIRED',
          endpoint: '/api/auth/2fa/step-up',
        });
      }

      try {
        await this.qdrant.deleteByUser(DOCUMENT_CHUNKS_COLLECTION, userId);
      } catch {
        throw new ServiceUnavailableException({
          code: 'LEARNING_RESET_VECTOR_PURGE_UNAVAILABLE',
          message: 'Learning reset is temporarily unavailable. Please retry.',
          retryable: true,
        });
      }

      return this.privateMedia.deleteLearningMediaAnd(userId, async () => {
        return this.prisma.$transaction(async (tx) => {
          const deleted = await this.purgePedagogicalData(tx, userId);
          const completedAt = new Date();
          await tx.auditLog.create({
            data: {
              actorId: userId,
              actorRole: 'USER',
              action: 'USER_LEARNING_RESET',
              targetType: 'USER',
              targetId: userId,
              reason: 'self_service_learning_reset',
              metadata: {
                deletedRecords: deleted,
                accountPreserved: true,
                consumedQuotaPreserved: true,
              },
              result: 'success',
            },
          });
          return completedAt;
        }, { timeout: 120_000 });
      });
    }, { timeout: 180_000 });

    // Cached projections must not make deleted learning data reappear after the
    // transaction commits. CacheService is best-effort and never weakens the
    // authoritative database result if Redis is temporarily unavailable.
    await Promise.all([
      this.cache.invalidate(`ai-mentor:${userId}`),
      this.cache.invalidate(`success:${userId}`),
      this.cache.invalidate(`learning-dna:${userId}`),
      this.cache.invalidate(`foresight:${userId}`),
      this.cache.invalidate(`insights-center:${userId}`),
      this.cache.invalidatePrefix('research:web:'),
    ]);

    return { resetAt: resetAt.toISOString(), onboardingRequired: true };
  }

  private isRecentMfa(verifiedAt: Date | null): boolean {
    if (!verifiedAt) return false;
    const configuredSeconds = this.config.get<number>('admin.stepUpTtl', 600);
    const seconds = Number.isFinite(configuredSeconds) && configuredSeconds > 0
      ? configuredSeconds
      : 600;
    return Date.now() - verifiedAt.getTime() <= seconds * 1000;
  }

  private async purgePedagogicalData(
    tx: Prisma.TransactionClient,
    userId: string,
  ): Promise<number> {
    let deleted = 0;
    const add = (result: { count: number }) => { deleted += result.count; };

    // Delete owner-scoped children first. This keeps the boundary explicit and
    // makes a future schema relation less likely to retain learner content.
    add(await tx.reviewLog.deleteMany({ where: { userId } }));
    add(await tx.documentChunk.deleteMany({ where: { userId } }));
    add(await tx.conceptEdge.deleteMany({ where: { userId } }));
    add(await tx.conceptCard.deleteMany({ where: { concept: { userId } } }));
    add(await tx.conceptDocument.deleteMany({ where: { concept: { userId } } }));
    add(await tx.exerciseAttempt.deleteMany({ where: { userId } }));
    add(await tx.homework.deleteMany({ where: { userId } }));
    add(await tx.assessmentSubmission.deleteMany({ where: { userId } }));
    add(await tx.studyResource.deleteMany({ where: { userId } }));

    add(await tx.experienceSession.deleteMany({ where: { userId } }));
    add(await tx.dailyPlan.deleteMany({ where: { userId } }));
    add(await tx.calendarEvent.deleteMany({ where: { userId } }));
    add(await tx.notification.deleteMany({ where: { userId } }));
    add(await tx.reviewable.deleteMany({ where: { userId } }));
    add(await tx.studySession.deleteMany({ where: { userId } }));
    add(await tx.academicWorkspace.deleteMany({ where: { userId } }));
    add(await tx.assessment.deleteMany({ where: { userId } }));
    add(await tx.writingSubmission.deleteMany({ where: { userId } }));
    add(await tx.readingExercise.deleteMany({ where: { userId } }));
    add(await tx.lesson.deleteMany({ where: { userId } }));
    add(await tx.tutorSession.deleteMany({ where: { userId } }));
    add(await tx.languageProfile.deleteMany({ where: { userId } }));
    add(await tx.successPrediction.deleteMany({ where: { userId } }));
    add(await tx.exam.deleteMany({ where: { userId } }));
    add(await tx.goal.deleteMany({ where: { userId } }));
    add(await tx.card.deleteMany({ where: { userId } }));
    add(await tx.deck.deleteMany({ where: { userId } }));
    add(await tx.concept.deleteMany({ where: { userId } }));
    add(await tx.document.deleteMany({ where: { userId } }));
    add(await tx.collection.deleteMany({ where: { userId } }));
    add(await tx.achievement.deleteMany({ where: { userId } }));
    add(await tx.aiInitiative.deleteMany({ where: { userId } }));
    add(await tx.coachProfile.deleteMany({ where: { userId } }));
    add(await tx.learningPrediction.deleteMany({ where: { userId } }));
    add(await tx.recommendation.deleteMany({ where: { userId } }));
    add(await tx.mentorGuidance.deleteMany({ where: { userId } }));
    add(await tx.learningDna.deleteMany({ where: { userId } }));
    add(await tx.onboardingProfile.deleteMany({ where: { userId } }));

    return deleted;
  }
}
