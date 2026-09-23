/** Initial UX budgets. They are guardrails, not claims about current screens. */
export const PERFORMANCE_BUDGETS = {
  localVisibleInteractionMs: 100,
  cachedActionableP75Ms: 1_000,
  coldActionableP75Ms: 2_500,
  maxListPageSize: 50,
  defaultListPageSize: 20,
  maxContextItems: 32,
  maxContextSerializedChars: 32_768,
  maxSessionJsonCharsPerField: 64_000,
  maxSessionProductions: 50,
  maxSessionSourceReferences: 100,
} as const;

export type PerformanceBudgetKey = keyof typeof PERFORMANCE_BUDGETS;
