import { createHash } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  LanguageMasteryAttemptStatus,
  LanguageMasteryAttemptVerdict,
  LanguageMasteryRemediationPlanStatus,
  LanguageMasteryRemediationState,
  LanguageMasteryScopeKind,
  LearningCompletionKind,
  LearningCompletionStatus,
  Prisma,
} from '@prisma/client';
import {
  CEFR_LEVELS,
  LANGUAGE_MASTERY_PILLARS,
  LANGUAGE_MASTERY_POLICY_VERSION,
  LANGUAGE_REMEDIATION_MINIMUM_EXERCISES,
  LANGUAGE_MASTERY_THRESHOLD,
  LANGUAGE_TRAINING_FORMATS,
  RLLE_LANGUAGE_MASTERY_MAPPING_VERSION,
  RLLE_LANGUAGE_MASTERY_UNIT_MAP,
  getRlleLevelPillarPlans,
  languageMasteryLearningRef,
  rlleMilestoneEvidenceScopeKey,
  toSupportedLanguage,
  type CefrLevel,
  type LanguageMasteryDecision,
  type LanguageMasteryPillar,
  type LanguageTrainingEvidenceState,
  type LanguageTrainingFormat,
} from '@second-brain/shared';
import { PrismaService } from '../prisma/prisma.service';
import { LearningCompletionService } from '../learning-evidence/learning-completion.service';
import { accountDataLockKey } from '../common/account-data-lock';

const MAX_KEY = 240;
const MAX_SCOPE = 800;
const MAX_TARGET = 400;

type AttemptWithEvidence = Prisma.LanguageMasteryAttemptGetPayload<{
  include: {
    completion: { select: { id: true; status: true } };
    remediationEvidence: { orderBy: { recordedAt: 'asc' } };
    failedRemediationPlan: {
      select: {
        id: true;
        status: true;
        remediationLessonId: true;
        requiredExerciseCount: true;
      };
    };
  };
}>;

type RemediationPlanWithEvidence = Prisma.LanguageMasteryRemediationPlanGetPayload<{
  include: {
    failedAttempt: { select: { attemptId: true; evaluatedAt: true } };
    evidence: { orderBy: { recordedAt: 'asc' } };
  };
}>;

type LanguageMasteryAttemptStore = Pick<Prisma.TransactionClient, 'languageMasteryAttempt'>;

export interface StartLanguageMasteryAttemptInput {
  languageProfileId: string;
  experienceSessionId?: string | null;
  lessonId?: string | null;
  idempotencyKey: string;
  scopeKind: 'unit_autonomy' | 'milestone' | 'pillar_exam';
  scopeKey: string;
  targetId: string;
  mappingVersion: typeof RLLE_LANGUAGE_MASTERY_MAPPING_VERSION;
  policyVersion: typeof LANGUAGE_MASTERY_POLICY_VERSION;
  masteryContentVersion: string | null;
  contentDefinitionId: string | null;
  sourceContentVersion: number;
  languageCode: string;
  cefrLevel: CefrLevel;
  pillar: LanguageMasteryPillar | null;
  /** Required only for a pillar retest after a durable, completed remediation. */
  remediationPlanId?: string | null;
}

export interface LanguageMasteryAttemptCriterion {
  id: string;
  met: boolean;
  score: number | null;
}

export interface AppendLanguageMasteryOutcomeInput {
  attemptId: string;
  assessmentSubmissionId: string;
  decision: LanguageMasteryDecision;
  criteria: readonly LanguageMasteryAttemptCriterion[];
}

export interface AppendNotEvaluableLanguageMasteryInput {
  attemptId: string;
  decision: LanguageMasteryDecision;
  criteria?: readonly LanguageMasteryAttemptCriterion[];
}

export interface AppendLanguageMasteryRemediationInput {
  attemptId: string;
  remediationPlanId: string;
  evidenceId: string;
  trainingFormat: LanguageTrainingFormat;
  state: LanguageTrainingEvidenceState;
  lessonId: string;
  sourceContentVersion: number;
  exerciseIndex: number;
  /** Only a durable, owner-scoped ExerciseAttempt can count for remediation.
   * Acoustic coaching has no canonical persisted source yet and must remain
   * NOT_EVALUABLE rather than receiving synthetic credit. */
  sourceKind: 'exercise-attempt';
  sourceRefId: string;
}

export interface StartLanguageMasteryRemediationPlanInput {
  failedAttemptId: string;
  idempotencyKey: string;
}

export interface BindLanguageMasteryRemediationLessonInput {
  remediationPlanId: string;
  lessonId: string;
}

export interface LanguageMasteryRemediationPlanProjection {
  id: string;
  failedAttemptId: string;
  languageProfileId: string;
  scopeKey: string;
  targetId: string;
  generationKey: string;
  remediationLessonId: string | null;
  requiredExerciseCount: typeof LANGUAGE_REMEDIATION_MINIMUM_EXERCISES;
  completedExerciseCount: number;
  evidenceCount: number;
  status: 'preparing' | 'active' | 'ready_for_retest' | 'retest_started' | 'completed';
  startedAt: string;
  readyAt: string | null;
}

export interface LanguageMasteryAttemptProjection {
  id: string;
  attemptId: string;
  idempotencyKey: string;
  scopeKind: 'unit_autonomy' | 'milestone' | 'pillar_exam';
  scopeKey: string;
  targetId: string;
  mappingVersion: string;
  policyVersion: string;
  masteryContentVersion: string | null;
  contentDefinitionId: string | null;
  sourceContentVersion: number;
  lessonId: string | null;
  languageCode: string;
  cefrLevel: string;
  pillar: string | null;
  status: 'started' | 'assessment_bound' | 'evaluated' | 'technical-error';
  verdict: 'mastered' | 'not-mastered' | 'not-evaluable' | null;
  rawScore: number | null;
  threshold: number;
  decisionReason: string | null;
  helpUsed: boolean;
  decision: LanguageMasteryDecision | null;
  criteria: LanguageMasteryAttemptCriterion[];
  assessmentId: string | null;
  assessmentSubmissionId: string | null;
  completionId: string | null;
  remediation: {
    planId: string | null;
    status: 'preparing' | 'active' | 'ready_for_retest' | 'retest_started' | 'completed' | null;
    lessonId: string | null;
    requiredExerciseCount: typeof LANGUAGE_REMEDIATION_MINIMUM_EXERCISES;
    completedExerciseCount: number;
    evidenceCount: number;
    evidence: Array<{
      id: string;
      evidenceId: string;
      trainingFormat: string;
      state: 'completed' | 'not-evaluable';
      lessonId: string;
      sourceContentVersion: number;
      exerciseIndex: number;
      sourceKind: string;
      sourceRefId: string;
      recordedAt: string;
    }>;
  } | null;
  startedAt: string;
  evaluatedAt: string | null;
}

/**
 * Owner-scoped persistence boundary for the strict language-mastery path.
 *
 * The service never grades and never decides mastery. Examiner persists the
 * response first; the deterministic policy produces a server decision; this
 * journal then binds both to an immutable versioned scope. Only the optional
 * LearningCompletion link can publish a mastered attempt as product evidence.
 */
