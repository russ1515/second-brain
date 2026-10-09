import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma, type AcademicWorkspace } from '@prisma/client';
import type {
  CreateWorkspaceRequest,
  PersistentWorkspace,
  PersistentWorkspaceAssistRequest,
  PersistentWorkspaceAssistResponse,
  UpdateWorkspaceRequest,
  WorkspaceAssistantHistoryEntry,
  WorkspaceAutosaveRequest,
  WorkspaceAutosaveResult,
  WorkspaceBrief,
  WorkspacePage,
  WorkspacePlanItem,
  WorkspaceProgress,
  WorkspaceProjectStatus,
  WorkspaceSourceReference,
  WorkspaceTemplate,
} from '@second-brain/shared';
import {
  createContext,
  emptyWorkspaceBrief,
  WORKSPACE_BRIEF_FIELDS,
  WORKSPACE_STEP_IDS,
  WORKSPACE_TEMPLATE_DEFINITIONS,
  WORKSPACE_TEMPLATES,
  workspaceCompletionChecks,
  workspaceDefaultPlan,
  workspaceProgressFromPlan,
} from '@second-brain/shared';
import { localeDirective, resolveLocale } from '../common/learning-locale';
import { LlmService } from '../llm/llm.service';
import { PrismaService } from '../prisma/prisma.service';
import { accountDataLockKey } from '../common/account-data-lock';

const MAX_ASSISTANT_HISTORY = 30;
const MAX_SOURCE_CONTEXT_CHARS = 6_000;

