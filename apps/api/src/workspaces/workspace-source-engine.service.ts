import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type {
  ResearchResult,
  UnifiedResearchCitation,
  WorkspaceSourceCitation,
  WorkspaceSourceQueryRequest,
  WorkspaceSourceQueryResponse,
  WorkspaceSourceReference,
  WorkspaceSourceState,
} from '@second-brain/shared';
import { BrainService } from '../brain/brain.service';
import { RetrievalService } from '../documents/retrieval/retrieval.service';
import { PrismaService } from '../prisma/prisma.service';
import { ResearchService } from '../research/research.service';

const DEFAULT_RESULT_LIMIT = 10;
const MAX_RESULT_LIMIT = 20;
const MAX_SNIPPET_CHARS = 1_200;
const MAX_CONTEXT_CHARS = 12_000;

type CitationCandidate = Omit<WorkspaceSourceCitation, 'citationLabel'> & {
  relevance?: number | null;
  order: number;
};

export interface WorkspaceSourceResolution extends WorkspaceSourceQueryResponse {
  /** Internal, prompt-safe evidence block. It is never accepted from a client. */
  context: string;
}

/**
 * A thin Workspace facade over the existing document, Brain and Research
 * engines. It resolves every source from an authenticated id and never accepts
 * source content, citations or provenance from the client.
 */