@Injectable()
export class LanguageMasteryAttemptService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly completions: LearningCompletionService,
  ) {}

  async start(
    userId: string,
    input: StartLanguageMasteryAttemptInput,
  ): Promise<LanguageMasteryAttemptProjection> {
    const normalized = this.normalizedStart(input);
    const startHash = this.hash(normalized);
    const attemptId = `rlle:${createHash('sha256')
      .update(`${userId}:${normalized.scopeKey}:${normalized.idempotencyKey}`)
      .digest('hex')
      .slice(0, 32)}`;

    let row: AttemptWithEvidence;
    try {
      row = await this.prisma.$transaction(async (tx) => {
        await this.lockOwner(tx, userId);
        await this.requireOwnedSources(tx, userId, normalized);
        const existing = await tx.languageMasteryAttempt.findUnique({
          where: { userId_attemptId: { userId, attemptId } },
        });
        if (existing) {
          if (existing.startHash !== startHash) {
            throw new ConflictException('Language mastery idempotency key was already used for another scope.');
          }
          return this.withRelations(tx, existing.id);
        }
        if (normalized.scopeKind === 'pillar_exam') {
          const latestFailure = await tx.languageMasteryAttempt.findFirst({
            where: {
              userId,
              languageProfileId: normalized.languageProfileId,
              scopeKind: LanguageMasteryScopeKind.pillar_exam,
              scopeKey: normalized.scopeKey,
              mappingVersion: normalized.mappingVersion,
              policyVersion: normalized.policyVersion,
              status: LanguageMasteryAttemptStatus.evaluated,
              verdict: LanguageMasteryAttemptVerdict.not_mastered,
            },
            orderBy: [{ evaluatedAt: 'desc' }, { id: 'desc' }],
            include: {
              failedRemediationPlan: { select: { id: true, status: true } },
            },
          });
          const unresolvedPlan = latestFailure?.failedRemediationPlan;
          const unresolved = Boolean(
            latestFailure
            && (!unresolvedPlan || unresolvedPlan.status !== LanguageMasteryRemediationPlanStatus.completed),
          );
          if (
            unresolved
            && (
              !normalized.remediationPlanId
              || !unresolvedPlan
              || normalized.remediationPlanId !== unresolvedPlan.id
            )
          ) {
            throw new ConflictException(
              'The latest failed pillar exam must complete its targeted remediation before a retest.',
            );
          }
        }
        if (normalized.remediationPlanId) {
          const readyPlan = await tx.languageMasteryRemediationPlan.findFirst({
            where: {
              id: normalized.remediationPlanId,
              userId,
              languageProfileId: normalized.languageProfileId,
              scopeKey: normalized.scopeKey,
              status: LanguageMasteryRemediationPlanStatus.ready_for_retest,
            },
            select: { id: true },
          });
          if (!readyPlan) {
            throw new ConflictException(
              'A pillar retest requires a remediation plan with ten completed new exercises.',
            );
          }
        }
        const created = await tx.languageMasteryAttempt.create({
          data: {
            userId,
            ...normalized,
            attemptId,
            startHash,
            scopeKind: normalized.scopeKind === 'unit_autonomy'
              ? LanguageMasteryScopeKind.unit_autonomy
              : normalized.scopeKind === 'milestone'
                ? LanguageMasteryScopeKind.milestone
                : LanguageMasteryScopeKind.pillar_exam,
            status: LanguageMasteryAttemptStatus.started,
            threshold: LANGUAGE_MASTERY_THRESHOLD,
          },
        });
        if (normalized.remediationPlanId) {
          const linked = await tx.languageMasteryRemediationPlan.updateMany({
            where: {
              id: normalized.remediationPlanId,
              userId,
              status: LanguageMasteryRemediationPlanStatus.ready_for_retest,
            },
            data: { status: LanguageMasteryRemediationPlanStatus.retest_started },
          });
          if (linked.count !== 1) {
            throw new ConflictException('Concurrent pillar retest already started.');
          }
        }
        return this.withRelations(tx, created.id);
      });
    } catch (error) {
      if (!this.uniqueConflict(error)) throw error;
      const concurrent = await this.prisma.languageMasteryAttempt.findFirst({
        where: { userId, scopeKey: normalized.scopeKey, idempotencyKey: normalized.idempotencyKey },
      });
      if (!concurrent || concurrent.startHash !== startHash) {
        throw new ConflictException('Language mastery attempt already exists with different immutable input.');
      }
      row = await this.withRelations(this.prisma, concurrent.id);
    }
    return this.project(row);
  }

  async bindAssessment(
    userId: string,
    attemptId: string,
    assessmentId: string,
  ): Promise<LanguageMasteryAttemptProjection> {
    const row = await this.prisma.$transaction(async (tx) => {
      await this.lockOwner(tx, userId);
      const attempt = await tx.languageMasteryAttempt.findFirst({ where: { userId, attemptId } });
      if (!attempt) throw new NotFoundException('Language mastery attempt not found.');
      if (attempt.assessmentId) {
        if (attempt.assessmentId !== assessmentId) {
          throw new ConflictException('Language mastery attempt is already bound to another assessment.');
        }
        return this.withRelations(tx, attempt.id);
      }
      if (attempt.status !== LanguageMasteryAttemptStatus.started) {
        throw new ConflictException('Only a started language mastery attempt can bind an assessment.');
      }
      const assessment = await tx.assessment.findFirst({
        where: { id: assessmentId, userId },
        select: {
          id: true,
          lessonId: true,
          contentVersion: true,
          masteryCreationKey: true,
        },
      });
      if (
        !assessment
        || assessment.lessonId !== attempt.lessonId
        || assessment.contentVersion !== attempt.sourceContentVersion
        || assessment.masteryCreationKey !== attempt.attemptId
      ) {
        throw new NotFoundException('Versioned language mastery assessment not found.');
      }
      const bound = await tx.languageMasteryAttempt.updateMany({
        where: {
          id: attempt.id,
          userId,
          status: LanguageMasteryAttemptStatus.started,
          assessmentId: null,
        },
        data: {
          assessmentId: assessment.id,
          status: LanguageMasteryAttemptStatus.assessment_bound,
        },
      });
      if (bound.count !== 1) {
        const concurrent = await tx.languageMasteryAttempt.findUnique({ where: { id: attempt.id } });
        if (!concurrent || concurrent.assessmentId !== assessment.id) {
          throw new ConflictException('Concurrent assessment binding differs from this retry.');
        }
      }
      return this.withRelations(tx, attempt.id);
    });
    return this.project(row);
  }

  async get(
    userId: string,
    attemptId: string,
  ): Promise<LanguageMasteryAttemptProjection> {
    const owned = await this.prisma.languageMasteryAttempt.findFirst({
      where: { userId, attemptId: this.required(attemptId, 'attempt id', MAX_KEY) },
      select: { id: true },
    });
    if (!owned) throw new NotFoundException('Language mastery attempt not found.');
    const row = await this.withRelations(this.prisma, owned.id);
    const projected = this.project(row);
    if (projected.completionId || !this.isPublishableMasteryRow(row)) return projected;
    const identity = this.canonicalCompletionIdentity(row);
    if (!identity) return projected;
    const completion = await this.prisma.learningCompletion.findFirst({
      where: {
        userId,
        kind: identity.kind,
        learningRefId: identity.learningRefId,
        status: LearningCompletionStatus.verified,
      },
      select: { id: true },
    });
    return this.project(row, completion?.id ?? null);
  }

  async appendOutcome(
    userId: string,
    input: AppendLanguageMasteryOutcomeInput,
  ): Promise<LanguageMasteryAttemptProjection> {
    const row = await this.prisma.$transaction(async (tx) => {
      await this.lockOwner(tx, userId);
      const attempt = await tx.languageMasteryAttempt.findFirst({
        where: { userId, attemptId: this.required(input.attemptId, 'attempt id', MAX_KEY) },
      });
      if (!attempt) throw new NotFoundException('Language mastery attempt not found.');
      const submission = await tx.assessmentSubmission.findFirst({
        where: {
          id: this.required(input.assessmentSubmissionId, 'submission id', MAX_KEY),
          userId,
          OR: [{ masteryGenerationStatus: null }, { masteryGenerationStatus: 'ready' }],
        },
        include: { assessment: true },
      });
      if (
        !submission
        || !attempt.assessmentId
        || submission.assessmentId !== attempt.assessmentId
        || submission.assessment.userId !== userId
        || submission.assessment.lessonId !== attempt.lessonId
        || submission.assessment.contentVersion !== attempt.sourceContentVersion
      ) {
        throw new NotFoundException('Owned versioned language mastery submission not found.');
      }
      const criteria = this.normalizedCriteria(input.criteria);
      const evaluatedAt = submission.createdAt;
      const decision = this.validDecision(input.decision, submission.results, criteria);
      const decisionHash = this.hash({
        attemptId: attempt.attemptId,
        assessmentSubmissionId: submission.id,
        decision,
        criteria,
        evaluatedAt: evaluatedAt.toISOString(),
      });

      if (attempt.status === LanguageMasteryAttemptStatus.evaluated) {
        if (
          attempt.assessmentSubmissionId !== submission.id
          || attempt.decisionHash !== decisionHash
        ) {
          throw new ConflictException('Language mastery outcome is append-only and already differs.');
        }
        return this.withRelations(tx, attempt.id);
      }
      await this.requireResolvedPillarRemediationForSubmission(tx, userId, attempt);
      if (attempt.status !== LanguageMasteryAttemptStatus.assessment_bound) {
        throw new ConflictException('Language mastery assessment must be bound before evaluation.');
      }
      const updated = await tx.languageMasteryAttempt.updateMany({
        where: {
          id: attempt.id,
          userId,
          status: LanguageMasteryAttemptStatus.assessment_bound,
          decisionHash: null,
        },
        data: {
          assessmentSubmissionId: submission.id,
          status: LanguageMasteryAttemptStatus.evaluated,
          verdict: this.prismaVerdict(decision.verdict),
          rawScore: decision.rawScore,
          decisionReason: decision.reason,
          helpUsed: decision.helpUsed,
          decision: decision as unknown as Prisma.InputJsonValue,
          criteria: criteria as unknown as Prisma.InputJsonValue,
          decisionHash,
          evaluatedAt,
        },
      });
      if (updated.count !== 1) {
        const concurrent = await tx.languageMasteryAttempt.findUnique({ where: { id: attempt.id } });
        if (
          !concurrent
          || concurrent.assessmentSubmissionId !== submission.id
          || concurrent.decisionHash !== decisionHash
        ) {
          throw new ConflictException('Concurrent language mastery outcome differs from this retry.');
        }
      }
      await this.advanceRetestPlan(
        tx,
        userId,
        attempt.remediationPlanId,
        decision.verdict === 'not-evaluable',
        evaluatedAt,
      );
      return this.withRelations(tx, attempt.id);
    });
    return this.project(row);
  }

  /** Persist a provider/measurement failure even when Examiner could not
   * produce an AssessmentSubmission. It is neutral: no score, completion,
   * remediation or progress credit can be derived from this row. */
  async appendNotEvaluable(
    userId: string,
    input: AppendNotEvaluableLanguageMasteryInput,
  ): Promise<LanguageMasteryAttemptProjection> {
    const row = await this.prisma.$transaction(async (tx) => {
      await this.lockOwner(tx, userId);
      const attempt = await tx.languageMasteryAttempt.findFirst({
        where: { userId, attemptId: this.required(input.attemptId, 'attempt id', MAX_KEY) },
      });
      if (!attempt) throw new NotFoundException('Language mastery attempt not found.');
      if (
        input.decision.policyVersion !== LANGUAGE_MASTERY_POLICY_VERSION
        || input.decision.threshold !== LANGUAGE_MASTERY_THRESHOLD
        || input.decision.verdict !== 'not-evaluable'
        || input.decision.rawScore !== null
      ) {
        throw new BadRequestException('Technical language evidence must be a scoreless NOT_EVALUABLE decision.');
      }
      if (![
        'training-incomplete',
        'autonomy-missing',
        'autonomy-incomplete',
        'autonomy-item-not-evaluable',
        'invalid-rubric',
      ].includes(input.decision.reason)) {
        throw new BadRequestException('This decision reason requires evaluated submission evidence.');
      }
      const criteria = this.normalizedCriteria(input.criteria ?? [], true);
      if (criteria.some((criterion) => criterion.met || criterion.score !== null)) {
        throw new BadRequestException('NOT_EVALUABLE evidence requires scoreless unmet criteria.');
      }
      const evaluatedAt = new Date();
      const decisionHash = this.hash({
        attemptId: attempt.attemptId,
        assessmentSubmissionId: null,
        decision: input.decision,
        criteria,
      });
      if (attempt.status === LanguageMasteryAttemptStatus.evaluated) {
        if (attempt.assessmentSubmissionId || attempt.decisionHash !== decisionHash) {
          throw new ConflictException('Language mastery outcome is append-only and already differs.');
        }
        return this.withRelations(tx, attempt.id);
      }
      await this.requireResolvedPillarRemediationForSubmission(tx, userId, attempt);
      const updated = await tx.languageMasteryAttempt.updateMany({
        where: {
          id: attempt.id,
          userId,
          status: { in: [LanguageMasteryAttemptStatus.started, LanguageMasteryAttemptStatus.assessment_bound] },
          decisionHash: null,
        },
        data: {
          status: LanguageMasteryAttemptStatus.evaluated,
          verdict: LanguageMasteryAttemptVerdict.not_evaluable,
          rawScore: null,
          decisionReason: input.decision.reason,
          helpUsed: input.decision.helpUsed,
          decision: input.decision as unknown as Prisma.InputJsonValue,
          criteria: criteria as unknown as Prisma.InputJsonValue,
          decisionHash,
          evaluatedAt,
        },
      });
      if (updated.count !== 1) {
        const concurrent = await tx.languageMasteryAttempt.findUnique({ where: { id: attempt.id } });
        if (!concurrent || concurrent.assessmentSubmissionId || concurrent.decisionHash !== decisionHash) {
          throw new ConflictException('Concurrent language mastery outcome differs from this retry.');
        }
      }
      await this.advanceRetestPlan(tx, userId, attempt.remediationPlanId, true, evaluatedAt);
      return this.withRelations(tx, attempt.id);
    });
    return this.project(row);
  }

  async publishCompletion(
    userId: string,
    attemptId: string,
  ): Promise<LanguageMasteryAttemptProjection> {
    const completion = await this.completions.finalizeLanguageMastery(userId, {
      attemptId: this.required(attemptId, 'attempt id', MAX_KEY),
    });
    const attempt = await this.get(userId, attemptId);
    return { ...attempt, completionId: completion.id };
  }

  async startRemediationPlan(
    userId: string,
    input: StartLanguageMasteryRemediationPlanInput,
  ): Promise<LanguageMasteryRemediationPlanProjection> {
    const failedAttemptId = this.required(input.failedAttemptId, 'failed attempt id', MAX_KEY);
    const idempotencyKey = this.required(input.idempotencyKey, 'idempotency key', MAX_KEY);
    const failed = await this.prisma.languageMasteryAttempt.findFirst({
      where: { userId, attemptId: failedAttemptId },
    });
    if (
      !failed
      || failed.scopeKind !== LanguageMasteryScopeKind.pillar_exam
      || failed.status !== LanguageMasteryAttemptStatus.evaluated
      || failed.verdict !== LanguageMasteryAttemptVerdict.not_mastered
      || !failed.evaluatedAt
    ) {
      throw new UnprocessableEntityException(
        'Targeted remediation requires an owned evaluated failed pillar exam.',
      );
    }
    // A failed pillar has exactly one canonical remediation plan. Operation
    // idempotency keys may differ between the automatic failure hook and the
    // later user command, so they must not alter plan identity/provenance.
    const generationKey = 'rlle-remediation:' + createHash('sha256')
      .update([userId, failed.id].join(':'))
      .digest('hex')
      .slice(0, 32);
    const startHash = this.hash({
      userId,
      failedAttemptId: failed.id,
      generationKey,
      scopeKey: failed.scopeKey,
      targetId: failed.targetId,
      mappingVersion: failed.mappingVersion,
      policyVersion: failed.policyVersion,
      masteryContentVersion: failed.masteryContentVersion,
      requiredExerciseCount: LANGUAGE_REMEDIATION_MINIMUM_EXERCISES,
    });
    let plan: RemediationPlanWithEvidence;
    try {
      plan = await this.prisma.$transaction(async (tx) => {
        await this.lockOwner(tx, userId);
        const existing = await tx.languageMasteryRemediationPlan.findFirst({
          where: { userId, failedAttemptId: failed.id },
          include: {
            failedAttempt: { select: { attemptId: true, evaluatedAt: true } },
            evidence: { orderBy: { recordedAt: 'asc' } },
          },
        });
        if (existing) {
          if (existing.startHash !== startHash) {
            throw new ConflictException('A different remediation plan already exists for this failure.');
          }
          return existing;
        }
        return tx.languageMasteryRemediationPlan.create({
          data: {
            userId,
            languageProfileId: failed.languageProfileId,
            failedAttemptId: failed.id,
            idempotencyKey,
            generationKey,
            startHash,
            scopeKey: failed.scopeKey,
            targetId: failed.targetId,
            mappingVersion: failed.mappingVersion,
            policyVersion: failed.policyVersion,
            masteryContentVersion: failed.masteryContentVersion,
            requiredExerciseCount: LANGUAGE_REMEDIATION_MINIMUM_EXERCISES,
            status: LanguageMasteryRemediationPlanStatus.preparing,
          },
          include: {
            failedAttempt: { select: { attemptId: true, evaluatedAt: true } },
            evidence: { orderBy: { recordedAt: 'asc' } },
          },
        });
      });
    } catch (error) {
      if (!this.uniqueConflict(error)) throw error;
      const concurrent = await this.prisma.languageMasteryRemediationPlan.findFirst({
        where: { userId, failedAttemptId: failed.id },
        include: {
          failedAttempt: { select: { attemptId: true, evaluatedAt: true } },
          evidence: { orderBy: { recordedAt: 'asc' } },
        },
      });
      if (!concurrent || concurrent.startHash !== startHash) {
        throw new ConflictException('Concurrent remediation plan differs from this retry.');
      }
      plan = concurrent;
    }
    return this.projectRemediationPlan(plan);
  }

  async bindRemediationLesson(
    userId: string,
    input: BindLanguageMasteryRemediationLessonInput,
  ): Promise<LanguageMasteryRemediationPlanProjection> {
    const remediationPlanId = this.required(
      input.remediationPlanId,
      'remediation plan id',
      MAX_KEY,
    );
    const lessonId = this.required(input.lessonId, 'lesson id', MAX_KEY);
    const plan = await this.prisma.$transaction(async (tx) => {
      await this.lockOwner(tx, userId);
      const current = await tx.languageMasteryRemediationPlan.findFirst({
        where: { id: remediationPlanId, userId },
        include: {
          failedAttempt: { select: { attemptId: true, evaluatedAt: true } },
          evidence: { orderBy: { recordedAt: 'asc' } },
        },
      });
      if (!current) throw new NotFoundException('Language remediation plan not found.');
      if (current.remediationLessonId) {
        if (current.remediationLessonId !== lessonId) {
          throw new ConflictException('Remediation plan is already bound to another lesson.');
        }
        return current;
      }
      if (
        current.status !== LanguageMasteryRemediationPlanStatus.preparing
        || !current.failedAttempt.evaluatedAt
      ) {
        throw new ConflictException('Only a preparing remediation plan can bind a lesson.');
      }
      const lesson = await tx.lesson.findFirst({
        where: { id: lessonId, userId, languageProfileId: current.languageProfileId },
        select: {
          id: true,
          contentVersion: true,
          exercises: true,
          createdAt: true,
          masteryRemediationGenerationKey: true,
        },
      });
      if (
        !lesson
        || lesson.createdAt <= current.failedAttempt.evaluatedAt
        || lesson.masteryRemediationGenerationKey !== current.generationKey
      ) {
        throw new NotFoundException('New owner-scoped remediation lesson not found.');
      }
      const declaredFormats = Array.isArray(lesson.exercises)
        ? lesson.exercises.map((item) =>
            item && typeof item === 'object' && !Array.isArray(item)
              ? item.languageFormat
              : null)
        : [];
      if (
        declaredFormats.length < LANGUAGE_REMEDIATION_MINIMUM_EXERCISES
        || !LANGUAGE_TRAINING_FORMATS.every((format) => declaredFormats.includes(format))
      ) {
        throw new UnprocessableEntityException(
          'Targeted remediation requires ten new exercises covering every training format.',
        );
      }
      const linked = await tx.languageMasteryRemediationPlan.updateMany({
        where: {
          id: current.id,
          userId,
          status: LanguageMasteryRemediationPlanStatus.preparing,
          remediationLessonId: null,
        },
        data: {
          remediationLessonId: lesson.id,
          status: LanguageMasteryRemediationPlanStatus.active,
          lessonBoundAt: new Date(),
        },
      });
      if (linked.count !== 1) {
        throw new ConflictException('Concurrent remediation lesson binding differs.');
      }
      return tx.languageMasteryRemediationPlan.findUniqueOrThrow({
        where: { id: current.id },
        include: {
          failedAttempt: { select: { attemptId: true, evaluatedAt: true } },
          evidence: { orderBy: { recordedAt: 'asc' } },
        },
      });
    });
    return this.projectRemediationPlan(plan);
  }

  async getRemediationPlan(
    userId: string,
    remediationPlanId: string,
  ): Promise<LanguageMasteryRemediationPlanProjection> {
    const plan = await this.prisma.languageMasteryRemediationPlan.findFirst({
      where: {
        id: this.required(remediationPlanId, 'remediation plan id', MAX_KEY),
        userId,
      },
      include: {
        failedAttempt: { select: { attemptId: true, evaluatedAt: true } },
        evidence: { orderBy: { recordedAt: 'asc' } },
      },
    });
    if (!plan) throw new NotFoundException('Language remediation plan not found.');
    return this.projectRemediationPlan(plan);
  }

  async appendRemediationEvidence(
    userId: string,
    input: AppendLanguageMasteryRemediationInput,
  ): Promise<LanguageMasteryAttemptProjection> {
    const attemptId = this.required(input.attemptId, 'attempt id', MAX_KEY);
    const evidence = this.normalizedRemediation(input);
    let row: AttemptWithEvidence;
    try {
      row = await this.prisma.$transaction(async (tx) => {
      await this.lockOwner(tx, userId);
      const plan = await tx.languageMasteryRemediationPlan.findFirst({
        where: { id: evidence.remediationPlanId, userId },
        include: { failedAttempt: true },
      });
      const attempt = plan?.failedAttempt ?? null;
      if (
        !plan
        || !attempt
        || attempt.attemptId !== attemptId
        || attempt.scopeKind !== LanguageMasteryScopeKind.pillar_exam
        || attempt.status !== LanguageMasteryAttemptStatus.evaluated
        || attempt.verdict !== LanguageMasteryAttemptVerdict.not_mastered
        || plan.remediationLessonId !== evidence.lessonId
        || (
          plan.status !== LanguageMasteryRemediationPlanStatus.active
          && plan.status !== LanguageMasteryRemediationPlanStatus.ready_for_retest
        )
      ) {
        throw new UnprocessableEntityException(
          'Targeted remediation evidence must belong to its durable failed-exam plan and lesson.',
        );
      }
      const lesson = await tx.lesson.findFirst({
        where: { id: evidence.lessonId, userId },
        select: {
          id: true,
          languageProfileId: true,
          contentVersion: true,
          exercises: true,
        },
      });
      if (
        !lesson
        || lesson.languageProfileId !== attempt.languageProfileId
        || lesson.contentVersion !== evidence.sourceContentVersion
      ) {
        throw new NotFoundException('Versioned remediation lesson not found.');
      }
      const declaredExercise = Array.isArray(lesson.exercises)
        ? lesson.exercises[evidence.exerciseIndex]
        : null;
      if (
        !declaredExercise
        || typeof declaredExercise !== 'object'
        || Array.isArray(declaredExercise)
        || declaredExercise.languageFormat !== evidence.trainingFormat
      ) {
        throw new BadRequestException('Remediation format does not match the versioned lesson exercise.');
      }
      const source = await tx.exerciseAttempt.findFirst({
        where: {
          id: evidence.sourceRefId,
          userId,
          lessonId: evidence.lessonId,
          exerciseIndex: evidence.exerciseIndex,
        },
        select: { id: true, contentVersion: true, createdAt: true },
      });
      if (!source || source.contentVersion !== evidence.sourceContentVersion) {
        throw new NotFoundException('Owned versioned remediation exercise attempt not found.');
      }
      if (!attempt.evaluatedAt || source.createdAt <= attempt.evaluatedAt) {
        throw new UnprocessableEntityException(
          'Targeted remediation must use a genuinely new exercise completed after the failed exam.',
        );
      }
      const evidenceHash = this.hash({
        languageMasteryAttemptId: attempt.id,
        scopeKey: attempt.scopeKey,
        mappingVersion: attempt.mappingVersion,
        policyVersion: attempt.policyVersion,
        ...evidence,
      });
      const existing = await tx.languageMasteryRemediationEvidence.findFirst({
        where: { userId, evidenceId: evidence.evidenceId },
      });
      if (existing) {
        if (existing.evidenceHash !== evidenceHash) {
          throw new ConflictException('Remediation evidence is append-only and already differs.');
        }
        return this.withRelations(tx, attempt.id);
      }
      const creditedExercise = await tx.languageMasteryRemediationEvidence.findFirst({
        where: {
          userId,
          remediationPlanId: plan.id,
          lessonId: evidence.lessonId,
          sourceContentVersion: evidence.sourceContentVersion,
          exerciseIndex: evidence.exerciseIndex,
        },
      });
      if (creditedExercise) {
        throw new ConflictException('That remediation exercise was already recorded for this failed exam.');
      }
      await tx.languageMasteryRemediationEvidence.create({
        data: {
          userId,
          languageMasteryAttemptId: attempt.id,
          scopeKey: attempt.scopeKey,
          mappingVersion: attempt.mappingVersion,
          policyVersion: attempt.policyVersion,
          ...evidence,
          state: this.prismaRemediationState(evidence.state),
          recordedAt: source.createdAt,
          evidenceHash,
        },
      });
      const completedExerciseCount = await tx.languageMasteryRemediationEvidence.count({
        where: {
          userId,
          remediationPlanId: plan.id,
          state: LanguageMasteryRemediationState.completed,
        },
      });
      if (completedExerciseCount >= LANGUAGE_REMEDIATION_MINIMUM_EXERCISES) {
        await tx.languageMasteryRemediationPlan.updateMany({
          where: {
            id: plan.id,
            userId,
            status: LanguageMasteryRemediationPlanStatus.active,
          },
          data: {
            status: LanguageMasteryRemediationPlanStatus.ready_for_retest,
            readyAt: new Date(),
          },
        });
      }
      return this.withRelations(tx, attempt.id);
      });
    } catch (error) {
      if (!this.uniqueConflict(error)) throw error;
      const attempt = await this.prisma.languageMasteryAttempt.findFirst({ where: { userId, attemptId } });
      const plan = await this.prisma.languageMasteryRemediationPlan.findFirst({
        where: { id: evidence.remediationPlanId, userId },
      });
      const existing = await this.prisma.languageMasteryRemediationEvidence.findFirst({
        where: { userId, evidenceId: evidence.evidenceId },
      });
      const evidenceHash = attempt && plan
        ? this.hash({
            languageMasteryAttemptId: attempt.id,
            scopeKey: attempt.scopeKey,
            mappingVersion: attempt.mappingVersion,
            policyVersion: attempt.policyVersion,
            ...evidence,
          })
        : null;
      if (
        !attempt
        || !plan
        || !existing
        || existing.languageMasteryAttemptId !== attempt.id
        || existing.remediationPlanId !== plan.id
        || existing.evidenceHash !== evidenceHash
      ) {
        throw new ConflictException('A remediation source can be credited only once.');
      }
      row = await this.withRelations(this.prisma, attempt.id);
    }
    return this.project(row);
  }

  async projection(
    userId: string,
    languageProfileId: string,
  ): Promise<LanguageMasteryAttemptProjection[]> {
    await this.requireOwnedProfile(this.prisma, userId, languageProfileId);
    const rows = await this.prisma.languageMasteryAttempt.findMany({
      where: { userId, languageProfileId },
      orderBy: [{ startedAt: 'asc' }, { id: 'asc' }],
      include: {
        completion: { select: { id: true, status: true } },
        remediationEvidence: { orderBy: { recordedAt: 'asc' } },
        failedRemediationPlan: {
          select: {
            id: true,
            status: true,
            remediationLessonId: true,
            requiredExerciseCount: true,
          },
        },
      },
    });
    const identities = rows
      .filter((row) => !row.completion && this.isPublishableMasteryRow(row))
      .map((row) => this.canonicalCompletionIdentity(row))
      .filter((identity): identity is NonNullable<typeof identity> => Boolean(identity));
    const refs = [...new Set(identities.map((identity) => identity.learningRefId))];
    const canonicalRows = refs.length > 0
      ? await this.prisma.learningCompletion.findMany({
          where: {
            userId,
            languageProfileId,
            status: LearningCompletionStatus.verified,
            kind: {
              in: [
                LearningCompletionKind.language_milestone,
                LearningCompletionKind.language_pillar_exam,
              ],
            },
            learningRefId: { in: refs },
          },
          select: { id: true, kind: true, learningRefId: true },
        })
      : [];
    const completionByIdentity = new Map(
      canonicalRows.map((completion) => [
        `${completion.kind}:${completion.learningRefId}`,
        completion.id,
      ]),
    );
    return rows.map((row) => {
      const identity = this.canonicalCompletionIdentity(row);
      const completionId = identity
        ? completionByIdentity.get(`${identity.kind}:${identity.learningRefId}`) ?? null
        : null;
      return this.project(row, completionId);
    });
  }

  /** Recover the narrow crash window where the graded ExerciseAttempt was
   * committed but the client did not reach the remediation-evidence route.
   * Every candidate is revalidated by appendRemediationEvidence, so this
   * helper cannot manufacture progress from lesson JSON or client state. */
  async reconcileRemediationExerciseAttempts(
    userId: string,
    attemptId: string,
  ): Promise<LanguageMasteryAttemptProjection> {
    let attempt = await this.get(userId, attemptId);
    const remediation = attempt.remediation;
    if (
      !attempt.evaluatedAt
      || !remediation?.planId
      || !remediation.lessonId
      || remediation.status === 'completed'
    ) return attempt;
    const lesson = await this.prisma.lesson.findFirst({
      where: {
        id: remediation.lessonId,
        userId,
      },
      select: {
        id: true,
        contentVersion: true,
        exercises: true,
      },
    });
    if (!lesson || !Array.isArray(lesson.exercises)) return attempt;
    const evaluatedAt = new Date(attempt.evaluatedAt);
    const sources = await this.prisma.exerciseAttempt.findMany({
      where: {
        userId,
        lessonId: lesson.id,
        contentVersion: lesson.contentVersion,
        createdAt: { gt: evaluatedAt },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        exerciseIndex: true,
      },
    });
    const seenIndexes = new Set<number>();
    for (const source of sources) {
      if (seenIndexes.has(source.exerciseIndex)) continue;
      seenIndexes.add(source.exerciseIndex);
      const exercise = lesson.exercises[source.exerciseIndex];
      const format = exercise && typeof exercise === 'object' && !Array.isArray(exercise)
        ? exercise.languageFormat
        : null;
      if (!(LANGUAGE_TRAINING_FORMATS as readonly unknown[]).includes(format)) continue;
      try {
        attempt = await this.appendRemediationEvidence(userId, {
          attemptId,
          remediationPlanId: remediation.planId,
          evidenceId: `exercise-attempt:${source.id}`,
          trainingFormat: format as LanguageTrainingFormat,
          state: 'completed',
          lessonId: lesson.id,
          sourceContentVersion: lesson.contentVersion,
          exerciseIndex: source.exerciseIndex,
          sourceKind: 'exercise-attempt',
          sourceRefId: source.id,
        });
      } catch (error) {
        // A concurrent recovery may have credited the same canonical exercise
        // index first. Re-read the winner; all other validation failures remain
        // visible and fail closed.
        if (!(error instanceof ConflictException)) throw error;
        attempt = await this.get(userId, attemptId);
      }
    }
    return attempt;
  }

  /** Internal reset hook. Profile/user ownership is required; published proof
   * is removed before its journal rows so no detached progress survives. */
  async purgeOwned(
    userId: string,
    languageProfileId?: string,
  ): Promise<{ attempts: number; completions: number }> {
    if (languageProfileId) {
      await this.requireOwnedProfile(this.prisma, userId, languageProfileId);
    }
    return this.prisma.$transaction(async (tx) => {
      await this.lockOwner(tx, userId);
      const where = { userId, ...(languageProfileId ? { languageProfileId } : {}) };
      const attemptIds = (await tx.languageMasteryAttempt.findMany({
        where,
        select: { id: true },
      })).map(({ id }) => id);
      if (attemptIds.length === 0) return { attempts: 0, completions: 0 };
      const reviewableIds = (await tx.learningCompletionReviewable.findMany({
        where: {
          completion: {
            userId,
            languageMasteryAttemptId: { in: attemptIds },
          },
        },
        select: { reviewableId: true },
      })).map(({ reviewableId }) => reviewableId);
      const completions = await tx.learningCompletion.deleteMany({
        where: { userId, languageMasteryAttemptId: { in: attemptIds } },
      });
      const attempts = await tx.languageMasteryAttempt.deleteMany({ where });
      if (reviewableIds.length > 0) {
        // A published mastery target creates a Reviewable but no due schedule.
        // Remove only untouched rows whose final completion link disappeared;
        // a reviewed/shared row is user learning history and must survive.
        await tx.reviewable.deleteMany({
          where: {
            id: { in: [...new Set(reviewableIds)] },
            userId,
            kind: 'language',
            completionLinks: { none: {} },
            reps: 0,
            lastReview: null,
          },
        });
      }
      return { attempts: attempts.count, completions: completions.count };
    });
  }

  private normalizedStart(input: StartLanguageMasteryAttemptInput) {
    const idempotencyKey = this.required(input.idempotencyKey, 'idempotency key', MAX_KEY);
    const scopeKey = this.required(input.scopeKey, 'scope key', MAX_SCOPE);
    const targetId = this.required(input.targetId, 'target id', MAX_TARGET);
    if (!['unit_autonomy', 'milestone', 'pillar_exam'].includes(input.scopeKind)) {
      throw new BadRequestException('Unsupported language mastery scope kind.');
    }
    if (input.mappingVersion !== RLLE_LANGUAGE_MASTERY_MAPPING_VERSION) {
      throw new BadRequestException('Unsupported language mastery mapping version.');
    }
    if (input.policyVersion !== LANGUAGE_MASTERY_POLICY_VERSION) {
      throw new BadRequestException('Unsupported language mastery policy version.');
    }
    if (!(CEFR_LEVELS as readonly string[]).includes(input.cefrLevel)) {
      throw new BadRequestException('Unsupported CEFR level.');
    }
    if (
      input.scopeKind === 'unit_autonomy'
        ? input.pillar !== null
        : !(LANGUAGE_MASTERY_PILLARS as readonly (string | null)[]).includes(input.pillar)
    ) {
      throw new BadRequestException('Unsupported language mastery pillar.');
    }
    if (!Number.isInteger(input.sourceContentVersion) || input.sourceContentVersion < 1) {
      throw new BadRequestException('A positive source content version is required.');
    }
    const contentDefinitionId = input.contentDefinitionId?.trim() || null;
    const masteryContentVersion = input.masteryContentVersion?.trim() || null;
    if (Boolean(contentDefinitionId) !== Boolean(masteryContentVersion)) {
      throw new BadRequestException('Content definition and version must be provided together.');
    }
    const languageCode = toSupportedLanguage(
      this.required(input.languageCode, 'language code', 16),
    );
    if (!languageCode) throw new BadRequestException('Unsupported language mastery language code.');
    const normalized = {
      languageProfileId: this.required(input.languageProfileId, 'language profile id', MAX_KEY),
      experienceSessionId: input.experienceSessionId?.trim() || null,
      lessonId: input.lessonId?.trim() || null,
      idempotencyKey,
      scopeKind: input.scopeKind,
      scopeKey,
      targetId,
      mappingVersion: input.mappingVersion,
      policyVersion: input.policyVersion,
      masteryContentVersion,
      contentDefinitionId,
      sourceContentVersion: input.sourceContentVersion,
      languageCode,
      cefrLevel: input.cefrLevel,
      pillar: input.pillar,
      remediationPlanId: input.remediationPlanId?.trim() || null,
    };
    this.assertCanonicalScope(normalized);
    return normalized;
  }

  private assertCanonicalScope(input: {
    scopeKind: 'unit_autonomy' | 'milestone' | 'pillar_exam';
    scopeKey: string;
    targetId: string;
    mappingVersion: string;
    masteryContentVersion: string | null;
    contentDefinitionId: string | null;
    languageCode: string;
    cefrLevel: CefrLevel;
    pillar: LanguageMasteryPillar | null;
  }): void {
    if (input.scopeKind === 'unit_autonomy') return;
    const canonicalLanguage = toSupportedLanguage(input.languageCode);
    if (!canonicalLanguage) {
      throw new BadRequestException('Language mastery scope uses an unsupported language code.');
    }
    if (input.scopeKind === 'milestone') {
      const milestone = RLLE_LANGUAGE_MASTERY_UNIT_MAP
        .flatMap((unit) => unit.milestones)
        .find((candidate) => candidate.id === input.targetId);
      if (
        !milestone
        || milestone.level !== input.cefrLevel
        || milestone.pillar !== input.pillar
        || milestone.contentVersion !== input.masteryContentVersion
        || milestone.contentDefinitionId !== input.contentDefinitionId
        || rlleMilestoneEvidenceScopeKey({ languageCode: canonicalLanguage, milestone }) !== input.scopeKey
      ) {
        throw new BadRequestException('Language milestone scope does not match the canonical mapping.');
      }
      return;
    }
    const plan = getRlleLevelPillarPlans(input.cefrLevel)
      .find((candidate) => candidate.examId === input.targetId && candidate.pillar === input.pillar);
    const expectedScope = [
      RLLE_LANGUAGE_MASTERY_MAPPING_VERSION,
      input.languageCode,
      input.cefrLevel,
      input.pillar,
      input.targetId,
      'pillar-exam',
    ].join(':');
    if (
      !plan
      || !plan.contentReady
      || input.masteryContentVersion !== null
      || input.contentDefinitionId !== null
      || input.scopeKey !== expectedScope
    ) {
      throw new BadRequestException('Language pillar-exam scope does not match the canonical plan.');
    }
  }

  private async requireOwnedSources(
    tx: Prisma.TransactionClient,
    userId: string,
    input: ReturnType<LanguageMasteryAttemptService['normalizedStart']>,
  ): Promise<void> {
    const profile = await tx.languageProfile.findFirst({
      where: { id: input.languageProfileId, userId },
      select: { id: true, normalizedLanguage: true },
    });
    if (!profile) throw new NotFoundException('Language profile not found.');
    if (toSupportedLanguage(profile.normalizedLanguage) !== input.languageCode) {
      throw new BadRequestException('Language mastery evidence language does not match its profile.');
    }
    if (input.experienceSessionId) {
      const session = await tx.experienceSession.findFirst({
        where: { id: input.experienceSessionId, userId, languageProfileId: input.languageProfileId },
        select: { id: true },
      });
      if (!session) throw new NotFoundException('Owned language course session not found.');
    }
    if (input.lessonId) {
      const lesson = await tx.lesson.findFirst({
        where: { id: input.lessonId, userId, languageProfileId: input.languageProfileId },
        select: { id: true, contentVersion: true },
      });
      if (!lesson || lesson.contentVersion !== input.sourceContentVersion) {
        throw new NotFoundException('Owned versioned language lesson not found.');
      }
    }
    if (input.remediationPlanId) {
      if (input.scopeKind !== 'pillar_exam') {
        throw new BadRequestException('Only a pillar exam can be linked to a remediation retest.');
      }
      const plan = await tx.languageMasteryRemediationPlan.findFirst({
        where: { id: input.remediationPlanId, userId },
        include: { failedAttempt: true },
      });
      if (
        !plan
        || plan.languageProfileId !== input.languageProfileId
        || plan.scopeKey !== input.scopeKey
        || plan.targetId !== input.targetId
        || plan.mappingVersion !== input.mappingVersion
        || plan.policyVersion !== input.policyVersion
        || plan.masteryContentVersion !== input.masteryContentVersion
        || plan.failedAttempt.pillar !== input.pillar
      ) {
        throw new NotFoundException('Owned compatible language remediation plan not found.');
      }
    }
  }

  private async requireOwnedProfile(
    tx: Pick<Prisma.TransactionClient, 'languageProfile'>,
    userId: string,
    languageProfileId: string,
  ): Promise<void> {
    const profile = await tx.languageProfile.findFirst({
      where: { id: languageProfileId, userId },
      select: { id: true },
    });
    if (!profile) throw new NotFoundException('Language profile not found.');
  }

  private validDecision(
    decision: LanguageMasteryDecision,
    submissionResults: Prisma.JsonValue,
    criteria: readonly LanguageMasteryAttemptCriterion[],
  ): LanguageMasteryDecision {
    if (
      decision.policyVersion !== LANGUAGE_MASTERY_POLICY_VERSION
      || decision.threshold !== LANGUAGE_MASTERY_THRESHOLD
    ) {
      throw new BadRequestException('Language mastery decision is invalid.');
    }
    if (!['mastered', 'not-mastered', 'not-evaluable'].includes(decision.verdict)) {
      throw new BadRequestException('Unsupported language mastery verdict.');
    }
    if (
      decision.rawScore !== null
      && (!Number.isFinite(decision.rawScore) || decision.rawScore < 0 || decision.rawScore > 1)
    ) {
      throw new BadRequestException('Language mastery raw score must be a finite normalised ratio.');
    }
    if (decision.verdict === 'not-evaluable') {
      if (
        decision.rawScore !== null
        || criteria.some((criterion) => criterion.met || criterion.score !== null)
        || ![
          'training-incomplete',
          'autonomy-missing',
          'autonomy-incomplete',
          'autonomy-item-not-evaluable',
          'invalid-rubric',
        ].includes(decision.reason)
      ) {
        throw new BadRequestException('NOT_EVALUABLE evidence requires scoreless unmet criteria.');
      }
      return decision;
    }
    const exactSubmissionRatio = this.rubricRatio(submissionResults);
    if (decision.rawScore !== null && Math.abs(decision.rawScore - exactSubmissionRatio) > 1e-12) {
      throw new BadRequestException('Language mastery score does not match the persisted submission.');
    }
    if (decision.verdict === 'mastered') {
      if (
        decision.rawScore === null
        || decision.rawScore < LANGUAGE_MASTERY_THRESHOLD
        || decision.helpUsed
        || !decision.trainingComplete
        || decision.missingTrainingFormats.length > 0
        || criteria.length === 0
        || criteria.some((criterion) => !criterion.met)
        || decision.reason !== 'threshold-met'
      ) {
        throw new UnprocessableEntityException('Mastery requires every prerequisite, criterion and the unrounded 90% threshold.');
      }
    } else if (decision.rawScore !== null) {
      if (
        decision.reason !== 'below-threshold'
        || (
          decision.rawScore >= LANGUAGE_MASTERY_THRESHOLD
          && !criteria.some((criterion) => !criterion.met)
        )
      ) {
        throw new BadRequestException(
          'A non-mastered scored attempt must be below threshold or have an unmet canonical criterion.',
        );
      }
    } else if (
      !['autonomy-assisted', 'autonomy-answer-leak'].includes(decision.reason)
      || (decision.reason === 'autonomy-assisted') !== decision.helpUsed
    ) {
      throw new BadRequestException('A scoreless failed attempt requires assisted or answer-leak provenance.');
    }
    return decision;
  }

  private normalizedCriteria(
    criteria: readonly LanguageMasteryAttemptCriterion[],
    allowEmpty = false,
  ): LanguageMasteryAttemptCriterion[] {
    if (!Array.isArray(criteria) || (!allowEmpty && criteria.length === 0) || criteria.length > 100) {
      throw new BadRequestException('Evaluated language mastery criteria are required.');
    }
    const ids = new Set<string>();
    return criteria.map((item) => {
      const id = this.required(item.id, 'criterion id', MAX_TARGET);
      if (ids.has(id)) throw new BadRequestException('Language mastery criterion ids must be unique.');
      ids.add(id);
      if (item.score !== null && (!Number.isFinite(item.score) || item.score < 0 || item.score > 1)) {
        throw new BadRequestException('Criterion score must be normalised or null.');
      }
      return { id, met: item.met === true, score: item.score };
    });
  }

  private normalizedRemediation(input: AppendLanguageMasteryRemediationInput) {
    if (!(LANGUAGE_TRAINING_FORMATS as readonly string[]).includes(input.trainingFormat)) {
      throw new BadRequestException('Unknown remediation training format.');
    }
    if (!['completed', 'incomplete', 'technical-error', 'not-evaluable'].includes(input.state)) {
      throw new BadRequestException('Unknown remediation evidence state.');
    }
    if (!Number.isInteger(input.sourceContentVersion) || input.sourceContentVersion < 1) {
      throw new BadRequestException('A positive remediation content version is required.');
    }
    if (!Number.isInteger(input.exerciseIndex) || input.exerciseIndex < 0) {
      throw new BadRequestException('A valid remediation exercise index is required.');
    }
    if (input.sourceKind !== 'exercise-attempt') {
      throw new BadRequestException('Remediation evidence requires a durable owned exercise attempt.');
    }
    return {
      remediationPlanId: this.required(
        input.remediationPlanId,
        'remediation plan id',
        MAX_KEY,
      ),
      evidenceId: this.required(input.evidenceId, 'evidence id', MAX_KEY),
      trainingFormat: input.trainingFormat,
      state: input.state,
      lessonId: this.required(input.lessonId, 'lesson id', MAX_KEY),
      sourceContentVersion: input.sourceContentVersion,
      exerciseIndex: input.exerciseIndex,
      sourceKind: input.sourceKind,
      sourceRefId: this.required(input.sourceRefId, 'source ref id', MAX_KEY),
    };
  }

  private async withRelations(tx: LanguageMasteryAttemptStore, id: string): Promise<AttemptWithEvidence> {
    return tx.languageMasteryAttempt.findUniqueOrThrow({
      where: { id },
      include: {
        completion: { select: { id: true, status: true } },
        remediationEvidence: { orderBy: { recordedAt: 'asc' } },
        failedRemediationPlan: {
          select: {
            id: true,
            status: true,
            remediationLessonId: true,
            requiredExerciseCount: true,
          },
        },
      },
    });
  }

  private canonicalCompletionIdentity(row: AttemptWithEvidence): {
    kind: LearningCompletionKind;
    learningRefId: string;
  } | null {
    if (row.scopeKind === LanguageMasteryScopeKind.unit_autonomy) return null;
    const scopeKind = row.scopeKind === LanguageMasteryScopeKind.milestone
      ? 'milestone' as const
      : 'pillar_exam' as const;
    return {
      kind: scopeKind === 'milestone'
        ? LearningCompletionKind.language_milestone
        : LearningCompletionKind.language_pillar_exam,
      learningRefId: languageMasteryLearningRef({
        languageProfileId: row.languageProfileId,
        scopeKind,
        scopeKey: row.scopeKey,
        policyVersion: row.policyVersion,
        masteryContentVersion: row.masteryContentVersion,
        contentDefinitionId: row.contentDefinitionId,
      }),
    };
  }

  private isPublishableMasteryRow(row: AttemptWithEvidence): boolean {
    return row.status === LanguageMasteryAttemptStatus.evaluated
      && row.verdict === LanguageMasteryAttemptVerdict.mastered
      && row.scopeKind !== LanguageMasteryScopeKind.unit_autonomy;
  }

  private project(
    row: AttemptWithEvidence,
    canonicalCompletionId: string | null = null,
  ): LanguageMasteryAttemptProjection {
    const planEvidence = row.failedRemediationPlan
      ? row.remediationEvidence.filter((item) => item.remediationPlanId === row.failedRemediationPlan?.id)
      : [];
    const completedExerciseCount = new Set(
      planEvidence
        .filter((item) => item.state === LanguageMasteryRemediationState.completed)
        .map((item) => `${item.sourceKind}:${item.sourceRefId}`),
    ).size;
    return {
      id: row.id,
      attemptId: row.attemptId,
      scopeKind: row.scopeKind === LanguageMasteryScopeKind.unit_autonomy
        ? 'unit_autonomy'
        : row.scopeKind === LanguageMasteryScopeKind.milestone
          ? 'milestone'
          : 'pillar_exam',
      scopeKey: row.scopeKey,
      targetId: row.targetId,
      idempotencyKey: row.idempotencyKey,
      mappingVersion: row.mappingVersion,
      policyVersion: row.policyVersion,
      masteryContentVersion: row.masteryContentVersion,
      contentDefinitionId: row.contentDefinitionId,
      sourceContentVersion: row.sourceContentVersion,
      lessonId: row.lessonId,
      languageCode: row.languageCode,
      cefrLevel: row.cefrLevel,
      pillar: row.pillar,
      status: row.status,
      verdict: row.verdict === LanguageMasteryAttemptVerdict.not_mastered
        ? 'not-mastered'
        : row.verdict === LanguageMasteryAttemptVerdict.not_evaluable
          ? 'not-evaluable'
          : row.verdict,
      rawScore: row.rawScore,
      threshold: row.threshold,
      decisionReason: row.decisionReason,
      helpUsed: row.helpUsed,
      decision: row.decision as unknown as LanguageMasteryDecision | null,
      criteria: Array.isArray(row.criteria)
        ? row.criteria as unknown as LanguageMasteryAttemptCriterion[]
        : [],
      assessmentId: row.assessmentId,
      assessmentSubmissionId: row.assessmentSubmissionId,
      completionId: row.completion?.status === 'verified'
        ? row.completion.id
        : canonicalCompletionId,
      remediation: row.scopeKind === LanguageMasteryScopeKind.pillar_exam
        && row.verdict === LanguageMasteryAttemptVerdict.not_mastered
        ? {
            planId: row.failedRemediationPlan?.id ?? null,
            status: row.failedRemediationPlan?.status ?? null,
            lessonId: row.failedRemediationPlan?.remediationLessonId ?? null,
            requiredExerciseCount: LANGUAGE_REMEDIATION_MINIMUM_EXERCISES,
            completedExerciseCount,
            evidenceCount: planEvidence.length,
            evidence: planEvidence.map((item) => ({
              id: item.id,
              evidenceId: item.evidenceId,
              trainingFormat: item.trainingFormat,
              state: item.state === LanguageMasteryRemediationState.completed
                ? 'completed'
                : 'not-evaluable',
              lessonId: item.lessonId,
              sourceContentVersion: item.sourceContentVersion,
              exerciseIndex: item.exerciseIndex,
              sourceKind: item.sourceKind,
              sourceRefId: item.sourceRefId,
              recordedAt: item.recordedAt.toISOString(),
            })),
          }
        : null,
      startedAt: row.startedAt.toISOString(),
      evaluatedAt: row.evaluatedAt?.toISOString() ?? null,
    };
  }

  private prismaVerdict(verdict: LanguageMasteryDecision['verdict']): LanguageMasteryAttemptVerdict {
    if (verdict === 'mastered') return LanguageMasteryAttemptVerdict.mastered;
    if (verdict === 'not-mastered') return LanguageMasteryAttemptVerdict.not_mastered;
    return LanguageMasteryAttemptVerdict.not_evaluable;
  }

  private projectRemediationPlan(
    row: RemediationPlanWithEvidence,
  ): LanguageMasteryRemediationPlanProjection {
    const completedExerciseCount = new Set(
      row.evidence
        .filter((item) => item.state === LanguageMasteryRemediationState.completed)
        .map((item) => `${item.lessonId}:${item.sourceContentVersion}:${item.exerciseIndex}`),
    ).size;
    return {
      id: row.id,
      failedAttemptId: row.failedAttempt.attemptId,
      languageProfileId: row.languageProfileId,
      scopeKey: row.scopeKey,
      targetId: row.targetId,
      generationKey: row.generationKey,
      remediationLessonId: row.remediationLessonId,
      requiredExerciseCount: LANGUAGE_REMEDIATION_MINIMUM_EXERCISES,
      completedExerciseCount,
      evidenceCount: row.evidence.length,
      status: row.status,
      startedAt: row.startedAt.toISOString(),
      readyAt: row.readyAt?.toISOString() ?? null,
    };
  }

  private prismaRemediationState(state: LanguageTrainingEvidenceState): LanguageMasteryRemediationState {
    if (state === 'completed') return LanguageMasteryRemediationState.completed;
    if (state === 'incomplete') return LanguageMasteryRemediationState.incomplete;
    if (state === 'technical-error') return LanguageMasteryRemediationState.technical_error;
    return LanguageMasteryRemediationState.not_evaluable;
  }

  private async advanceRetestPlan(
    tx: Prisma.TransactionClient,
    userId: string,
    remediationPlanId: string | null,
    retryableNeutral: boolean,
    evaluatedAt: Date,
  ): Promise<void> {
    if (!remediationPlanId) return;
    const desiredStatus = retryableNeutral
      ? LanguageMasteryRemediationPlanStatus.ready_for_retest
      : LanguageMasteryRemediationPlanStatus.completed;
    const updated = await tx.languageMasteryRemediationPlan.updateMany({
      where: {
        id: remediationPlanId,
        userId,
        status: LanguageMasteryRemediationPlanStatus.retest_started,
      },
      data: {
        status: desiredStatus,
        ...(retryableNeutral ? {} : { completedAt: evaluatedAt }),
      },
    });
    if (updated.count === 1) return;
    const current = await tx.languageMasteryRemediationPlan.findFirst({
      where: { id: remediationPlanId, userId },
      select: { status: true },
    });
    if (current?.status !== desiredStatus) {
      throw new ConflictException('The remediation retest state changed concurrently.');
    }
  }

  /** Revalidate the latest durable pillar failure at evaluation time.
   *
   * Two pillar attempts may have been started before either result existed.
   * Once one fails, the other pre-started attempt must not bypass the newly
   * required targeted remediation merely because its start check happened
   * earlier. The owner lock serialises this check with outcome persistence.
   */
  private async requireResolvedPillarRemediationForSubmission(
    tx: Prisma.TransactionClient,
    userId: string,
    attempt: {
      id: string;
      languageProfileId: string;
      scopeKind: LanguageMasteryScopeKind;
      scopeKey: string;
      mappingVersion: string;
      policyVersion: string;
      remediationPlanId: string | null;
    },
  ): Promise<void> {
    if (attempt.scopeKind !== LanguageMasteryScopeKind.pillar_exam) return;
    const latestFailure = await tx.languageMasteryAttempt.findFirst({
      where: {
        userId,
        languageProfileId: attempt.languageProfileId,
        scopeKind: LanguageMasteryScopeKind.pillar_exam,
        scopeKey: attempt.scopeKey,
        mappingVersion: attempt.mappingVersion,
        policyVersion: attempt.policyVersion,
        status: LanguageMasteryAttemptStatus.evaluated,
        verdict: LanguageMasteryAttemptVerdict.not_mastered,
      },
      orderBy: [{ evaluatedAt: 'desc' }, { id: 'desc' }],
      include: {
        failedRemediationPlan: { select: { id: true, status: true } },
      },
    });
    if (!latestFailure || latestFailure.id === attempt.id) return;
    if (
      !latestFailure.failedRemediationPlan
      || latestFailure.failedRemediationPlan.id !== attempt.remediationPlanId
      || latestFailure.failedRemediationPlan.status !== LanguageMasteryRemediationPlanStatus.retest_started
    ) {
      throw new ConflictException(
        'The latest failed pillar exam must complete its targeted remediation before submission.',
      );
    }
  }

  private async lockOwner(tx: Prisma.TransactionClient, userId: string): Promise<void> {
    const lockKey = accountDataLockKey(userId);
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;
  }

  private allCriteriaMet(value: Prisma.JsonValue | null): boolean {
    return Array.isArray(value)
      && value.length > 0
      && value.every((item) => Boolean(item && typeof item === 'object' && !Array.isArray(item) && item.met === true));
  }

  /** Recompute the unrounded score from canonical per-question rubric points.
   * AssessmentSubmission.score is display-rounded and must never gate mastery. */
  private rubricRatio(value: Prisma.JsonValue): number {
    if (!Array.isArray(value) || value.length === 0) {
      throw new BadRequestException('Persisted assessment rubric is incomplete.');
    }
    let awarded = 0;
    let maximum = 0;
    for (const item of value) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        throw new BadRequestException('Persisted assessment rubric is invalid.');
      }
      const candidate = item as Prisma.JsonObject;
      const itemAwarded = candidate.awarded;
      const itemMaximum = candidate.max;
      if (
        typeof itemAwarded !== 'number'
        || typeof itemMaximum !== 'number'
        || !Number.isFinite(itemAwarded)
        || !Number.isFinite(itemMaximum)
        || itemMaximum <= 0
        || itemAwarded < 0
        || itemAwarded > itemMaximum
      ) {
        throw new BadRequestException('Persisted assessment rubric is invalid.');
      }
      awarded += itemAwarded;
      maximum += itemMaximum;
    }
    if (!Number.isFinite(maximum) || maximum <= 0) {
      throw new BadRequestException('Persisted assessment rubric is invalid.');
    }
    return awarded / maximum;
  }

  private required(value: string, label: string, max: number): string {
    const normalized = value?.trim();
    if (!normalized || normalized.length > max) {
      throw new BadRequestException(`A valid ${label} is required.`);
    }
    return normalized;
  }

  private date(value: string, label: string): Date {
    const parsed = new Date(value);
    if (!Number.isFinite(parsed.getTime())) throw new BadRequestException(`Invalid ${label}.`);
    return parsed;
  }

  private hash(value: unknown): string {
    return createHash('sha256').update(JSON.stringify(this.canonical(value))).digest('hex');
  }

  private canonical(value: unknown): unknown {
    if (value instanceof Date) return value.toISOString();
    if (Array.isArray(value)) return value.map((item) => this.canonical(item));
    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>)
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([key, item]) => [key, this.canonical(item)]),
      );
    }
    return value;
  }

  private uniqueConflict(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }
}
