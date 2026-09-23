import { BadRequestException, Inject, Injectable, Logger, Optional } from '@nestjs/common';
import type {
  BrainSearchResult,
  ResearchAvailabilityResponse,
  ResearchComparison,
  ResearchResult,
  ResearchRunRequest,
  ResearchScope,
  UnifiedResearchCitation,
} from '@second-brain/shared';
import {
  isExternalResearchScope,
  RESEARCH_SCOPE_KINDS,
  researchScopeToRag,
  researchSourceLimit,
} from '@second-brain/shared';
import { BrainService } from '../brain/brain.service';
import { localeDirective, resolveLocale } from '../common/learning-locale';
import { RetrievalService } from '../documents/retrieval/retrieval.service';
import { LlmService } from '../llm/llm.service';
import { PrismaService } from '../prisma/prisma.service';
import { RESEARCH_PROVIDER, type ResearchProvider } from './research-provider.interface';
import { ProviderMeteringService } from '../usage/provider-metering.service';

const MAX_SOURCE_EXCERPT = 1_200;
const EXTERNAL_QUERY_LIMIT = 16;

@Injectable()
export class ResearchService {
  private readonly logger = new Logger(ResearchService.name);

  constructor(
    private readonly retrieval: RetrievalService,
    private readonly brain: BrainService,
    private readonly llm: LlmService,
    private readonly prisma: PrismaService,
    @Inject(RESEARCH_PROVIDER) private readonly provider: ResearchProvider,
    @Optional() private readonly metering?: ProviderMeteringService,
  ) {}

  async availability(): Promise<ResearchAvailabilityResponse> {
    return {
      internal: { brain: true, library: true, documents: true, collection: true },
      external: await this.provider.availability(),
    };
  }

  async run(userId: string, request: ResearchRunRequest): Promise<ResearchResult> {
    const question = request.question.trim();
    const scopes = this.normalizeScopes(request.scopes);
    const sourceLimit = researchSourceLimit(request.depth);
    const availability = await this.provider.availability();
    const limits: string[] = [];
    let partial = false;
    const citations: UnifiedResearchCitation[] = [];

    for (const scope of scopes) {
      if (scope.kind === 'brain') {
        const page = await this.brain.search(userId, question, Math.min(sourceLimit, 12));
        citations.push(...page.items.map((item) => this.brainCitation(item)));
        continue;
      }
      if (isExternalResearchScope(scope)) {
        if (availability.status !== 'available' || !availability.capabilities.webSearch) {
          partial = true;
          limits.push('research.provider.notConfigured');
          continue;
        }
        const searchRequest = {
          query: question,
          maxResults: Math.min(sourceLimit, EXTERNAL_QUERY_LIMIT),
        };
        const response = await (this.metering?.executeWithAttempts(
          {
            provider: this.provider.name,
            feature: scope.kind === 'web' ? 'WEB_SEARCH' : 'DEEP_RESEARCH',
            resource: scope.kind === 'web' ? 'WEB_SEARCH' : 'DEEP_RESEARCH',
            units: 1,
            metadata: { sourceLimit: searchRequest.maxResults, scope: scope.kind },
            // Current contract exposes source results, not provider billing units.
            measure: () => ({ searchUnits: 1, measurementSource: 'OBSERVED' }),
          },
          (attempts) => attempts.attempt(() => this.provider.search(searchRequest)),
        ) ?? this.provider.search(searchRequest));
        citations.push(...response.sources.map((source) => ({
          id: `external:${source.id}`,
          kind: scope.kind === 'web' ? ('web' as const) : ('external' as const),
          title: source.title,
          excerpt: source.snippet?.slice(0, MAX_SOURCE_EXCERPT) ?? null,
          url: source.url,
          provider: source.provider,
          publishedAt: source.publishedAt,
          relevance: source.relevance,
        })));
        continue;
      }
      const ragScope = researchScopeToRag(scope);
      if (!ragScope) continue;
      const documentIds = await this.retrieval.resolveScope(userId, ragScope);
      const response = await this.retrieval.search(userId, question, {
        limit: sourceLimit,
        ...(documentIds ? { documentIds } : {}),
      });
      citations.push(...response.results.map((item) => ({
        id: `document:${item.documentId}:${item.chunkIndex}`,
        kind: 'document' as const,
        title: item.documentTitle,
        excerpt: item.content.slice(0, MAX_SOURCE_EXCERPT),
        documentId: item.documentId,
        chunkIndex: item.chunkIndex,
        relevance: item.score,
      })));
    }

    const bounded = deduplicateCitations(citations).slice(0, sourceLimit);
    if (bounded.length === 0) {
      return {
        question,
        depth: request.depth,
        scopes,
        synthesis: '',
        sections: [],
        keyPoints: [],
        comparison: null,
        citations: [],
        limits: [...new Set([...limits, 'research.sources.none'])],
        stages: [],
        partial,
        provider: availability.status === 'available' ? this.provider.name : null,
        generatedAt: new Date().toISOString(),
      };
    }

    const generated = await this.synthesize(userId, question, request.depth, bounded);
    const comparison = request.depth === 'quick' ? null : generated.comparison;
    const stages: ResearchResult['stages'] = [
      { kind: 'sources-found', completed: true, itemCount: bounded.length },
      { kind: 'sources-read', completed: true, itemCount: bounded.length },
      ...(comparison ? [{ kind: 'compared' as const, completed: true as const, itemCount: bounded.length }] : []),
      { kind: 'synthesized', completed: true },
    ];
    return {
      question,
      depth: request.depth,
      scopes,
      synthesis: generated.synthesis,
      sections: generated.sections,
      keyPoints: generated.keyPoints,
      comparison,
      citations: bounded,
      limits: [...new Set(limits)],
      stages,
      partial,
      provider: availability.status === 'available' ? this.provider.name : null,
      generatedAt: new Date().toISOString(),
    };
  }

