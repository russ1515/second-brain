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
  LanguageMasteryRemediationState,
  LanguageMasteryScopeKind,
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
  toSupportedLanguage,
  type CefrLevel,
  type LanguageMasteryDecision,
  type LanguageMasteryPillar,
  type LanguageTrainingEvidenceState,
  type LanguageTrainingFormat,
} from '@second-brain/shared';
import { PrismaService } from '../prisma/prisma.service';

const MAX_KEY = 240;
const MAX_SCOPE = 800;
const MAX_TARGET = 400;

type AttemptWithEvidence = Prisma.LanguageMasteryAttemptGetPayload<{
  include: {
    completion: { select: { id: true; status: true } };
    remediationEvidence: { orderBy: { recordedAt: 'asc' } };
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

export interface LanguageMasteryAttemptProjection {
  id: string;
  attemptId: string;
  scopeKind: 'unit_autonomy' | 'milestone' | 'pillar_exam';
  scopeKey: string;
  targetId: string;
  mappingVersion: string;
  policyVersion: string;
  masteryContentVersion: string | null;
  contentDefinitionId: string | null;
  sourceContentVersion: number;
  languageCode: string;
  cefrLevel: string;
  pillar: string | null;
  status: 'started' | 'assessment_bound' | 'evaluated';
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
    requiredExerciseCount: typeof LANGUAGE_REMEDIATION_MINIMUM_EXERCISES;
    completedExerciseCount: number;
    evidenceCount: number;
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
  constructor(private readonly prisma: PrismaService) {}

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
        select: { id: true, lessonId: true, contentVersion: true },
      });
      if (
        !assessment
        || assessment.lessonId !== attempt.lessonId
        || assessment.contentVersion !== attempt.sourceContentVersion
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
    return this.project(await this.withRelations(this.prisma, owned.id));
  }

  async appendOutcome(
    userId: string,
    input: AppendLanguageMasteryOutcomeInput,
  ): Promise<LanguageMasteryAttemptProjection> {
    const row = await this.prisma.$transaction(async (tx) => {
      const attempt = await tx.languageMasteryAttempt.findFirst({
        where: { userId, attemptId: this.required(input.attemptId, 'attempt id', MAX_KEY) },
      });
      if (!attempt) throw new NotFoundException('Language mastery attempt not found.');
      const submission = await tx.assessmentSubmission.findFirst({
        where: { id: this.required(input.assessmentSubmissionId, 'submission id', MAX_KEY), userId },
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
      return this.withRelations(tx, attempt.id);
    });
    return this.project(row);
  }

  async linkPublishedCompletion(
    userId: string,
    attemptId: string,
    completionId: string,
  ): Promise<LanguageMasteryAttemptProjection> {
    const attempt = await this.prisma.languageMasteryAttempt.findFirst({ where: { userId, attemptId } });
    if (!attempt) throw new NotFoundException('Language mastery attempt not found.');
    void completionId;
    throw new UnprocessableEntityException(
      'BLOCKED_CAPABILITY: the canonical completion contract cannot represent language milestone evidence.',
    );
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
      const attempt = await tx.languageMasteryAttempt.findFirst({
        where: { userId, attemptId },
      });
      if (
        !attempt
        || attempt.scopeKind !== LanguageMasteryScopeKind.pillar_exam
        || attempt.status !== LanguageMasteryAttemptStatus.evaluated
        || attempt.verdict !== LanguageMasteryAttemptVerdict.not_mastered
      ) {
        throw new UnprocessableEntityException('Targeted remediation requires an owned failed pillar exam.');
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
          languageMasteryAttemptId: attempt.id,
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
      return this.withRelations(tx, attempt.id);
      });
    } catch (error) {
      if (!this.uniqueConflict(error)) throw error;
      const attempt = await this.prisma.languageMasteryAttempt.findFirst({ where: { userId, attemptId } });
      const existing = await this.prisma.languageMasteryRemediationEvidence.findFirst({
        where: { userId, evidenceId: evidence.evidenceId },
      });
      const evidenceHash = attempt
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
        || !existing
        || existing.languageMasteryAttemptId !== attempt.id
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
      },
    });
    return rows.map((row) => this.project(row));
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
      const where = { userId, ...(languageProfileId ? { languageProfileId } : {}) };
      const attemptIds = (await tx.languageMasteryAttempt.findMany({
        where,
        select: { id: true },
      })).map(({ id }) => id);
      if (attemptIds.length === 0) return { attempts: 0, completions: 0 };
      const completions = await tx.learningCompletion.deleteMany({
        where: { userId, languageMasteryAttemptId: { in: attemptIds } },
      });
      const attempts = await tx.languageMasteryAttempt.deleteMany({ where });
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
    return {
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
      languageCode: this.required(input.languageCode, 'language code', 16).toLowerCase(),
      cefrLevel: input.cefrLevel,
      pillar: input.pillar,
    };
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
        decision.rawScore >= LANGUAGE_MASTERY_THRESHOLD
        || decision.reason !== 'below-threshold'
      ) {
        throw new BadRequestException('A non-mastered scored attempt must be below the raw threshold.');
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
      },
    });
  }

  private project(row: AttemptWithEvidence): LanguageMasteryAttemptProjection {
    const completedExerciseCount = new Set(
      row.remediationEvidence
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
      mappingVersion: row.mappingVersion,
      policyVersion: row.policyVersion,
      masteryContentVersion: row.masteryContentVersion,
      contentDefinitionId: row.contentDefinitionId,
      sourceContentVersion: row.sourceContentVersion,
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
      completionId: row.completion?.status === 'verified' ? row.completion.id : null,
      remediation: row.scopeKind === LanguageMasteryScopeKind.pillar_exam
        && row.verdict === LanguageMasteryAttemptVerdict.not_mastered
        ? {
            requiredExerciseCount: LANGUAGE_REMEDIATION_MINIMUM_EXERCISES,
            completedExerciseCount,
            evidenceCount: row.remediationEvidence.length,
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

  private prismaRemediationState(state: LanguageTrainingEvidenceState): LanguageMasteryRemediationState {
    if (state === 'completed') return LanguageMasteryRemediationState.completed;
    if (state === 'incomplete') return LanguageMasteryRemediationState.incomplete;
    if (state === 'technical-error') return LanguageMasteryRemediationState.technical_error;
    return LanguageMasteryRemediationState.not_evaluable;
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
