import { ServiceUnavailableException } from '@nestjs/common';
import type {
  ExternalResearchSource,
  ResearchProviderAvailability,
  ResearchProviderCapabilities,
  ResearchSearchRequest,
  ResearchSearchResponse,
} from '@second-brain/shared';
import type { ResearchProvider } from '../research-provider.interface';

/**
 * Deterministic no-network provider for contract tests and disabled deployments.
 * It is not registered as an external search implementation.
 */
export class DisabledResearchProvider implements ResearchProvider {
  readonly name = 'disabled';
  readonly capabilities: ResearchProviderCapabilities = {
    webSearch: false,
    sourceMetadata: false,
    dateFiltering: false,
    languageFiltering: false,
  };

  async availability(): Promise<ResearchProviderAvailability> {
    return {
      status: 'unavailable',
      checkedAt: new Date().toISOString(),
      reasonCode: 'research.provider.not_configured',
      capabilities: this.capabilities,
    };
  }

  async search(_request: ResearchSearchRequest): Promise<ResearchSearchResponse> {
    throw new ServiceUnavailableException({
      error: 'research_provider_unavailable',
      messageCode: 'research.provider.notConfigured',
    });
  }

  async fetchSourceMetadata(_sourceIdOrUrl: string): Promise<ExternalResearchSource | null> {
    return null;
  }
}
