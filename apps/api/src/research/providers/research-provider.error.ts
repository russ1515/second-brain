/** Stable, provider-neutral errors exposed to the Research orchestrator. */
export class ResearchProviderError extends Error {
  constructor(
    readonly code:
      | 'NO_PROVIDER'
      | 'PROVIDER_TIMEOUT'
      | 'RATE_LIMIT'
      | 'NO_RESULTS'
      | 'SOURCE_FETCH_ERROR',
    readonly status: number,
  ) {
    super(code);
    this.name = 'ResearchProviderError';
  }
}
