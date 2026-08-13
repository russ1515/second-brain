import { IsIn } from 'class-validator';

/** Learning Locale codes Second Brain ships UI translations for today. New codes
 *  are added here as translations land. */
export const SUPPORTED_LOCALES = ['en', 'fr'] as const;

export class SetLocaleDto {
  @IsIn(SUPPORTED_LOCALES as readonly string[])
  locale!: string;
}
