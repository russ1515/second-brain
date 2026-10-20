import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type LanguageProfile } from '@prisma/client';
import {
  LANGUAGE_PLACEMENT_POLICY_VERSION,
  LANGUAGE_PLACEMENT_SELF_ESTIMATES,
  highestDemonstratedPlacementLevel,
  placementProductLevel,
  projectLanguagePlacementRound,
  type AssessmentView,
  type CefrLevel,
  type ExperienceSession,
  type LanguagePlacementRound,
  type LanguagePlacementSelfEstimate,
  type LanguagePlacementSkillEvidence,
  type LanguagePlacementView,
  type SaveLanguagePlacementProgressRequest,
  type StartLanguagePlacementRequest,
  type SubmitLanguagePlacementRequest,
} from '@second-brain/shared';
import { accountDataLockKey } from '../common/account-data-lock';
import { PlacementRuntimeException } from '../common/language-placement-error';
import { resolveLanguageTeachingRoles } from '../common/language-teaching';
import { ExaminerService } from '../examiner/examiner.service';
import { ExperienceSessionService } from '../experience-sessions/experience-session.service';
import { PrismaService } from '../prisma/prisma.service';

export const LANGUAGE_PLACEMENT_INTENT = 'language-placement';
const SCHEMA_VERSION = 1;

/** Examiner submissions remain canonical. This existing session metadata holds
 * only the server cursor/decision plus a bounded, ungraded draft for resuming. */
interface StoredPlacement {
  schemaVersion: 1;
  policyVersion: typeof LANGUAGE_PLACEMENT_POLICY_VERSION;
  profileId: string;
  selfEstimate: LanguagePlacementSelfEstimate;
  round: LanguagePlacementRound;
  assessmentIds: Partial<Record<LanguagePlacementRound, string>>;
  submissionIds: string[];
  status: 'active' | 'complete' | 'not_evaluable';
  globalLevel: LanguagePlacementView['globalLevel'];
  productLevel: LanguagePlacementView['productLevel'];
  completedAt: string | null;
  progress?: NonNullable<LanguagePlacementView['progress']>;
  oralStatus?: 'NOT_EVALUATED';
  nextAction?: LanguagePlacementView['nextAction'];
}