@Injectable()
export class WorkspaceSourceEngineService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly retrieval: RetrievalService,
    private readonly brain: BrainService,
    private readonly research: ResearchService,
  ) {}

  async query(
    userId: string,
    workspaceId: string,
    request: WorkspaceSourceQueryRequest,
  ): Promise<WorkspaceSourceResolution> {
    const workspace = await this.prisma.academicWorkspace.findFirst({
      where: { id: workspaceId, userId },
      select: { sources: true },
    });
    if (!workspace) throw new NotFoundException('Workspace not found.');
    return this.resolve(userId, readSourceReferences(workspace.sources), request);
  }

  async resolve(
    userId: string,
    sourceReferences: readonly WorkspaceSourceReference[],
    request: WorkspaceSourceQueryRequest,
  ): Promise<WorkspaceSourceResolution> {
    const query = request.query.trim().slice(0, 2_000);
    const limit = Math.min(Math.max(Math.trunc(request.limit ?? DEFAULT_RESULT_LIMIT), 1), MAX_RESULT_LIMIT);
    const references = normalizeReferences(sourceReferences);
    const documentRefs = references.filter((source) => source.kind === 'document');
    const collectionRefs = references.filter((source) => source.kind === 'collection');
    const researchRefs = references.filter((source) => source.kind === 'research-source');
    const brainRefs = references.filter((source) => source.kind === 'brain');

    const [documents, collections, researchResults, brainPage] = await Promise.all([
      this.resolveDocuments(userId, documentRefs),
      this.resolveCollections(userId, collectionRefs),
      Promise.all(researchRefs.map(async (source) => ({
        source,
        result: await this.research.loadWorkspaceSource(userId, source.id).catch(() => null),
      }))),
      brainRefs.length > 0 && query.length >= 2
        ? this.brain.search(userId, query, limit).catch(() => ({ items: [], nextCursor: null }))
        : Promise.resolve({ items: [], nextCursor: null }),
    ]);

    const sourceStates: WorkspaceSourceState[] = [
      ...documents.states,
      ...collections.states,
      ...researchResults.map(({ source, result }) => researchSourceState(source, result)),
      ...brainRefs.map((source) => ({
        kind: 'brain' as const,
        id: source.id,
        title: source.title?.trim() || 'My Brain',
        availability: source.id === 'brain' ? 'available' as const : 'unavailable' as const,
        ...(source.id === 'brain' ? {} : { reason: 'invalid' as const }),
      })),
    ];

    const allowedDocumentIds = [...new Set([...documents.retrievableIds, ...collections.retrievableIds])];
    const documentResults = query.length >= 2 && allowedDocumentIds.length > 0
      ? (await this.retrieval.search(userId, query, { limit, documentIds: allowedDocumentIds })).results
      : [];
    const researchDocumentIds = [...new Set(researchResults.flatMap(({ result }) => result
      ? result.citations.flatMap((citation) => citation.kind === 'document' && citation.documentId ? [citation.documentId] : [])
      : []))];
    const currentResearchDocuments = researchDocumentIds.length > 0
      ? await this.prisma.document.findMany({
        where: {
          userId,
          id: { in: researchDocumentIds },
          deletedAt: null,
          status: { in: ['ready', 'partial'] },
        },
        select: { id: true },
      })
      : [];
    const currentResearchDocumentIds = new Set(currentResearchDocuments.map((document) => document.id));

    let order = 0;
    const candidates: CitationCandidate[] = [
      ...documentResults.map((result): CitationCandidate => ({
        sourceType: 'document',
        sourceId: result.documentId,
        documentId: result.documentId,
        title: result.documentTitle,
        ...(result.pageNumber ? { page: result.pageNumber } : {}),
        chunkIndex: result.chunkIndex,
        snippet: boundSnippet(result.content),
        relevance: result.score,
        order: order++,
      })),
      ...researchResults.flatMap(({ result }) => result
        ? result.citations
          .filter((citation) => citation.kind !== 'document'
            || Boolean(citation.documentId && currentResearchDocumentIds.has(citation.documentId)))
          .flatMap((citation) => {
            const candidate = researchCitationCandidate(citation, order++);
            return candidate ? [candidate] : [];
          })
        : []),
      ...brainPage.items.map((item): CitationCandidate => ({
        sourceType: 'brain',
        sourceId: item.id,
        ...(item.kind === 'concept' ? { conceptId: item.id } : {}),
        ...(item.kind === 'document' ? { documentId: item.id } : {}),
        title: item.title,
        snippet: boundSnippet(item.detail || item.title),
        relevance: null,
        order: order++,
      })),
    ];

    const selected = balanceCandidates(deduplicateCandidates(candidates), limit)
      .map(({ order: _order, ...citation }, index): WorkspaceSourceCitation => ({
        ...citation,
        citationLabel: `W${index + 1}`,
      }));
    const evidence = buildEvidenceContext(selected);
    return {
      query,
      usedContext: evidence.citations.length > 0,
      citations: evidence.citations,
      sources: sourceStates,
      context: evidence.context,
    };
  }

  /** Remove invented labels and expose only citations actually referenced. */
  validateReply(
    rawReply: string,
    available: readonly WorkspaceSourceCitation[],
  ): { content: string; citations: WorkspaceSourceCitation[] } {
    const byLabel = new Map(available.map((citation) => [citation.citationLabel, citation]));
    const used = new Set<string>();
    const content = rawReply.replace(/\[([^\]\n]{1,80})\]/g, (match, rawLabel: string) => {
      const label = rawLabel.trim();
      if (!/^W\d+$/.test(label)) return match;
      if (!byLabel.has(label)) return '';
      used.add(label);
      return `[${label}]`;
    }).trim();
    return {
      content,
      citations: available.filter((citation) => used.has(citation.citationLabel)),
    };
  }

  private async resolveDocuments(
    userId: string,
    references: readonly WorkspaceSourceReference[],
  ): Promise<{ states: WorkspaceSourceState[]; retrievableIds: string[] }> {
    if (references.length === 0) return { states: [], retrievableIds: [] };
    const rows = await this.prisma.document.findMany({
      where: { userId, id: { in: references.map((source) => source.id) } },
      select: { id: true, title: true, status: true, deletedAt: true },
    });
    const byId = new Map(rows.map((row) => [row.id, row]));
    const states = references.map((source): WorkspaceSourceState => {
      const row = byId.get(source.id);
      if (!row) return unavailableState(source);
      if (row.deletedAt) return { kind: source.kind, id: source.id, title: row.title, availability: 'unavailable', reason: 'deleted' };
      if (row.status === 'pending' || row.status === 'processing') {
        return { kind: source.kind, id: source.id, title: row.title, availability: 'processing', reason: 'processing' };
      }
      if (row.status === 'failed') return { kind: source.kind, id: source.id, title: row.title, availability: 'unavailable', reason: 'invalid' };
      return { kind: source.kind, id: source.id, title: row.title, availability: 'available' };
    });
    return {
      states,
      retrievableIds: rows
        .filter((row) => !row.deletedAt && (row.status === 'ready' || row.status === 'partial'))
        .map((row) => row.id),
    };
  }

  private async resolveCollections(
    userId: string,
    references: readonly WorkspaceSourceReference[],
  ): Promise<{ states: WorkspaceSourceState[]; retrievableIds: string[] }> {
    if (references.length === 0) return { states: [], retrievableIds: [] };
    const rows = await this.prisma.collection.findMany({
      where: { userId, id: { in: references.map((source) => source.id) } },
      select: {
        id: true,
        name: true,
        documents: {
          where: { userId, deletedAt: null },
          select: { id: true, status: true },
        },
      },
    });
    const byId = new Map(rows.map((row) => [row.id, row]));
    const states = references.map((source): WorkspaceSourceState => {
      const row = byId.get(source.id);
      if (!row) return unavailableState(source);
      const ready = row.documents.some((document) => document.status === 'ready' || document.status === 'partial');
      const processing = row.documents.some((document) => document.status === 'pending' || document.status === 'processing');
      if (!ready && processing) return { kind: source.kind, id: source.id, title: row.name, availability: 'processing', reason: 'processing' };
      if (!ready && row.documents.length === 0) return { kind: source.kind, id: source.id, title: row.name, availability: 'unavailable', reason: 'empty' };
      if (!ready) return { kind: source.kind, id: source.id, title: row.name, availability: 'unavailable', reason: 'invalid' };
      return { kind: source.kind, id: source.id, title: row.name, availability: 'available' };
    });
    return {
      states,
      retrievableIds: rows.flatMap((row) => row.documents
        .filter((document) => document.status === 'ready' || document.status === 'partial')
        .map((document) => document.id)),
    };
  }
}

