/** Provider-neutral external research contracts. No provider is selected here. */

export type ResearchAvailabilityStatus = 'available' | 'degraded' | 'unavailable';

export interface ResearchProviderCapabilities {
  webSearch: boolean;
  externalSearch: boolean;
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
  mode?: 'quick' | 'sourced' | 'deep';
  language?: string;
  publishedAfter?: string;
  publishedBefore?: string;
}

export type ResearchSourceQuality =
  | 'primary'
  | 'institutional'
  | 'academic'
  | 'reputable'
  | 'other';

export interface ExternalResearchSource {
  id: string;
  title: string;
  url: string;
  domain: string;
  provider: string;
  publishedAt: string | null;
  retrievedAt: string;
  snippet: string | null;
  rank: number;
  quality: ResearchSourceQuality;
  relevance: number | null;
  confidence: number | null;
}

export interface ResearchCitation {
  sourceId: string;
  title: string;
  url: string;
  domain: string;
  provider: string;
  excerpt?: string;
  publishedAt: string | null;
  retrievedAt: string;
  rank: number;
  quality: ResearchSourceQuality;
}

export interface ResearchProviderUsage {
  providerRequestId?: string | null;
  model?: string | null;
  inputTokens?: number | null;
  cachedInputTokens?: number | null;
  outputTokens?: number | null;
  searchUnits: number;
  unpricedUsageReason?: string | null;
}

export interface ResearchSearchResponse {
  query: string;
  sources: ExternalResearchSource[];
  citations: ResearchCitation[];
  provider: string | null;
  retrievedAt: string;
  usage?: ResearchProviderUsage;
}