export function placementSummaryFromStep(step: unknown): Pick<LanguagePlacementView,
  'policyVersion' | 'status' | 'globalLevel' | 'productLevel' | 'completedAt'> | null {
  const metadata = record(record(step)?.metadata);
  const state = record(metadata?.languagePlacement);
  if (state?.schemaVersion !== SCHEMA_VERSION || state.policyVersion !== LANGUAGE_PLACEMENT_POLICY_VERSION
    || !['active', 'complete', 'not_evaluable'].includes(String(state.status))) return null;
  const complete = state.status === 'complete';
  const level = state.globalLevel;
  if (complete && (!['PRE_A1', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'].includes(String(level))
    || !['BEGINNER', 'INTERMEDIATE', 'ADVANCED'].includes(String(state.productLevel))
    || typeof state.completedAt !== 'string' || !Number.isFinite(Date.parse(state.completedAt)))) return null;
  return {
    policyVersion: LANGUAGE_PLACEMENT_POLICY_VERSION,
    status: state.status as StoredPlacement['status'],
    globalLevel: complete ? level as NonNullable<LanguagePlacementView['globalLevel']> : null,
    productLevel: complete ? state.productLevel as NonNullable<LanguagePlacementView['productLevel']> : null,
    completedAt: complete ? state.completedAt as string : null,
  };
}

@Injectable()
export class LanguagePlacementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly experiences: ExperienceSessionService,
    private readonly examiner: ExaminerService,
  ) {}

  async get(userId: string, profileId: string): Promise<LanguagePlacementView> {
    const profile = await this.owned(userId, profileId);
    const roles = await resolveLanguageTeachingRoles(this.prisma, userId, profile);
    let session = await this.findSession(userId, profileId);
    if (!session) return this.view(profile, roles.supportLanguage, null, [], null);
    let state = this.state(session, profileId);
    const initial = state;
    // Cached completion is never proof. A removed/unavailable canonical
    // submission must revoke the projection rather than replay a stale unlock.
    state = { ...state, submissionIds: [], status: 'active', globalLevel: null, productLevel: null, completedAt: null };
    const skills: LanguagePlacementSkillEvidence[] = [];
    let bestConsensus: LanguagePlacementView['globalLevel'] = null;
    let assessment: AssessmentView | null = null;
    // At most three persisted rounds. Reading/recovering never invokes a provider.
    for (let round = 1; round <= state.round; round += 1) {
      const assessmentId = state.assessmentIds[round as LanguagePlacementRound];
      if (!assessmentId) break;
      assessment = await this.examiner.languagePlacementAssessment(userId, assessmentId, profileId, session.id);
      const evaluated = await this.examiner.languagePlacementSubmissionEvidence(userId, assessmentId, profileId, session.id);
      if (!evaluated) break;
      const projection = projectLanguagePlacementRound({ round: round as LanguagePlacementRound, skills: evaluated.skills });
      skills.push(...evaluated.skills);
      const submissionIds = [...new Set([...state.submissionIds, evaluated.submission.id])];
      if (projection.status === 'not_evaluable') {
        state = { ...state, submissionIds, status: 'not_evaluable', globalLevel: null, productLevel: null, completedAt: null };
        break;
      }
      bestConsensus = highestDemonstratedPlacementLevel(skills);
      if (projection.nextRound) {
        state = { ...state, submissionIds, round: projection.nextRound, status: 'active', globalLevel: null, productLevel: null, completedAt: null };
        assessment = null;
      } else {
        state = { ...state, submissionIds, round: round as LanguagePlacementRound, status: 'complete',
          globalLevel: bestConsensus, productLevel: bestConsensus ? placementProductLevel(bestConsensus) : null,
          completedAt: evaluated.submission.createdAt };
        assessment = null;
        break;
      }
    }
    // This version is written-only. Persist that explicit limitation and the
    // existing next action alongside the canonical-derived decision/cursor.
    state = { ...state, oralStatus: 'NOT_EVALUATED', nextAction: state.status === 'complete'
      ? 'PREPARE_LEARNING_PATH' : state.status === 'not_evaluable' ? 'REVIEW_DIAGNOSTIC_AVAILABILITY' : 'COMPLETE_WRITTEN_DIAGNOSTIC' };
    if (JSON.stringify(initial) !== JSON.stringify(state)) session = await this.save(userId, session, initial, state);
    return this.view(profile, roles.supportLanguage, state, skills, assessment,
      await this.progress(userId, state));
  }

  async start(userId: string, profileId: string, request: StartLanguagePlacementRequest): Promise<LanguagePlacementView> {
    this.requestKey(request.idempotencyKey);
    if (!(LANGUAGE_PLACEMENT_SELF_ESTIMATES as readonly string[]).includes(request.selfEstimate)) {
      throw new BadRequestException('Unsupported language placement self-estimation.');
    }
    const profile = await this.owned(userId, profileId);
    let session = await this.findSession(userId, profileId);
    if (!session) {
      const state: StoredPlacement = {
        schemaVersion: SCHEMA_VERSION, policyVersion: LANGUAGE_PLACEMENT_POLICY_VERSION, profileId,
        selfEstimate: request.selfEstimate, round: 1, assessmentIds: {}, submissionIds: [], status: 'active',
        globalLevel: null, productLevel: null, completedAt: null,
      };
      session = await this.experiences.create(userId, {
        type: 'language', intent: LANGUAGE_PLACEMENT_INTENT, title: profile.language,
        inputModality: 'text', currentStep: this.step(state), progress: { completed: 0, total: 1 },
        links: { languageProfileId: profileId }, idempotencyKey: `language-placement:v1:${profileId}`,
        resumeTarget: { kind: 'language', id: profileId, path: `/languages/${profileId}/course` },
      });
    }
    const current = await this.get(userId, profileId);
    if (current.status === 'complete' || current.status === 'not_evaluable' || current.assessment) return current;
    session = await this.findSession(userId, profileId);
    if (!session) throw new ConflictException('Language placement changed. Reload it before continuing.');
    const state = this.state(session, profileId);
    const roles = await resolveLanguageTeachingRoles(this.prisma, userId, profile);
    const assessment = await this.examiner.createLanguagePlacementOnce(userId, {
      profileId, placementSessionId: session.id, round: state.round,
      targetLanguage: roles.targetLanguage, supportLanguage: roles.supportLanguage,
      idempotencyKey: request.idempotencyKey,
    });
    await this.save(userId, session, state, { ...state, assessmentIds: { ...state.assessmentIds, [state.round]: assessment.id } });
    return this.get(userId, profileId);
  }

  async submit(userId: string, profileId: string, request: SubmitLanguagePlacementRequest): Promise<LanguagePlacementView> {
    this.requestKey(request.idempotencyKey);
    await this.owned(userId, profileId);
    const session = await this.findSession(userId, profileId);
    if (!session) throw new BadRequestException('Start the language placement first.');
    const state = this.state(session, profileId);
    const roundEntry = Object.entries(state.assessmentIds).find(([, id]) => id === request.assessmentId);
    if (!roundEntry) throw new NotFoundException('Owned active placement assessment not found.');
    const round = Number(roundEntry[0]) as LanguagePlacementRound;
    // Old-round exact replays are safe; the Examiner rejects changed answers.
    await this.examiner.submitLanguagePlacementOnce(userId, request.assessmentId, {
      profileId, placementSessionId: session.id, round,
      answers: request.answers, idempotencyKey: request.idempotencyKey,
    });
    return this.get(userId, profileId);
  }

  async saveProgress(userId: string, profileId: string, request: SaveLanguagePlacementProgressRequest): Promise<LanguagePlacementView> {
    await this.owned(userId, profileId);
    const session = await this.findSession(userId, profileId);
    if (!session) throw new BadRequestException('Start the language placement first.');
    if (!Array.isArray(request.answers) || request.answers.length !== 4
      || request.answers.some((answer) => typeof answer !== 'string' || answer.length > 4_000)
      || !Number.isInteger(request.currentQuestionIndex) || request.currentQuestionIndex < 0 || request.currentQuestionIndex > 3
      || !Number.isSafeInteger(request.expectedVersion) || request.expectedVersion < 0) {
      throw new BadRequestException('Invalid language placement progress.');
    }
    try {
      await this.prisma.$transaction(async (tx) => {
        const lock = accountDataLockKey(userId);
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lock}, 0))`;
        const row = await tx.experienceSession.findFirst({ where: { id: session.id, userId,
          languageProfileId: profileId, type: 'language', intent: LANGUAGE_PLACEMENT_INTENT } });
        if (!row) throw new NotFoundException('Language placement not found.');
        const state = this.state({ ...session, currentStep: row.currentStep } as unknown as ExperienceSession, profileId);
        if (state.status !== 'active' || state.assessmentIds[state.round] !== request.assessmentId) {
          throw this.stateConflict();
        }
        // A claimed/failed/ready Examiner submission already owns these answers.
        // An autosave can never mutate them or manufacture another attempt.
        const submitted = await tx.assessmentSubmission.findFirst({ where: { userId,
          assessmentId: request.assessmentId, masterySubmissionKey: `language-placement:${request.assessmentId}` },
          select: { id: true } });
        if (submitted) throw this.stateConflict();
        const previous = this.savedProgress(state);
        const version = previous?.version ?? 0;
        if (request.expectedVersion !== version) throw this.stateConflict();
        if (previous && previous.currentQuestionIndex === request.currentQuestionIndex
          && JSON.stringify(previous.answers) === JSON.stringify(request.answers)) return;
        const next = { ...state, progress: { assessmentId: request.assessmentId,
          answers: [...request.answers], currentQuestionIndex: request.currentQuestionIndex,
          version: version + 1, completed: false, source: 'draft' as const } };
        const saved = await tx.experienceSession.updateMany({ where: { id: row.id, userId, version: row.version }, data: {
          currentStep: this.step(next) as unknown as Prisma.InputJsonValue, version: { increment: 1 },
        } });
        if (saved.count !== 1) throw this.stateConflict();
      });
    } catch (error) {
      if (error instanceof ConflictException || error instanceof NotFoundException || error instanceof PlacementRuntimeException) throw error;
      throw new PlacementRuntimeException('PLACEMENT_PASSPORT_WRITE_FAILED');
    }
    return this.get(userId, profileId);
  }

  async requireCourseEntry(userId: string, profileId: string): Promise<CefrLevel> {
    const placement = await this.requireCoursePlacement(userId, profileId);
    return placement.globalLevel === 'PRE_A1' ? 'A1' : placement.globalLevel;
  }

  async requireCoursePlacement(userId: string, profileId: string): Promise<LanguagePlacementView & {
    globalLevel: NonNullable<LanguagePlacementView['globalLevel']>;
  }> {
    const placement = await this.get(userId, profileId);
    if (placement.status !== 'complete' || !placement.globalLevel) {
      throw new ConflictException({ code: 'LANGUAGE_PLACEMENT_REQUIRED', message: 'Complete the language diagnostic before starting a new course.' });
    }
    return placement as LanguagePlacementView & { globalLevel: NonNullable<LanguagePlacementView['globalLevel']> };
  }

  private async owned(userId: string, profileId: string): Promise<LanguageProfile> {
    const profile = await this.prisma.languageProfile.findFirst({ where: { id: profileId, userId } });
    if (!profile) throw new NotFoundException('Language profile not found.');
    return profile;
  }

  private async findSession(userId: string, profileId: string): Promise<ExperienceSession | null> {
    const row = await this.prisma.experienceSession.findFirst({
      where: { userId, languageProfileId: profileId, type: 'language', intent: LANGUAGE_PLACEMENT_INTENT,
        idempotencyKey: `language-placement:v1:${profileId}` }, select: { id: true },
    });
    return row ? this.experiences.get(userId, row.id) : null;
  }

  private state(session: ExperienceSession, profileId: string): StoredPlacement {
    const state = record(session.currentStep?.metadata?.languagePlacement);
    if (state?.schemaVersion !== SCHEMA_VERSION || state.policyVersion !== LANGUAGE_PLACEMENT_POLICY_VERSION
      || state.profileId !== profileId || ![1, 2, 3].includes(Number(state.round))
      || !(LANGUAGE_PLACEMENT_SELF_ESTIMATES as readonly unknown[]).includes(state.selfEstimate)
      || !record(state.assessmentIds) || !Array.isArray(state.submissionIds)
      || state.submissionIds.length > 3 || !placementSummaryFromStep(session.currentStep)) {
      throw new ConflictException('The language placement state is incompatible.');
    }
    return state as unknown as StoredPlacement;
  }

  private async save(userId: string, session: ExperienceSession, previous: StoredPlacement, next: StoredPlacement): Promise<ExperienceSession> {
    try {
      await this.prisma.$transaction(async (tx) => {
        const lock = accountDataLockKey(userId);
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lock}, 0))`;
        const row = await tx.experienceSession.findFirst({ where: { id: session.id, userId, languageProfileId: next.profileId,
          type: 'language', intent: LANGUAGE_PLACEMENT_INTENT } });
        if (!row) throw new NotFoundException('Language placement not found.');
        const current = record(record(row.currentStep)?.metadata)?.languagePlacement;
        if (JSON.stringify(current) === JSON.stringify(next)) return;
        if (JSON.stringify(current) !== JSON.stringify(previous)) {
          throw this.stateConflict();
        }
        const result = await tx.experienceSession.updateMany({ where: { id: row.id, userId, version: row.version }, data: {
          currentStep: this.step(next) as unknown as Prisma.InputJsonValue,
          progress: { completed: next.status === 'complete' ? 1 : 0, total: 1 },
          status: next.status === 'complete' ? 'completed' : 'active',
          completedAt: next.completedAt ? new Date(next.completedAt) : null, version: { increment: 1 },
        } });
        if (result.count !== 1) throw this.stateConflict();
      });
    } catch (error) {
      if (error instanceof ConflictException || error instanceof NotFoundException || error instanceof PlacementRuntimeException) throw error;
      throw new PlacementRuntimeException('PLACEMENT_PASSPORT_WRITE_FAILED');
    }
    return this.experiences.get(userId, session.id);
  }

  private step(state: StoredPlacement): NonNullable<ExperienceSession['currentStep']> {
    return { id: `placement:${state.round}`, state: state.status === 'complete' ? 'completed' : 'active',
      metadata: { languagePlacement: state } };
  }

  private view(profile: LanguageProfile, supportLanguage: string, state: StoredPlacement | null,
    skills: LanguagePlacementSkillEvidence[], assessment: AssessmentView | null,
    progress: LanguagePlacementView['progress'] = null): LanguagePlacementView {
    return {
      policyVersion: LANGUAGE_PLACEMENT_POLICY_VERSION, profileId: profile.id, targetLanguage: profile.language,
      supportLanguage, status: state?.status ?? 'required', selfEstimate: state?.selfEstimate ?? null,
      round: state?.round ?? 1, globalLevel: state?.globalLevel ?? null, productLevel: state?.productLevel ?? null,
      skills, assessment, completedAt: state?.completedAt ?? null, submissionIds: state?.submissionIds ?? [],
      oralStatus: 'NOT_EVALUATED', nextAction: state?.status === 'complete' ? 'PREPARE_LEARNING_PATH'
        : state?.status === 'not_evaluable' ? 'REVIEW_DIAGNOSTIC_AVAILABILITY' : 'COMPLETE_WRITTEN_DIAGNOSTIC',
      progress,
    };
  }

  private savedProgress(state: StoredPlacement): LanguagePlacementView['progress'] {
    const progress = state.progress;
    if (!progress || progress.assessmentId !== state.assessmentIds[state.round]
      || !Array.isArray(progress.answers) || progress.answers.length !== 4
      || progress.answers.some((answer) => typeof answer !== 'string' || answer.length > 4_000)
      || !Number.isInteger(progress.currentQuestionIndex) || progress.currentQuestionIndex < 0 || progress.currentQuestionIndex > 3
      || !Number.isSafeInteger(progress.version) || progress.version < 1
      || progress.source !== 'draft' || progress.completed !== false) return null;
    return { ...progress, answers: [...progress.answers] };
  }

  private async progress(userId: string, state: StoredPlacement): Promise<LanguagePlacementView['progress']> {
    const assessmentId = state.assessmentIds[state.round];
    if (!assessmentId) return null;
    const saved = this.savedProgress(state);
    const submitted = await this.prisma.assessmentSubmission.findFirst({ where: { userId, assessmentId,
      masterySubmissionKey: `language-placement:${assessmentId}` }, select: { answers: true, masteryGenerationStatus: true } });
    if (!submitted) return saved;
    if (!Array.isArray(submitted.answers) || submitted.answers.length !== 4
      || submitted.answers.some((answer) => typeof answer !== 'string' || answer.length > 4_000)) {
      throw new PlacementRuntimeException('PLACEMENT_LEVEL_MAPPING_FAILED');
    }
    return { assessmentId, answers: submitted.answers as string[], currentQuestionIndex: saved?.currentQuestionIndex ?? 3,
      version: saved?.version ?? 0, completed: true, source: 'submission',
      ...(['grading', 'failed', 'ready'].includes(submitted.masteryGenerationStatus ?? '')
        ? { submissionStatus: submitted.masteryGenerationStatus as 'grading' | 'failed' | 'ready' } : {}) };
  }

  private stateConflict(): ConflictException {
    return new ConflictException({ code: 'PLACEMENT_STATE_CONFLICT',
      message: 'Language placement changed. Reload it before continuing.' });
  }

  private requestKey(value: string): void {
    if (typeof value !== 'string' || !value.trim() || value.length > 200) throw new BadRequestException('A bounded placement idempotency key is required.');
  }
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
