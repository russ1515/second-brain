import type {
  ExternalResearchSource,
  ResearchProviderAvailability,
  ResearchProviderCapabilities,
  ResearchSearchRequest,
  ResearchSearchResponse,
} from '@second-brain/shared';

export const RESEARCH_PROVIDER = Symbol('RESEARCH_PROVIDER');

/** Replaceable external-search seam. Lot 0 intentionally registers no provider. */
export interface ResearchProvider {
  readonly name: string;
  readonly capabilities: ResearchProviderCapabilities;
  availability(): Promise<ResearchProviderAvailability>;
  search(request: ResearchSearchRequest): Promise<ResearchSearchResponse>;
  fetchSourceMetadata(sourceIdOrUrl: string): Promise<ExternalResearchSource | null>;
}