@Injectable()
export class AcademicWorkspaceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmService,
  ) {}

  async create(userId: string, request: CreateWorkspaceRequest): Promise<PersistentWorkspace> {
    const title = request.title.trim();
    if (!title) throw new BadRequestException('A title is required.');
    if (!WORKSPACE_TEMPLATES.includes(request.template)) throw new BadRequestException('Unknown workspace template.');
    const sources = this.normalizeSources(request.sources ?? []);
    const locale = await resolveLocale(this.prisma, userId);
    const brief = this.normalizeBrief(request.brief);
    const plan = this.normalizePlan(
      request.plan?.length ? request.plan : localizedDefaultWorkspacePlan(request.template, locale),
    );
    const progress = workspaceProgressFromPlan(plan, { version: 1, brief });
    const workspaceId = randomUUID();
    const experienceSessionId = randomUUID();
    const now = new Date();
    const resumeTarget = { kind: 'workspace' as const, id: workspaceId, path: `/library/workspace/${workspaceId}` };
    const context = createContext(userId, [{
      id: `workspace:${workspaceId}`,
      kind: 'workspace',
      scope: 'active-object',
      referenceId: workspaceId,
      label: title,
      priority: 100,
      visibility: 'visible',
    }]);

    const row = await this.prisma.$transaction(async (tx) => {
      const lockKey = accountDataLockKey(userId);
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;
      await this.assertOwnedSources(userId, sources, tx);
      await tx.experienceSession.create({ data: {
        id: experienceSessionId,
        userId,
        type: 'workspace',
        status: 'active',
        title,
        intent: request.objective.trim() || null,
        inputModality: 'text',
        activeContexts: asJson(context),
        currentStep: optionalJson(plan[0] ? { id: plan[0].id, label: plan[0].title, state: 'active' } : null),
        progress: asJson({ completed: 0, total: plan.length, ...(plan.length ? { percent: 0 } : {}) }),
        productions: asJson([]),
        sourceReferences: asJson(sources.map((source) => ({
          kind: source.kind === 'collection' ? 'document-collection' : source.kind === 'research-source' ? 'external-source' : 'document',
          id: source.id,
          title: source.title,
        }))),
        resumeTarget: asJson(resumeTarget),
        workspaceRef: workspaceId,
      } });
      return tx.academicWorkspace.create({ data: {
        id: workspaceId,
        userId,
        title,
        template: request.template,
        objective: request.objective.trim(),
        dueAt: request.dueAt ? new Date(request.dueAt) : null,
        plan: asJson(plan),
        sources: asJson(sources),
        draftFormat: 'markdown',
        draftContent: request.initialContent?.slice(0, 200_000) ?? '',
        assistantHistory: asJson([]),
        progress: asJson(progress),
        experienceSessionId,
        resumeTarget: asJson(resumeTarget),
        createdAt: now,
      } });
    });
    return this.toView(row);
  }

  async list(userId: string, requestedLimit = 20, cursor?: string): Promise<WorkspacePage> {
    const limit = Math.min(Math.max(Math.trunc(requestedLimit) || 20, 1), 50);
    const rows = await this.prisma.academicWorkspace.findMany({
      where: { userId, status: { not: 'archived' } },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    const page = rows.slice(0, limit);
    return {
      items: page.map((row) => {
        const plan = fromJson<WorkspacePlanItem[]>(row.plan, []);
        const sources = fromJson<WorkspaceSourceReference[]>(row.sources, []);
        return {
          id: row.id,
          title: row.title,
          template: row.template as WorkspaceTemplate,
          status: row.status as WorkspaceProjectStatus,
          sourceCount: sources.length,
          completedSteps: plan.filter((item) => item.completed).length,
          totalSteps: plan.length,
          updatedAt: row.updatedAt.toISOString(),
          resumeTarget: fromJson(row.resumeTarget, { kind: 'workspace', id: row.id, path: `/library/workspace/${row.id}` }),
        };
      }),
      nextCursor: rows.length > limit ? page[page.length - 1]!.id : null,
    };
  }

  async get(userId: string, id: string): Promise<PersistentWorkspace> {
    return this.toView(await this.requireOwned(userId, id));
  }

  async update(userId: string, id: string, request: UpdateWorkspaceRequest): Promise<PersistentWorkspace> {
    const existing = await this.requireOwned(userId, id);
    const existingProgress = fromJson<WorkspaceProgress>(existing.progress, { completedSteps: [] });
    const existingBrief = existingProgress.workflow?.brief ?? emptyWorkspaceBrief();
    const brief = request.brief === undefined ? existingBrief : this.normalizeBrief(request.brief);
    const workflow = { version: 1 as const, brief };
    const data: Prisma.AcademicWorkspaceUncheckedUpdateInput = {};
    if (request.title !== undefined) data.title = request.title.trim();
    if (request.objective !== undefined) data.objective = request.objective.trim();
    if (request.dueAt !== undefined) data.dueAt = request.dueAt ? new Date(request.dueAt) : null;
    if (request.status !== undefined) data.status = request.status;
    if (request.mode !== undefined) data.mode = request.mode;
    let normalizedSources: WorkspaceSourceReference[] | null = null;
    if (request.sources !== undefined) {
      const sources = this.normalizeSources(request.sources);
      normalizedSources = sources;
      data.sources = asJson(sources);
    }
    if (request.plan !== undefined) {
      const plan = this.normalizePlan(request.plan);
      data.plan = asJson(plan);
      data.progress = asJson(workspaceProgressFromPlan(plan, workflow));
    } else if (request.brief !== undefined) {
      data.progress = asJson({ ...existingProgress, workflow });
    } else if (request.progress !== undefined) {
      data.progress = asJson({ ...request.progress, workflow });
    }
    const row = normalizedSources
      ? await this.prisma.$transaction(async (tx) => {
          const lockKey = accountDataLockKey(userId);
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;
          await this.assertOwnedSources(userId, normalizedSources!, tx);
          const owned = await tx.academicWorkspace.findFirst({ where: { id, userId }, select: { id: true } });
          if (!owned) throw new NotFoundException('Workspace not found.');
          return tx.academicWorkspace.update({ where: { id }, data });
        })
      : await this.prisma.academicWorkspace.update({ where: { id }, data });
    await this.syncExperience(row, request.status);
    return this.toView(row);
  }

  async autosave(userId: string, id: string, request: WorkspaceAutosaveRequest): Promise<WorkspaceAutosaveResult> {
    if (request.workspaceId !== id) throw new BadRequestException('Workspace id mismatch.');
    if (!['markdown', 'plain-text', 'structured'].includes(request.draft.format)) {
      throw new BadRequestException('Unsupported draft format.');
    }
    if (request.draft.content.length > 200_000) throw new BadRequestException('Workspace content is too large.');
    const result = await this.prisma.academicWorkspace.updateMany({
      where: { id, userId, autosaveRevision: request.expectedRevision },
      data: {
        draftFormat: request.draft.format,
        draftContent: request.draft.content,
        autosaveRevision: { increment: 1 },
      },
    });
    if (result.count === 0) {
      await this.requireOwned(userId, id);
      throw new ConflictException({ code: 'workspace_revision_conflict', message: 'This workspace changed elsewhere. Reload before saving again.' });
    }
    const row = await this.requireOwned(userId, id);
    if (row.experienceSessionId) {
      await this.prisma.experienceSession.updateMany({
        where: { id: row.experienceSessionId, userId },
        data: { version: { increment: 1 } },
      });
    }
    return { saved: true, revision: row.autosaveRevision, updatedAt: row.updatedAt.toISOString() };
  }

  async assist(
    userId: string,
    id: string,
    request: PersistentWorkspaceAssistRequest,
  ): Promise<PersistentWorkspaceAssistResponse> {
    const row = await this.requireOwned(userId, id);
    const history = fromJson<WorkspaceAssistantHistoryEntry[]>(row.assistantHistory, []).slice(-MAX_ASSISTANT_HISTORY);
    const sources = fromJson<WorkspaceSourceReference[]>(row.sources, []);
    const plan = fromJson<WorkspacePlanItem[]>(row.plan, []);
    const progress = fromJson<WorkspaceProgress>(row.progress, { completedSteps: [] });
    const brief = progress.workflow?.brief ?? emptyWorkspaceBrief();
    const template = row.template as WorkspaceTemplate;
    const definition = WORKSPACE_TEMPLATE_DEFINITIONS[template];
    const sourceContext = await this.sourceContext(userId, sources);
    const locale = await resolveLocale(this.prisma, userId);
    const userEntry: WorkspaceAssistantHistoryEntry = {
      id: randomUUID(), role: 'user', createdAt: new Date().toISOString(),
      content: request.message?.trim() || request.selectedText?.trim() || request.action,
    };
    const action = request.action.replace('-', ' ');
    const prompt = [
      `Action requested: ${action}.`,
      request.message?.trim() ? `Learner request: ${request.message.trim()}` : '',
      request.selectedText?.trim() ? `Selected passage:\n${request.selectedText.trim()}` : '',
      `Workspace type: ${template}.`,
      `Workspace objective: ${row.objective || 'Not specified'}.`,
      `Learner and institution brief:\n${this.briefContext(brief)}`,
      `Current plan:\n${plan.map((item) => `- [${item.completed ? 'x' : ' '}] ${item.title}`).join('\n') || 'No plan yet.'}`,
      `Current draft:\n${row.draftContent.slice(0, 12_000)}`,
      sourceContext ? `Available attributed sources:\n${sourceContext}` : 'No source content is available.',
    ].filter(Boolean).join('\n\n');
    const response = await this.llm.generate([
      {
        role: 'system',
        content: [
          'You are the contextual Second Brain academic assistant.',
          definition.assistantDirective,
          'The workspace template is only a starting scaffold.',
          'Within safety and academic-integrity rules, the learner instructions and their institution requirements are authoritative and take priority over the starting scaffold.',
          'Never erase or silently weaken explicit requirements, evaluation criteria, formatting rules, or delivery constraints.',
          'Help the learner understand, reason, structure, compare, verify or rephrase.',
          'Do not replace the learner or generate an entire thesis or assignment.',
          'Stay within the current workspace and distinguish sourced claims from suggestions.',
          'Never invent source locations or references.',
          localeDirective(locale),
        ].join(' '),
      },
      ...history.slice(-8).map((entry) => ({ role: entry.role, content: entry.content })),
      { role: 'user' as const, content: prompt },
    ], { temperature: 0.25, operation: 'workspace-assistant', maxOutputTokens: 1_500 });
    const reply: WorkspaceAssistantHistoryEntry = {
      id: randomUUID(), role: 'assistant', content: response.text.trim(), createdAt: new Date().toISOString(),
    };
    await this.prisma.academicWorkspace.update({
      where: { id },
      data: { assistantHistory: asJson([...history, userEntry, reply].slice(-MAX_ASSISTANT_HISTORY)) },
    });
    if (row.experienceSessionId) {
      await this.prisma.experienceSession.updateMany({ where: { id: row.experienceSessionId, userId }, data: { version: { increment: 1 } } });
    }
    return { reply };
  }

  private async sourceContext(userId: string, sources: WorkspaceSourceReference[]): Promise<string> {
    const ids = sources.filter((source) => source.kind === 'document').map((source) => source.id).slice(0, 5);
    const docs = ids.length ? await this.prisma.document.findMany({
      where: { id: { in: ids }, userId, deletedAt: null },
      select: { id: true, title: true, content: true },
    }) : [];
    const docText = docs.map((doc) => `[Document: ${doc.title}]\n${doc.content.slice(0, 2_000)}`);
    const researchText = sources.filter((source) => source.kind === 'research-source').slice(0, 3).map((source) =>
      `[Research: ${source.title ?? source.question ?? source.id}]\n${source.synthesis ?? ''}`,
    );
    return [...docText, ...researchText].join('\n\n').slice(0, MAX_SOURCE_CONTEXT_CHARS);
  }

  private normalizeSources(sources: WorkspaceSourceReference[]): WorkspaceSourceReference[] {
    const seen = new Set<string>();
    return sources.slice(0, 50).flatMap((source) => {
      if (!source || !['document', 'collection', 'research-source'].includes(source.kind) || typeof source.id !== 'string' || !source.id.trim()) return [];
      const key = `${source.kind}:${source.id.trim()}`;
      if (seen.has(key)) return [];
      seen.add(key);
      return [{
        kind: source.kind,
        id: source.id.trim(),
        ...(source.title?.trim() ? { title: source.title.trim().slice(0, 200) } : {}),
        ...(source.question?.trim() ? { question: source.question.trim().slice(0, 1_000) } : {}),
        ...(source.synthesis?.trim() ? { synthesis: source.synthesis.trim().slice(0, 30_000) } : {}),
        ...(source.citations ? { citations: source.citations.slice(0, 50) } : {}),
      }];
    });
  }

  private normalizePlan(plan: WorkspacePlanItem[]): WorkspacePlanItem[] {
    const seen = new Set<string>();
    return plan.slice(0, 100).flatMap((item, index) => {
      const title = item?.title?.trim();
      const id = item?.id?.trim() || randomUUID();
      if (!title || seen.has(id)) return [];
      seen.add(id);
      const stepId = item.stepId && WORKSPACE_STEP_IDS.includes(item.stepId) ? item.stepId : undefined;
      return [{
        id,
        title: title.slice(0, 200),
        order: index,
        completed: Boolean(item.completed),
        ...(stepId ? { stepId } : {}),
      }];
    });
  }

  private normalizeBrief(brief?: WorkspaceBrief): WorkspaceBrief {
    const fields: WorkspaceBrief['fields'] = {};
    if (!brief || typeof brief !== 'object' || !brief.fields || typeof brief.fields !== 'object') {
      return emptyWorkspaceBrief();
    }
    for (const field of WORKSPACE_BRIEF_FIELDS) {
      const value = brief.fields[field];
      if (typeof value !== 'string') continue;
      const normalized = value.trim().slice(0, 4_000);
      if (normalized) fields[field] = normalized;
    }
    return { version: 1, fields };
  }

  private briefContext(brief: WorkspaceBrief): string {
    const entries = WORKSPACE_BRIEF_FIELDS.flatMap((field) => {
      const value = brief.fields[field]?.trim();
      return value ? [`${field}: ${value}`] : [];
    });
    return entries.join('\n') || 'No additional brief was provided.';
  }

  private async assertOwnedSources(
    userId: string,
    sources: WorkspaceSourceReference[],
    db: PrismaService | Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    const documentIds = sources.filter((source) => source.kind === 'document').map((source) => source.id);
    const collectionIds = sources.filter((source) => source.kind === 'collection').map((source) => source.id);
    const researchIds = sources.filter((source) => source.kind === 'research-source').map((source) => source.id);
    const [documents, collections, research] = await Promise.all([
      documentIds.length ? db.document.count({ where: { id: { in: documentIds }, userId, deletedAt: null } }) : 0,
      collectionIds.length ? db.collection.count({ where: { id: { in: collectionIds }, userId } }) : 0,
      researchIds.length ? db.experienceSession.count({ where: { id: { in: researchIds }, userId, type: 'research' } }) : 0,
    ]);
    if (documents !== new Set(documentIds).size || collections !== new Set(collectionIds).size || research !== new Set(researchIds).size) {
      throw new BadRequestException('One or more workspace sources are unavailable.');
    }
  }

  private async syncExperience(row: AcademicWorkspace, requestedStatus?: WorkspaceProjectStatus): Promise<void> {
    if (!row.experienceSessionId) return;
    const plan = fromJson<WorkspacePlanItem[]>(row.plan, []);
    const completed = plan.filter((item) => item.completed).length;
    const next = plan.find((item) => !item.completed);
    const mappedStatus = requestedStatus === 'paused' ? 'paused'
      : requestedStatus === 'completed' ? 'completed'
        : requestedStatus === 'active' ? 'active' : undefined;
    await this.prisma.experienceSession.updateMany({
      where: { id: row.experienceSessionId, userId: row.userId },
      data: {
        title: row.title,
        intent: row.objective || null,
        currentStep: optionalJson(next ? { id: next.id, label: next.title, state: 'active' } : null),
        progress: asJson({ completed, total: plan.length, ...(plan.length ? { percent: Math.round((completed / plan.length) * 100) } : {}) }),
        ...(mappedStatus ? {
          status: mappedStatus,
          pausedAt: mappedStatus === 'paused' ? new Date() : null,
          completedAt: mappedStatus === 'completed' ? new Date() : null,
        } : {}),
        version: { increment: 1 },
      },
    });
  }

  private async requireOwned(userId: string, id: string): Promise<AcademicWorkspace> {
    const row = await this.prisma.academicWorkspace.findFirst({ where: { id, userId } });
    if (!row) throw new NotFoundException('Workspace not found.');
    return row;
  }

  private toView(row: AcademicWorkspace): PersistentWorkspace {
    const template = row.template as WorkspaceTemplate;
    const sources = fromJson<WorkspaceSourceReference[]>(row.sources, []);
    const plan = fromJson<WorkspacePlanItem[]>(row.plan, []);
    const progress = fromJson<WorkspaceProgress>(row.progress, { completedSteps: [] });
    const brief = progress.workflow?.brief ?? emptyWorkspaceBrief();
    return {
      id: row.id,
      userId: row.userId,
      title: row.title,
      template,
      objective: row.objective,
      dueAt: row.dueAt?.toISOString() ?? null,
      status: row.status as WorkspaceProjectStatus,
      mode: row.mode as PersistentWorkspace['mode'],
      context: createContext(row.userId, [{ id: `workspace:${row.id}`, kind: 'workspace', scope: 'active-object', referenceId: row.id, label: row.title, priority: 100, visibility: 'visible' }]),
      sources,
      plan,
      draft: {
        format: row.draftFormat as PersistentWorkspace['draft']['format'],
        content: row.draftContent,
        revision: row.autosaveRevision,
        updatedAt: row.updatedAt.toISOString(),
      },
      assistantHistory: fromJson(row.assistantHistory, []),
      brief,
      completionChecks: workspaceCompletionChecks({
        template,
        brief,
        plan,
        sources,
        draftContent: row.draftContent,
      }),
      progress,
      autosaveRevision: row.autosaveRevision,
      experienceSessionId: row.experienceSessionId,
      resumeTarget: fromJson(row.resumeTarget, { kind: 'workspace', id: row.id, path: `/library/workspace/${row.id}` }),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}

function asJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function optionalJson(value: unknown): Prisma.InputJsonValue | typeof Prisma.DbNull {
  return value === null || value === undefined ? Prisma.DbNull : asJson(value);
}

function fromJson<T>(value: Prisma.JsonValue, fallback: T): T {
  return value === null || value === undefined ? fallback : value as unknown as T;
}

function localizedDefaultWorkspacePlan(template: WorkspaceTemplate, locale: string): WorkspacePlanItem[] {
  const plan = workspaceDefaultPlan(template);
  if (!locale.toLowerCase().startsWith('fr')) return plan;
  const french: Record<NonNullable<WorkspacePlanItem['stepId']>, string> = {
    'frame-topic': 'Cadrer le sujet et le périmètre',
    'define-problem': 'Définir la problématique ou la question de recherche',
    'review-literature': 'Analyser la littérature et les sources',
    'design-method': 'Définir la méthodologie',
    'collect-evidence': 'Réunir les sources, données ou preuves',
    'analyze-evidence': 'Analyser les preuves',
    'build-outline': 'Construire le plan détaillé',
    draft: 'Rédiger le travail',
    review: 'Vérifier la cohérence et l’exactitude',
    'institution-check': 'Contrôler les consignes de l’établissement',
    defense: 'Préparer la soutenance',
    'analyze-prompt': 'Analyser les consignes',
    'build-argument': 'Construire l’argumentation',
    counterargument: 'Traiter les contre-arguments',
    findings: 'Présenter les résultats',
    recommendations: 'Formuler les recommandations',
    'executive-summary': 'Rédiger la synthèse exécutive',
    'target-publication': 'Définir le public ou la publication cible',
    'abstract-keywords': 'Préparer le résumé et les mots-clés',
    'submission-check': 'Effectuer les contrôles de remise',
    'rubric-check': 'Vérifier la grille d’évaluation',
    protocol: 'Définir le protocole de recherche',
    ethics: 'Vérifier l’éthique et la reproductibilité',
    'define-deliverable': 'Définir le livrable attendu',
    deliver: 'Préparer la livraison finale',
  };
  return plan.map((item) => item.stepId ? { ...item, title: french[item.stepId] } : item);
}
