import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  type ExperienceSession as ExperienceSessionRow,
  type ExperienceSessionStatus as PrismaExperienceSessionStatus,
  type ExperienceSessionType as PrismaExperienceSessionType,
} from '@prisma/client';
import type {
  CreateExperienceSessionRequest,
  ExperienceProgress,
  ExperienceSession,
  ExperienceSessionLinks,
  ExperienceSessionPage,
  ExperienceSessionType,
  UpdateExperienceSessionRequest,
} from '@second-brain/shared';
import {
  PERFORMANCE_BUDGETS,
  assertValidContext,
  createContext,
} from '@second-brain/shared';
import { PrismaService } from '../prisma/prisma.service';

const TERMINAL_STATUSES: readonly PrismaExperienceSessionStatus[] = [
  'completed',
  'abandoned',
  'failed',
];

const LINK_KEYS: readonly (keyof ExperienceSessionLinks)[] = [
  'tutorSessionId',
  'studySessionId',
  'documentId',
  'lessonId',
  'goalId',
  'languageProfileId',
  'workspaceRef',
];

@Injectable()
export class ExperienceSessionService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    userId: string,
    request: CreateExperienceSessionRequest,
  ): Promise<ExperienceSession> {
    const idempotencyKey = request.idempotencyKey?.trim() || null;
    if (idempotencyKey) {
      const existing = await this.prisma.experienceSession.findUnique({
        where: { userId_idempotencyKey: { userId, idempotencyKey } },
      });
      if (existing) return this.toView(existing);
    }

    const links = this.normalizeLinks(request.links);
    await this.assertOwnedLinks(userId, links);
    const activeContexts = createContext(userId, request.activeContexts ?? []);
    const progress = this.normalizeProgress(request.progress);

    this.assertBoundedPayload({
      activeContexts,
      currentStep: request.currentStep,
      progress,
      productions: request.productions ?? [],
      sourceReferences: request.sourceReferences ?? [],
      resumeTarget: request.resumeTarget,
      nextBestAction: request.nextBestAction,
    });

    const data: Prisma.ExperienceSessionUncheckedCreateInput = {
      userId,
      type: this.toPrismaType(request.type),
      title: request.title?.trim() || null,
      intent: request.intent?.trim() || null,
      inputModality: request.inputModality ?? null,
      activeContexts: asJson(activeContexts),
      currentStep: optionalJson(request.currentStep),
      progress: optionalJson(progress),
      productions: asJson(request.productions ?? []),
      sourceReferences: asJson(request.sourceReferences ?? []),
      resumeTarget: optionalJson(request.resumeTarget),
      nextBestAction: optionalJson(request.nextBestAction),
      tutorSessionId: links.tutorSessionId,
      studySessionId: links.studySessionId,
      documentId: links.documentId,
      lessonId: links.lessonId,
      goalId: links.goalId,
      languageProfileId: links.languageProfileId,
      workspaceRef: links.workspaceRef,
      idempotencyKey,
    };

    try {
      return this.toView(await this.prisma.experienceSession.create({ data }));
    } catch (error) {
      // Two identical retried requests can race. The unique key makes the
      // operation safe; return the winner rather than surfacing a false error.
      if (idempotencyKey && isUniqueConstraintError(error)) {
        const existing = await this.prisma.experienceSession.findUnique({
          where: { userId_idempotencyKey: { userId, idempotencyKey } },
        });
        if (existing) return this.toView(existing);
      }
      throw error;
    }
  }

  async get(userId: string, id: string): Promise<ExperienceSession> {
    return this.toView(await this.requireOwned(userId, id));
  }

  async updateState(
    userId: string,
    id: string,
    request: UpdateExperienceSessionRequest,
  ): Promise<ExperienceSession> {
    const existing = await this.requireOwned(userId, id);
    if (TERMINAL_STATUSES.includes(existing.status) && request.status !== existing.status) {
      throw new BadRequestException('A terminal experience session cannot be updated.');
    }

    const data: Prisma.ExperienceSessionUncheckedUpdateInput = {
      version: { increment: 1 },
    };

    if (request.status !== undefined) {
      data.status = request.status;
      data.pausedAt = null;
    }
    if (request.title !== undefined) data.title = request.title.trim() || null;
    if (request.intent !== undefined) data.intent = request.intent.trim() || null;
    if (request.inputModality !== undefined) data.inputModality = request.inputModality;
    if (request.activeContexts !== undefined) {
      data.activeContexts = asJson(createContext(userId, request.activeContexts));
    }
    if (request.currentStep !== undefined) data.currentStep = nullableJson(request.currentStep);
    if (request.progress !== undefined) {
      data.progress = nullableJson(this.normalizeProgress(request.progress));
    }
    if (request.productions !== undefined) data.productions = asJson(request.productions);
    if (request.sourceReferences !== undefined) {
      data.sourceReferences = asJson(request.sourceReferences);
    }
    if (request.twinImpact !== undefined) data.twinImpact = nullableJson(request.twinImpact);
    if (request.resumeTarget !== undefined) data.resumeTarget = nullableJson(request.resumeTarget);
    if (request.nextBestAction !== undefined) {
      data.nextBestAction = nullableJson(request.nextBestAction);
    }

    this.assertBoundedPayload(request);
    const updated = await this.prisma.experienceSession.update({ where: { id }, data });
    return this.toView(updated);
  }

  pause(userId: string, id: string): Promise<ExperienceSession> {
    return this.transition(userId, id, 'paused');
  }

  resume(userId: string, id: string): Promise<ExperienceSession> {
    return this.transition(userId, id, 'active');
  }

  complete(userId: string, id: string): Promise<ExperienceSession> {
    return this.transition(userId, id, 'completed');
  }

  recent(userId: string, limit: number, cursor?: string): Promise<ExperienceSessionPage> {
    return this.list(userId, limit, cursor);
  }

  resumable(userId: string, limit: number, cursor?: string): Promise<ExperienceSessionPage> {
    return this.list(userId, limit, cursor, ['active', 'paused']);
  }

  /** Resolve the continuity wrapper of one Tutor session without exposing
   *  another user's relationship, even when an id is guessed. */
  async findByTutorSession(
    userId: string,
    tutorSessionId: string,
  ): Promise<ExperienceSession | null> {
    const row = await this.prisma.experienceSession.findFirst({
      where: { userId, tutorSessionId, type: { in: ['tutor', 'language'] } },
      orderBy: { updatedAt: 'desc' },
    });
    return row ? this.toView(row) : null;
  }

  /** Batch companion for bounded Tutor history. The first row for an id is the
   *  most recently updated wrapper. */
  async findByTutorSessions(
    userId: string,
    tutorSessionIds: readonly string[],
  ): Promise<Map<string, ExperienceSession>> {
    if (tutorSessionIds.length === 0) return new Map();
    const rows = await this.prisma.experienceSession.findMany({
      where: {
        userId,
        tutorSessionId: { in: [...tutorSessionIds] },
        type: { in: ['tutor', 'language'] },
      },
      orderBy: { updatedAt: 'desc' },
    });
    const result = new Map<string, ExperienceSession>();
    for (const row of rows) {
      if (row.tutorSessionId && !result.has(row.tutorSessionId)) {
        result.set(row.tutorSessionId, this.toView(row));
      }
    }
    return result;
  }

  /** Idempotently attach a Tutor session to the transversal session contract.
   *  This also upgrades legacy Tutor sessions lazily when the learner opens one. */
  async ensureTutorSession(
    userId: string,
    request: Omit<CreateExperienceSessionRequest, 'type'> & {
      links: Partial<ExperienceSessionLinks> & { tutorSessionId: string };
    },
  ): Promise<ExperienceSession> {
    const existing = await this.findByTutorSession(userId, request.links.tutorSessionId);
    if (existing) return existing;
    return this.create(userId, {
      ...request,
      type: 'tutor',
      idempotencyKey: request.idempotencyKey ?? `tutor:${request.links.tutorSessionId}`,
    });
  }

  private async transition(
    userId: string,
    id: string,
    target: 'active' | 'paused' | 'completed',
  ): Promise<ExperienceSession> {
    const existing = await this.requireOwned(userId, id);
    if (existing.status === target) return this.toView(existing);
    if (TERMINAL_STATUSES.includes(existing.status)) {
      throw new BadRequestException('A terminal experience session cannot transition.');
    }
    if (target === 'active' && existing.status !== 'paused') {
      throw new BadRequestException('Only a paused experience session can be resumed.');
    }
    const now = new Date();
    const updated = await this.prisma.experienceSession.update({
      where: { id },
      data: {
        status: target,
        pausedAt: target === 'paused' ? now : null,
        completedAt: target === 'completed' ? now : null,
        version: { increment: 1 },
      },
    });
    return this.toView(updated);
  }

  private async list(
    userId: string,
    limit: number,
    cursor?: string,
    statuses?: PrismaExperienceSessionStatus[],
  ): Promise<ExperienceSessionPage> {
    const safeLimit = Math.max(1, Math.min(limit, PERFORMANCE_BUDGETS.maxListPageSize));
    if (cursor) await this.requireOwned(userId, cursor);
    const rows = await this.prisma.experienceSession.findMany({
      where: { userId, ...(statuses ? { status: { in: statuses } } : {}) },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: safeLimit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    const hasMore = rows.length > safeLimit;
    const pageRows = hasMore ? rows.slice(0, safeLimit) : rows;
    return {
      items: pageRows.map((row) => this.toView(row)),
      nextCursor: hasMore ? pageRows.at(-1)?.id ?? null : null,
    };
  }

  private async requireOwned(userId: string, id: string): Promise<ExperienceSessionRow> {
    const row = await this.prisma.experienceSession.findFirst({ where: { id, userId } });
    if (!row) throw new NotFoundException('Experience session not found.');
    return row;
  }

  private normalizeLinks(
    input: Partial<ExperienceSessionLinks> | undefined,
  ): ExperienceSessionLinks {
    if (input) {
      const unknown = Object.keys(input).filter(
        (key) => !LINK_KEYS.includes(key as keyof ExperienceSessionLinks),
      );
      if (unknown.length > 0) throw new BadRequestException('Unknown experience link.');
      for (const value of Object.values(input)) {
        if (value !== undefined && value !== null && typeof value !== 'string') {
          throw new BadRequestException('Experience links must be string references.');
        }
        if (typeof value === 'string' && (value.length === 0 || value.length > 200)) {
          throw new BadRequestException('Experience link is invalid.');
        }
      }
    }
    return {
      tutorSessionId: input?.tutorSessionId ?? null,
      studySessionId: input?.studySessionId ?? null,
      documentId: input?.documentId ?? null,
      lessonId: input?.lessonId ?? null,
      goalId: input?.goalId ?? null,
      languageProfileId: input?.languageProfileId ?? null,
      workspaceRef: input?.workspaceRef ?? null,
    };
  }

  private async assertOwnedLinks(userId: string, links: ExperienceSessionLinks): Promise<void> {
    const checks: Array<Promise<unknown>> = [];
    if (links.tutorSessionId) checks.push(this.prisma.tutorSession.findFirst({ where: { id: links.tutorSessionId, userId }, select: { id: true } }));
    if (links.studySessionId) checks.push(this.prisma.studySession.findFirst({ where: { id: links.studySessionId, userId }, select: { id: true } }));
    if (links.documentId) checks.push(this.prisma.document.findFirst({ where: { id: links.documentId, userId }, select: { id: true } }));
    if (links.lessonId) checks.push(this.prisma.lesson.findFirst({ where: { id: links.lessonId, userId }, select: { id: true } }));
    if (links.goalId) checks.push(this.prisma.goal.findFirst({ where: { id: links.goalId, userId }, select: { id: true } }));
    if (links.languageProfileId) checks.push(this.prisma.languageProfile.findFirst({ where: { id: links.languageProfileId, userId }, select: { id: true } }));
    const results = await Promise.all(checks);
    if (results.some((result) => result === null)) {
      throw new BadRequestException('An experience link is invalid for this user.');
    }
  }

  private normalizeProgress(
    progress: ExperienceProgress | null | undefined,
  ): ExperienceProgress | null | undefined {
    if (progress === null || progress === undefined) return progress;
    if (!Number.isFinite(progress.completed) || progress.completed < 0) {
      throw new BadRequestException('Experience progress is invalid.');
    }
    if (progress.total === undefined) {
      const { percent: _ignored, ...withoutPercent } = progress;
      return withoutPercent;
    }
    if (!Number.isFinite(progress.total) || progress.total <= 0) {
      throw new BadRequestException('Experience progress total is invalid.');
    }
    const completed = Math.min(progress.completed, progress.total);
    return {
      ...progress,
      completed,
      percent: Math.round((completed / progress.total) * 100),
    };
  }

  private assertBoundedPayload(value: unknown): void {
    const fields = value && typeof value === 'object'
      ? Object.entries(value as Record<string, unknown>)
      : [['state', value] as const];
    for (const [name, fieldValue] of fields) {
      if (fieldValue === undefined) continue;
      let serialized: string;
      try {
        serialized = JSON.stringify(fieldValue);
      } catch {
        throw new BadRequestException('Experience session state is not serializable.');
      }
      if (serialized.length > PERFORMANCE_BUDGETS.maxSessionJsonCharsPerField) {
        throw new BadRequestException(`Experience session field ${name} is too large.`);
      }
    }
  }

  private toPrismaType(type: ExperienceSessionType): PrismaExperienceSessionType {
    return type === 'document-processing' ? 'document_processing' : type;
  }

  private toView(row: ExperienceSessionRow): ExperienceSession {
    assertValidContext(row.activeContexts);
    return {
      id: row.id,
      userId: row.userId,
      version: row.version,
      type: row.type === 'document_processing' ? 'document-processing' : row.type,
      status: row.status,
      title: row.title,
      intent: row.intent,
      inputModality: row.inputModality,
      activeContexts: row.activeContexts,
      currentStep: readJson(row.currentStep, null),
      progress: readJson(row.progress, null),
      productions: readJson(row.productions, []),
      sourceReferences: readJson(row.sourceReferences, []),
      twinImpact: readJson(row.twinImpact, null),
      resumeTarget: readJson(row.resumeTarget, null),
      nextBestAction: readJson(row.nextBestAction, null),
      links: {
        tutorSessionId: row.tutorSessionId,
        studySessionId: row.studySessionId,
        documentId: row.documentId,
        lessonId: row.lessonId,
        goalId: row.goalId,
        languageProfileId: row.languageProfileId,
        workspaceRef: row.workspaceRef,
      },
      startedAt: row.startedAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      pausedAt: row.pausedAt?.toISOString() ?? null,
      completedAt: row.completedAt?.toISOString() ?? null,
    } as ExperienceSession;
  }
}

function asJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function optionalJson(value: unknown | undefined): Prisma.InputJsonValue | undefined {
  return value === undefined ? undefined : asJson(value);
}

function nullableJson(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  return value === null ? Prisma.JsonNull : asJson(value);
}

function readJson<T>(value: Prisma.JsonValue | null, fallback: T): T {
  return value === null ? fallback : (value as T);
}

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}
