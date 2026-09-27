import {
  BadRequestException,
  ConflictException,
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
  ExperienceStep,
  ExperienceSessionType,
  UpdateExperienceSessionRequest,
} from '@second-brain/shared';
import {
  PERFORMANCE_BUDGETS,
  TEACHER_POLICY_METADATA_SOURCE,
  assertValidContext,
  createContext,
  isTeacherPolicySnapshot,
} from '@second-brain/shared';
import { PrismaService } from '../prisma/prisma.service';

const TERMINAL_STATUSES: readonly PrismaExperienceSessionStatus[] = [
  'completed',
  'abandoned',
  'failed',
];

const SERVER_IDEMPOTENCY_PREFIX = 'server:v2:';
const LEGACY_TUTOR_IDEMPOTENCY_PREFIXES = [
  'tutor:',
  'language-conversation:',
] as const;
const TUTOR_RECONCILIATION_ATTEMPTS = 4;
const RESERVED_CLIENT_IDEMPOTENCY_PREFIXES = [
  'server:',
  'tutor:',
  'lesson:',
  'language-conversation:',
] as const;

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

  /** Public clients may describe resumable UI state, but server-owned teaching
   * rules are never accepted through that generic JSON envelope. */
  createFromClient(
    userId: string,
    request: CreateExperienceSessionRequest,
  ): Promise<ExperienceSession> {
    const idempotencyKey = request.idempotencyKey?.trim().toLowerCase();
    if (
      idempotencyKey &&
      RESERVED_CLIENT_IDEMPOTENCY_PREFIXES.some((prefix) =>
        idempotencyKey.startsWith(prefix),
      )
    ) {
      throw new BadRequestException(
        'This experience-session idempotency namespace is reserved.',
      );
    }
    // Tutor and language wrappers carry server-owned pedagogical policy. They
    // may only be created by their domain services, never through the generic
    // session endpoint where a client controls intent/currentStep.
    if (
      request.type === 'tutor' ||
      request.type === 'language' ||
      request.links?.tutorSessionId ||
      request.links?.lessonId
    ) {
      throw new BadRequestException(
        'Teaching experience sessions must be created by the teaching service.',
      );
    }
    return this.create(userId, {
      ...request,
      ...(request.currentStep === undefined
        ? {}
        : { currentStep: this.sanitizeClientStep(request.currentStep) as ExperienceStep }),
    });
  }

  /** Preserve an existing server policy while applying client-owned progress
   * updates. A client cannot clear or replace the policy by replacing a step. */
  async updateFromClient(
    userId: string,
    id: string,
    request: UpdateExperienceSessionRequest,
  ): Promise<ExperienceSession> {
    const existing = await this.requireOwned(userId, id);
    if (
      (existing.tutorSessionId || existing.lessonId) &&
      (request.intent !== undefined || request.currentStep !== undefined)
    ) {
      throw new BadRequestException(
        'Teaching intent and policy state are managed by the teaching service.',
      );
    }
    if (request.currentStep === undefined) return this.updateState(userId, id, request);
    const storedStep = readJson<ExperienceStep | null>(existing.currentStep, null);
    return this.updateState(userId, id, {
      ...request,
      currentStep: this.sanitizeClientStep(request.currentStep, storedStep),
    });
  }

  async create(
    userId: string,
    request: CreateExperienceSessionRequest,
  ): Promise<ExperienceSession> {
    const idempotencyKey = request.idempotencyKey?.trim() || null;
    const links = this.normalizeLinks(request.links);
    if (idempotencyKey) {
      const existing = await this.prisma.experienceSession.findUnique({
        where: { userId_idempotencyKey: { userId, idempotencyKey } },
      });
      if (existing) {
        this.assertIdempotencyMatch(existing, request.type, links);
        return this.toView(existing);
      }
    }

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
        if (existing) {
          this.assertIdempotencyMatch(existing, request.type, links);
          return this.toView(existing);
        }
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
    const result = await this.prisma.experienceSession.updateMany({
      where: {
        id,
        userId,
        version: existing.version,
        status: existing.status,
      },
      data,
    });
    if (result.count !== 1) {
      throw new ConflictException(
        'Experience session changed concurrently. Reload it and retry.',
      );
    }
    return this.toView(await this.requireOwned(userId, id));
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
    // Only the deterministic server idempotency key marks an authoritative
    // wrapper. Historical generic-client rows may predate the policy boundary
    // and must never be promoted into trusted teaching state.
    const row = await this.prisma.experienceSession.findUnique({
      where: {
        userId_idempotencyKey: {
          userId,
          idempotencyKey: this.tutorIdempotencyKey(tutorSessionId),
        },
      },
    });
    return row && row.tutorSessionId === tutorSessionId &&
      (row.type === 'tutor' || row.type === 'language')
      ? this.toView(row)
      : null;
  }

  /** Batch companion for bounded Tutor history. The first row for an id is the
   *  original server-created wrapper. */
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
        idempotencyKey: { in: tutorSessionIds.map((id) => this.tutorIdempotencyKey(id)) },
      },
      orderBy: { startedAt: 'asc' },
    });
    const result = new Map<string, ExperienceSession>();
    for (const row of rows) {
      if (row.tutorSessionId && !result.has(row.tutorSessionId)) {
        result.set(row.tutorSessionId, this.toView(row));
      }
    }
    return result;
  }

  /** Resolve the server-owned teaching wrapper for a written lesson. */
  async findByLesson(
    userId: string,
    lessonId: string,
  ): Promise<ExperienceSession | null> {
    const row = await this.prisma.experienceSession.findUnique({
      where: {
        userId_idempotencyKey: {
          userId,
          idempotencyKey: this.lessonIdempotencyKey(lessonId),
        },
      },
    });
    return row && row.lessonId === lessonId && row.type === 'learning'
      ? this.toView(row)
      : null;
  }

  /** Idempotently attach a Tutor session to the transversal session contract.
   * Historical client-claimable keys are intentionally left untrusted. */
  async ensureTutorSession(
    userId: string,
    request: Omit<CreateExperienceSessionRequest, 'type' | 'idempotencyKey'> & {
      links: Partial<ExperienceSessionLinks> & { tutorSessionId: string };
    },
  ): Promise<ExperienceSession> {
    return this.ensureTutorLinkedSession(userId, 'tutor', request);
  }

  /** Language conversations share the Tutor domain object and therefore the
   * same single canonical continuity wrapper, with a language-specific type. */
  async ensureLanguageSession(
    userId: string,
    request: Omit<CreateExperienceSessionRequest, 'type' | 'idempotencyKey'> & {
      links: Partial<ExperienceSessionLinks> & { tutorSessionId: string };
    },
  ): Promise<ExperienceSession> {
    return this.ensureTutorLinkedSession(userId, 'language', request);
  }

  private async ensureTutorLinkedSession(
    userId: string,
    type: 'tutor' | 'language',
    request: Omit<CreateExperienceSessionRequest, 'type' | 'idempotencyKey'> & {
      links: Partial<ExperienceSessionLinks> & { tutorSessionId: string };
    },
  ): Promise<ExperienceSession> {
    const tutorSessionId = request.links.tutorSessionId;
    const idempotencyKey = this.tutorIdempotencyKey(tutorSessionId);
    const requestedLinks = this.normalizeLinks(request.links);
    await this.assertOwnedLinks(userId, requestedLinks);

    let canonical: ExperienceSession | null = null;
    for (let attempt = 0; attempt < TUTOR_RECONCILIATION_ATTEMPTS; attempt += 1) {
      const existing = await this.prisma.experienceSession.findUnique({
        where: { userId_idempotencyKey: { userId, idempotencyKey } },
      });
      if (existing) {
        canonical = await this.reconcileTutorLinkedSession(
          userId,
          existing,
          type,
          request,
          requestedLinks,
        );
        if (canonical) break;
        continue;
      }

      try {
        canonical = await this.create(userId, {
          ...request,
          type,
          idempotencyKey,
        });
        break;
      } catch (error) {
        // Tutor and Language may discover the absent wrapper concurrently. A
        // unique-key loser reloads and promotes/enriches the winner below.
        if (!(error instanceof ConflictException)) throw error;
      }
    }

    if (!canonical) {
      throw new ConflictException(
        'Teaching experience session changed concurrently. Retry the operation.',
      );
    }

    // Historical wrappers used client-claimable namespaces. Their JSON state
    // is deliberately never copied into the canonical server wrapper. Once a
    // trusted wrapper exists, make the old rows terminal so Home cannot offer
    // two resumable representations of the same Tutor session.
    await this.terminalizeLegacyTutorWrappers(userId, tutorSessionId);
    return canonical;
  }

  /**
   * Reconcile a server-owned wrapper using only the current domain request.
   * A language wrapper is the richer representation of a Tutor conversation:
   * promotion adds language/course links, context and the trusted policy
   * snapshot, while a later generic Tutor lookup can never downgrade it.
   * Returns null when a CAS loser must reload and retry.
   */
  private async reconcileTutorLinkedSession(
    userId: string,
    existing: ExperienceSessionRow,
    requestedType: 'tutor' | 'language',
    request: Omit<CreateExperienceSessionRequest, 'type' | 'idempotencyKey'> & {
      links: Partial<ExperienceSessionLinks> & { tutorSessionId: string };
    },
    requestedLinks: ExperienceSessionLinks,
  ): Promise<ExperienceSession | null> {
    if (
      existing.tutorSessionId !== requestedLinks.tutorSessionId ||
      (existing.type !== 'tutor' && existing.type !== 'language')
    ) {
      throw new ConflictException(
        'Experience-session idempotency key is already bound to another request.',
      );
    }

    // The language domain has already supplied the richer trusted snapshot.
    // A generic Tutor ensure is therefore only a lookup, never a downgrade.
    if (existing.type === 'language' && requestedType === 'tutor') {
      return this.toView(existing);
    }

    const promoteToLanguage = requestedType === 'language' && existing.type === 'tutor';
    const mergedLinks = this.mergeTutorLinks(existing, requestedLinks);
    await this.assertOwnedLinks(userId, mergedLinks);

    const existingContext = readJson(existing.activeContexts, createContext(userId));
    assertValidContext(existingContext);
    const mergedContext = this.mergeTrustedContexts(
      userId,
      existingContext,
      request.activeContexts ?? [],
      promoteToLanguage,
    );
    const existingStep = readJson<ExperienceStep | null>(existing.currentStep, null);
    const mergedStep = this.mergeTrustedStep(
      existingStep,
      request.currentStep,
      promoteToLanguage,
    );
    const existingSources = readJson<NonNullable<CreateExperienceSessionRequest['sourceReferences']>>(
      existing.sourceReferences,
      [],
    );
    const mergedSources = mergeByIdentity(
      existingSources,
      request.sourceReferences ?? [],
      (item) => `${item.kind}:${item.id}`,
      promoteToLanguage,
    );

    const candidate = {
      type: promoteToLanguage ? 'language' as const : existing.type,
      title: promoteToLanguage
        ? request.title?.trim() || existing.title
        : existing.title ?? request.title?.trim() ?? null,
      intent: promoteToLanguage
        ? request.intent?.trim() || existing.intent
        : existing.intent ?? request.intent?.trim() ?? null,
      inputModality: promoteToLanguage
        ? request.inputModality ?? existing.inputModality
        : existing.inputModality ?? request.inputModality ?? null,
      activeContexts: mergedContext,
      currentStep: mergedStep,
      sourceReferences: mergedSources,
      resumeTarget: promoteToLanguage
        ? request.resumeTarget ?? readJson(existing.resumeTarget, null)
        : readJson(existing.resumeTarget, null) ?? request.resumeTarget ?? null,
      nextBestAction: promoteToLanguage
        ? request.nextBestAction ?? readJson(existing.nextBestAction, null)
        : readJson(existing.nextBestAction, null) ?? request.nextBestAction ?? null,
      links: mergedLinks,
    };

    this.assertBoundedPayload({
      activeContexts: candidate.activeContexts,
      currentStep: candidate.currentStep,
      sourceReferences: candidate.sourceReferences,
      resumeTarget: candidate.resumeTarget,
      nextBestAction: candidate.nextBestAction,
    });

    const data: Prisma.ExperienceSessionUncheckedUpdateInput = {
      version: { increment: 1 },
    };
    let changed = false;
    const assign = (key: keyof Prisma.ExperienceSessionUncheckedUpdateInput, value: unknown) => {
      (data as Record<string, unknown>)[key] = value;
      changed = true;
    };
    if (candidate.type !== existing.type) assign('type', candidate.type);
    if (candidate.title !== existing.title) assign('title', candidate.title);
    if (candidate.intent !== existing.intent) assign('intent', candidate.intent);
    if (candidate.inputModality !== existing.inputModality) {
      assign('inputModality', candidate.inputModality);
    }
    if (!sameJson(candidate.activeContexts, existing.activeContexts)) {
      assign('activeContexts', asJson(candidate.activeContexts));
    }
    if (!sameJson(candidate.currentStep, readJson(existing.currentStep, null))) {
      assign('currentStep', nullableJson(candidate.currentStep));
    }
    if (!sameJson(candidate.sourceReferences, existingSources)) {
      assign('sourceReferences', asJson(candidate.sourceReferences));
    }
    if (!sameJson(candidate.resumeTarget, readJson(existing.resumeTarget, null))) {
      assign('resumeTarget', nullableJson(candidate.resumeTarget));
    }
    if (!sameJson(candidate.nextBestAction, readJson(existing.nextBestAction, null))) {
      assign('nextBestAction', nullableJson(candidate.nextBestAction));
    }
    for (const key of LINK_KEYS) {
      if (candidate.links[key] !== existing[key]) assign(key, candidate.links[key]);
    }
    if (!changed) return this.toView(existing);

    const result = await this.prisma.experienceSession.updateMany({
      where: {
        id: existing.id,
        userId,
        version: existing.version,
        status: existing.status,
      },
      data,
    });
    if (result.count !== 1) return null;
    return this.toView(await this.requireOwned(userId, existing.id));
  }

  private mergeTutorLinks(
    existing: ExperienceSessionRow,
    requested: ExperienceSessionLinks,
  ): ExperienceSessionLinks {
    const result = {} as ExperienceSessionLinks;
    for (const key of LINK_KEYS) {
      const stored = existing[key];
      const incoming = requested[key];
      if (stored && incoming && stored !== incoming) {
        throw new ConflictException(
          'Teaching experience session is already linked to another resource.',
        );
      }
      result[key] = stored ?? incoming;
    }
    return result;
  }

  private mergeTrustedContexts(
    userId: string,
    existing: ExperienceSession['activeContexts'],
    incoming: NonNullable<CreateExperienceSessionRequest['activeContexts']>,
    incomingWins: boolean,
  ): ExperienceSession['activeContexts'] {
    if (incoming.length === 0) return existing;
    const items = new Map(existing.items.map((item) => [contextIdentity(item), item]));
    for (const item of incoming) {
      const key = contextIdentity(item);
      const stored = items.get(key);
      if (!stored) {
        items.set(key, item as typeof existing.items[number]);
        continue;
      }
      const metadata = incomingWins
        ? { ...(stored.metadata ?? {}), ...(item.metadata ?? {}) }
        : { ...(item.metadata ?? {}), ...(stored.metadata ?? {}) };
      items.set(key, {
        ...(incomingWins ? { ...stored, ...item } : { ...item, ...stored }),
        addedAt: stored.addedAt,
        ...(Object.keys(metadata).length > 0 ? { metadata } : {}),
      });
    }
    const merged = createContext(userId, [...items.values()]);
    return sameJson(merged.items, existing.items) ? existing : merged;
  }

  private mergeTrustedStep(
    existing: ExperienceStep | null,
    incoming: ExperienceStep | undefined,
    incomingWins: boolean,
  ): ExperienceStep | null {
    if (!incoming) return existing;
    if (!existing) return incoming;
    const metadata = incomingWins
      ? { ...(existing.metadata ?? {}), ...(incoming.metadata ?? {}) }
      : { ...(incoming.metadata ?? {}), ...(existing.metadata ?? {}) };
    return {
      ...(incomingWins ? { ...existing, ...incoming } : { ...incoming, ...existing }),
      ...(Object.keys(metadata).length > 0 ? { metadata } : {}),
    };
  }

  private async terminalizeLegacyTutorWrappers(
    userId: string,
    tutorSessionId: string,
  ): Promise<void> {
    for (const prefix of LEGACY_TUTOR_IDEMPOTENCY_PREFIXES) {
      const idempotencyKey = `${prefix}${tutorSessionId}`;
      let terminal = false;
      for (let attempt = 0; attempt < TUTOR_RECONCILIATION_ATTEMPTS; attempt += 1) {
        const legacy = await this.prisma.experienceSession.findUnique({
          where: { userId_idempotencyKey: { userId, idempotencyKey } },
        });
        if (!legacy || TERMINAL_STATUSES.includes(legacy.status)) {
          terminal = true;
          break;
        }
        const result = await this.prisma.experienceSession.updateMany({
          where: {
            id: legacy.id,
            userId,
            version: legacy.version,
            status: legacy.status,
          },
          data: {
            status: 'abandoned',
            pausedAt: null,
            version: { increment: 1 },
          },
        });
        if (result.count === 1) {
          terminal = true;
          break;
        }
      }
      if (!terminal) {
        throw new ConflictException(
          'Legacy teaching experience session changed concurrently. Retry the operation.',
        );
      }
    }
  }

  /** Idempotently attach a lesson to a server-owned pedagogical snapshot. */
  async ensureLessonSession(
    userId: string,
    request: Omit<CreateExperienceSessionRequest, 'type' | 'idempotencyKey'> & {
      links: Partial<ExperienceSessionLinks> & { lessonId: string };
    },
  ): Promise<ExperienceSession> {
    const existing = await this.findByLesson(userId, request.links.lessonId);
    if (existing) return existing;
    return this.create(userId, {
      ...request,
      type: 'learning',
      idempotencyKey: this.lessonIdempotencyKey(request.links.lessonId),
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
    const result = await this.prisma.experienceSession.updateMany({
      where: {
        id,
        userId,
        version: existing.version,
        status: existing.status,
      },
      data: {
        status: target,
        pausedAt: target === 'paused' ? now : null,
        completedAt: target === 'completed' ? now : null,
        version: { increment: 1 },
      },
    });
    if (result.count !== 1) {
      const current = await this.requireOwned(userId, id);
      if (current.status === target) return this.toView(current);
      throw new ConflictException(
        'Experience session changed concurrently. Reload it and retry.',
      );
    }
    return this.toView(await this.requireOwned(userId, id));
  }

  private tutorIdempotencyKey(tutorSessionId: string): string {
    return `${SERVER_IDEMPOTENCY_PREFIX}tutor:${tutorSessionId}`;
  }

  private lessonIdempotencyKey(lessonId: string): string {
    return `${SERVER_IDEMPOTENCY_PREFIX}lesson:${lessonId}`;
  }

  private assertIdempotencyMatch(
    existing: ExperienceSessionRow,
    type: ExperienceSessionType,
    links: ExperienceSessionLinks,
  ): void {
    const sameType = existing.type === this.toPrismaType(type);
    const sameLinks = LINK_KEYS.every((key) => existing[key] === links[key]);
    if (!sameType || !sameLinks) {
      throw new ConflictException(
        'Experience-session idempotency key is already bound to another request.',
      );
    }
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

  private sanitizeClientStep(
    incoming: ExperienceStep | null,
    stored: ExperienceStep | null = null,
  ): ExperienceStep | null {
    const storedMetadata = stored?.metadata;
    const storedPolicy = storedMetadata?.teacherPolicy;
    const preservePolicy = storedMetadata?.teacherPolicySource === TEACHER_POLICY_METADATA_SOURCE &&
      isTeacherPolicySnapshot(storedPolicy);

    // A generic client clearing a step must not silently replace the immutable
    // rules of an in-progress assessed/tutor experience.
    if (incoming === null) return preservePolicy ? stored : null;

    const metadata = { ...(incoming.metadata ?? {}) };
    delete metadata.teacherPolicy;
    delete metadata.teacherPolicySource;
    if (preservePolicy) {
      metadata.teacherPolicy = storedPolicy;
      metadata.teacherPolicySource = TEACHER_POLICY_METADATA_SOURCE;
    }
    return { ...incoming, metadata };
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

function contextIdentity(item: {
  id: string;
  kind: string;
  referenceId?: string;
}): string {
  return `${item.kind}:${item.referenceId ?? ''}:${item.id}`;
}

function mergeByIdentity<T>(
  existing: readonly T[],
  incoming: readonly T[],
  identity: (item: T) => string,
  incomingWins: boolean,
): T[] {
  const merged = new Map(existing.map((item) => [identity(item), item]));
  for (const item of incoming) {
    const key = identity(item);
    if (!merged.has(key) || incomingWins) merged.set(key, item);
  }
  return [...merged.values()];
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}