function researchCitationCandidate(citation: UnifiedResearchCitation, order: number): CitationCandidate | null {
  const snippet = boundSnippet(citation.excerpt ?? '');
  if (!snippet) return null;
  return {
    sourceType: citation.kind === 'document' ? 'document' : citation.kind,
    sourceId: citation.documentId ?? citation.conceptId ?? citation.url ?? citation.id,
    ...(citation.documentId ? { documentId: citation.documentId } : {}),
    ...(citation.conceptId ? { conceptId: citation.conceptId } : {}),
    title: citation.title,
    ...(citation.chunkIndex !== undefined ? { chunkIndex: citation.chunkIndex } : {}),
    ...(citation.pageNumber !== undefined ? { page: citation.pageNumber } : {}),
    ...(citation.url ? { url: citation.url } : {}),
    ...(citation.retrievedAt ? { retrievedAt: citation.retrievedAt } : {}),
    snippet,
    relevance: citation.relevance,
    order,
  };
}

function researchSourceState(
  source: WorkspaceSourceReference,
  result: ResearchResult | null,
): WorkspaceSourceState {
  return result
    ? { kind: source.kind, id: source.id, title: result.question, availability: 'available' }
    : unavailableState(source, 'legacy-unverified');
}

function unavailableState(
  source: WorkspaceSourceReference,
  reason: WorkspaceSourceState['reason'] = 'invalid',
): WorkspaceSourceState {
  return {
    kind: source.kind,
    id: source.id,
    title: source.title?.trim() || source.id,
    availability: 'unavailable',
    reason,
  };
}

function normalizeReferences(sources: readonly WorkspaceSourceReference[]): WorkspaceSourceReference[] {
  const seen = new Set<string>();
  return sources.slice(0, 50).flatMap((source) => {
    if (!source || !['document', 'collection', 'research-source', 'brain'].includes(source.kind)) return [];
    const id = typeof source.id === 'string' ? source.id.trim() : '';
    if (!id) return [];
    const key = `${source.kind}:${id}`;
    if (seen.has(key)) return [];
    seen.add(key);
    return [{ kind: source.kind, id }];
  });
}

function readSourceReferences(value: Prisma.JsonValue): WorkspaceSourceReference[] {
  return Array.isArray(value) ? normalizeReferences(value as unknown as WorkspaceSourceReference[]) : [];
}

function boundSnippet(value: string): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, MAX_SNIPPET_CHARS);
}

function deduplicateCandidates(candidates: readonly CitationCandidate[]): CitationCandidate[] {
  const seen = new Set<string>();
  return candidates.filter((citation) => {
    const key = [citation.sourceType, citation.sourceId, citation.documentId, citation.chunkIndex, citation.url, citation.snippet].join(':');
    if (seen.has(key)) return false;
    seen.add(key);
    return Boolean(citation.snippet);
  });
}

function balanceCandidates(candidates: readonly CitationCandidate[], limit: number): CitationCandidate[] {
  const ranked = [...candidates].sort((left, right) => {
    const score = (right.relevance ?? -1) - (left.relevance ?? -1);
    return score || left.order - right.order;
  });
  const firstBySource: CitationCandidate[] = [];
  const represented = new Set<string>();
  for (const citation of ranked) {
    const key = `${citation.sourceType}:${citation.sourceId}`;
    if (represented.has(key)) continue;
    represented.add(key);
    firstBySource.push(citation);
  }
  const selected = new Set(firstBySource.map((citation) => citation));
  return [...firstBySource, ...ranked.filter((citation) => !selected.has(citation))].slice(0, limit);
}

function buildEvidenceContext(
  citations: readonly WorkspaceSourceCitation[],
): { context: string; citations: WorkspaceSourceCitation[] } {
  let context = '';
  const included: WorkspaceSourceCitation[] = [];
  for (const citation of citations) {
    const block = [
      `<workspace-evidence label="${citation.citationLabel}" source-type="${citation.sourceType}">`,
      `Title: ${escapeEvidence(citation.title)}`,
      citation.page ? `Page: ${citation.page}` : '',
      citation.url ? `URL: ${escapeEvidence(citation.url)}` : '',
      `Passage: ${escapeEvidence(citation.snippet)}`,
      '</workspace-evidence>',
    ].filter(Boolean).join('\n');
    if (context.length + block.length + 2 > MAX_CONTEXT_CHARS) break;
    context += `${context ? '\n\n' : ''}${block}`;
    included.push(citation);
  }
  return { context, citations: included };
}

function escapeEvidence(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
