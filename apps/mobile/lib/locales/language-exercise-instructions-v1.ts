import { LANGUAGE_EXERCISE_INSTRUCTION_COPY, SUPPORTED_LANGUAGE_CODES } from '@second-brain/shared';
import { extendLocale } from '../i18n';

/** One shared source: the API resolves the same support-language templates.
 * This is an overlay of the existing registry, not another locale engine. */
export const languageExerciseInstructionKeys = Object.keys(LANGUAGE_EXERCISE_INSTRUCTION_COPY.en)
  .map((key) => `languageInstruction.${key}`);
for (const code of SUPPORTED_LANGUAGE_CODES) {
  extendLocale(code, Object.fromEntries(Object.entries(LANGUAGE_EXERCISE_INSTRUCTION_COPY[code])
    .map(([key, value]) => [`languageInstruction.${key}`, value])));
}
