import { IsIn } from 'class-validator';
import { SUPPORTED_LANGUAGE_CODES } from '@second-brain/shared';

/** Locale codes Second Brain supports (the shared registry). The learner UI
 * only offers codes backed by a concrete catalog; the API still validates
 * against the complete cross-product registry used by learning experiences. */
export const SUPPORTED_LOCALES = SUPPORTED_LANGUAGE_CODES;

export class SetLocaleDto {
  @IsIn(SUPPORTED_LOCALES as readonly string[])
  locale!: string;
}
