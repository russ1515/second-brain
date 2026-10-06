import type {
  ExternalResearchSource,
  ResearchProviderAvailability,
  ResearchProviderCapabilities,
  ResearchSearchRequest,
  ResearchSearchResponse,
} from '@second-brain/shared';

export const RESEARCH_PROVIDER = Symbol('RESEARCH_PROVIDER');
export const EXTERNAL_RESEARCH_PROVIDER = Symbol('EXTERNAL_RESEARCH_PROVIDER');

/** Replaceable server-side research seam. Provider credentials never cross it. */
export interface ResearchProvider {
  readonly name: string;
  readonly capabilities: ResearchProviderCapabilities;
  availability(): Promise<ResearchProviderAvailability>;
  search(request: ResearchSearchRequest): Promise<ResearchSearchResponse>;
  fetchSourceMetadata(sourceIdOrUrl: string): Promise<ExternalResearchSource | null>;
}
