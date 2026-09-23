/** Provider-neutral external research contracts. No provider is selected here. */

export type ResearchAvailabilityStatus = 'available' | 'degraded' | 'unavailable';

export interface ResearchProviderCapabilities {
  webSearch: boolean;
  sourceMetadata: boolean;
  dateFiltering: boolean;
  languageFiltering: boolean;
}

export interface ResearchProviderAvailability {
  status: ResearchAvailabilityStatus;
  checkedAt: string;
  reasonCode?: string;
  capabilities: ResearchProviderCapabilities;
}

export interface ResearchSearchRequest {
  query: string;
  maxResults: number;
  language?: string;
  publishedAfter?: string;
  publishedBefore?: string;
}

export interface ExternalResearchSource {
  id: string;
  title: string;
  url: string;
  provider: string;
  publishedAt: string | null;
  snippet: string | null;
  relevance: number | null;
  confidence: number | null;
}

export interface ResearchCitation {
  sourceId: string;
  title: string;
  url: string;
  provider: string;
  excerpt?: string;
  publishedAt: string | null;
}

export interface ResearchSearchResponse {
  query: string;
  sources: ExternalResearchSource[];
  citations: ResearchCitation[];
  provider: string | null;
}
