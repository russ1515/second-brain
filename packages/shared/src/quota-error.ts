/** Stable quota error payload. Existing `error` and `metric` keys are retained. */
export interface QuotaErrorContract {
  error: 'quota_exceeded';
  /** Compatibility alias used by existing clients. */
  metric: string;
  quotaType: string;
  used: number;
  limit: number;
  remaining: number;
  resetAt: string | null;
  feature: string;
  availableFeatures: string[];
  retryAfter: number | null;
  managementDestination: string;
  upgradePossible: boolean | null;
  messageCode: string;
  /** Compatibility copy. New clients should localize `messageCode`. */
  message: string;
}

export interface CreateQuotaErrorInput {
  quotaType: string;
  used: number;
  limit: number;
  resetAt?: string | null;
  feature: string;
  availableFeatures?: string[];
  retryAfter?: number | null;
  managementDestination?: string;
  upgradePossible?: boolean | null;
  messageCode?: string;
  message?: string;
}

export function createQuotaError(input: CreateQuotaErrorInput): QuotaErrorContract {
  return {
    error: 'quota_exceeded',
    metric: input.quotaType,
    quotaType: input.quotaType,
    used: input.used,
    limit: input.limit,
    remaining: Math.max(0, input.limit - input.used),
    resetAt: input.resetAt ?? null,
    feature: input.feature,
    availableFeatures: [...(input.availableFeatures ?? [])],
    retryAfter: input.retryAfter ?? null,
    managementDestination: input.managementDestination ?? '/usage',
    upgradePossible: input.upgradePossible ?? null,
    messageCode: input.messageCode ?? 'usage.quotaExceeded',
    message:
      input.message ??
      `You have reached your ${input.quotaType.replaceAll('_', ' ')} limit for this plan.`,
  };
}

export function isQuotaError(value: unknown): value is QuotaErrorContract {
  return (
    !!value &&
    typeof value === 'object' &&
    (value as { error?: unknown }).error === 'quota_exceeded'
  );
}
