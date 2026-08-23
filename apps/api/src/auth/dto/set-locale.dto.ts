import { IsIn } from 'class-validator';
import { SUPPORTED_LANGUAGE_CODES } from '@second-brain/shared';

/** Learning Locale codes Second Brain supports (the shared 25+ registry). The UI
 *  ships full translations for some and falls back to English for the rest, but
 *  the AI Professor teaches in ANY of them — so all are accepted here. */
export const SUPPORTED_LOCALES = SUPPORTED_LANGUAGE_CODES;

export class SetLocaleDto {
  @IsIn(SUPPORTED_LOCALES as readonly string[])
  locale!: string;
}
