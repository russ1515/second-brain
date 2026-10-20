import { ServiceUnavailableException } from '@nestjs/common';

/** Fixed technical identifiers only. Never attach provider output, answers,
 * tokens, database errors or arbitrary exception prose to this contract. */
export const LANGUAGE_PLACEMENT_FAILURE_CODES = [
  'PLACEMENT_PROVIDER_UNAVAILABLE',
  'PLACEMENT_RESULT_JSON_INVALID',
  'PLACEMENT_RESULT_STRUCTURE_INVALID',
  'PLACEMENT_RESULT_QUESTION_IDS_INVALID',
  'PLACEMENT_RESULT_SKILL_INVALID',
  'PLACEMENT_RESULT_CEFR_INVALID',
  'PLACEMENT_RESULT_CEFR_ABOVE_CEILING',
  'PLACEMENT_RESULT_REASON_INVALID',
  'PLACEMENT_RESULT_EVIDENCE_INVALID',
  'PLACEMENT_RESULT_SCORE_INVALID',
  'PLACEMENT_RESULT_VERDICT_INVALID',
  'PLACEMENT_CANONICAL_EVIDENCE_INVALID',
  'PLACEMENT_PERSISTENCE_FAILED',
  'PLACEMENT_LEVEL_MAPPING_FAILED',
  'PLACEMENT_PASSPORT_WRITE_FAILED',
  'PLACEMENT_STATE_CONFLICT',
  'PLACEMENT_UNKNOWN_RUNTIME_ERROR',
] as const;

export type LanguagePlacementFailureCode = (typeof LANGUAGE_PLACEMENT_FAILURE_CODES)[number];
export type LanguagePlacementFailureStage = 'provider' | 'parser' | 'validation' | 'persistence' | 'mapping' | 'state' | 'runtime';

export class PlacementRuntimeException extends ServiceUnavailableException {
  readonly code: LanguagePlacementFailureCode;
  readonly stage: LanguagePlacementFailureStage;

  constructor(code: LanguagePlacementFailureCode) {
    // Runtime allowlisting also protects JS callers and future unsafe casts.
    const safe = (LANGUAGE_PLACEMENT_FAILURE_CODES as readonly unknown[]).includes(code)
      ? code : 'PLACEMENT_UNKNOWN_RUNTIME_ERROR';
    const stage = stageFor(safe);
    super({ code: safe, stage, message: 'Language placement could not be completed. Your diagnostic is preserved.' });
    this.code = safe;
    this.stage = stage;
  }
}

function stageFor(code: LanguagePlacementFailureCode): LanguagePlacementFailureStage {
  if (code === 'PLACEMENT_PROVIDER_UNAVAILABLE') return 'provider';
  if (code === 'PLACEMENT_RESULT_JSON_INVALID' || code === 'PLACEMENT_RESULT_STRUCTURE_INVALID'
    || code === 'PLACEMENT_RESULT_QUESTION_IDS_INVALID') return 'parser';
  if (code === 'PLACEMENT_PERSISTENCE_FAILED' || code === 'PLACEMENT_PASSPORT_WRITE_FAILED') return 'persistence';
  if (code === 'PLACEMENT_LEVEL_MAPPING_FAILED') return 'mapping';
  if (code === 'PLACEMENT_STATE_CONFLICT') return 'state';
  if (code === 'PLACEMENT_UNKNOWN_RUNTIME_ERROR') return 'runtime';
  return 'validation';
}