  private normalizeScopes(scopes: ResearchScope[]): ResearchScope[] {
    const normalized = scopes.slice(0, 4).map((scope) => {
      if (!scope || !RESEARCH_SCOPE_KINDS.includes(scope.kind)) {
        throw new BadRequestException('Unknown research scope.');
      }
      if (scope.kind === 'documents') {
        const documentIds = [...new Set(scope.documentIds ?? [])].filter((id) => typeof id === 'string' && id.length > 0).slice(0, 20);
        if (documentIds.length === 0) throw new BadRequestException('Select at least one document.');
        return { kind: scope.kind, documentIds };
      }
      if (scope.kind === 'collection' && !scope.collectionId?.trim()) {
        throw new BadRequestException('Select a collection.');
      }
      return scope.kind === 'collection'
        ? { kind: scope.kind, collectionId: scope.collectionId!.trim() }
        : { kind: scope.kind };
    });
    const seen = new Set<string>();
    return normalized.filter((scope) => {
      const key = `${scope.kind}:${scope.collectionId ?? ''}:${scope.documentIds?.join(',') ?? ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private brainCitation(item: BrainSearchResult): UnifiedResearchCitation {
    return {
      id: `brain:${item.kind}:${item.id}`,
      kind: 'brain',
      title: item.title,
      excerpt: item.detail?.slice(0, MAX_SOURCE_EXCERPT) ?? null,
      ...(item.kind === 'concept' ? { conceptId: item.id } : {}),
      ...(item.kind === 'document' ? { documentId: item.id } : {}),
    };
  }

  private async synthesize(
    userId: string,
    question: string,
    depth: ResearchRunRequest['depth'],
    citations: UnifiedResearchCitation[],
  ): Promise<{
    synthesis: string;
    sections: ResearchResult['sections'];
    keyPoints: string[];
    comparison: ResearchComparison | null;
  }> {
    const locale = await resolveLocale(this.prisma, userId);
    const evidence = citations.map((citation) =>
      `[${citation.id}] ${citation.kind.toUpperCase()} — ${citation.title}\n${citation.excerpt || citation.title}`,
    ).join('\n\n');
    const depthInstruction = depth === 'quick'
      ? 'Give a concise answer. Keep sections and comparison empty.'
      : depth === 'deep'
        ? 'Produce a structured, nuanced synthesis. Explicitly surface agreements, divergences, specificities and limitations.'
        : 'Produce a sourced analysis with key points and useful sections.';
    const system = [
      'You are Second Brain Research. Use ONLY the evidence supplied.',
      'Never invent a citation, source, consensus, page or section.',
      'When evidence is insufficient, state the limitation.',
      'Return ONLY valid JSON with: synthesis (string), keyPoints (string[]),',
      'sections ({title, body, citationIds:string[]}[]), and comparison',
      '({agreements:string[], divergences:string[], specificities:string[]} or null).',
      'Every citationIds value must be one of the bracketed ids in the evidence.',
      depthInstruction,
      localeDirective(locale),
    ].join(' ');
    try {
      const response = await this.llm.generate([
        { role: 'system', content: system },
        { role: 'user', content: `Question: ${question}\n\nEvidence:\n${evidence}` },
      ], {
        temperature: 0.15,
        operation: depth === 'deep' ? 'deep-research' : 'research',
        maxOutputTokens: depth === 'deep' ? 3_000 : 1_800,
      });
      return normalizeGeneratedResearch(response.text, new Set(citations.map((citation) => citation.id)));
    } catch (error) {
      this.logger.error('Research synthesis failed.');
      throw error;
    }
  }
}

function deduplicateCitations(items: UnifiedResearchCitation[]): UnifiedResearchCitation[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function normalizeGeneratedResearch(raw: string, allowedIds: Set<string>): {
  synthesis: string;
  sections: ResearchResult['sections'];
  keyPoints: string[];
  comparison: ResearchComparison | null;
} {
  const parsed = parseObject(raw);
  if (!parsed) return { synthesis: raw.trim(), sections: [], keyPoints: [], comparison: null };
  const strings = (value: unknown, max = 12) => Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean).slice(0, max)
    : [];
  const sections = Array.isArray(parsed.sections) ? parsed.sections.flatMap((value, index) => {
    if (!value || typeof value !== 'object') return [];
    const row = value as Record<string, unknown>;
    const title = typeof row.title === 'string' ? row.title.trim() : '';
    const body = typeof row.body === 'string' ? row.body.trim() : '';
    if (!title || !body) return [];
    return [{ id: `section-${index + 1}`, title, body, citationIds: strings(row.citationIds, 20).filter((id) => allowedIds.has(id)) }];
  }).slice(0, 12) : [];
  const cmp = parsed.comparison && typeof parsed.comparison === 'object'
    ? parsed.comparison as Record<string, unknown>
    : null;
  const comparison = cmp ? {
    agreements: strings(cmp.agreements),
    divergences: strings(cmp.divergences),
    specificities: strings(cmp.specificities),
  } : null;
  const usefulComparison = comparison && Object.values(comparison).some((items) => items.length > 0) ? comparison : null;
  return {
    synthesis: typeof parsed.synthesis === 'string' ? parsed.synthesis.trim() : '',
    sections,
    keyPoints: strings(parsed.keyPoints),
    comparison: usefulComparison,
  };
}

function parseObject(raw: string): Record<string, unknown> | null {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try {
    const value = JSON.parse(cleaned) as unknown;
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
  } catch {
    return null;
  }
}
