import { useCallback } from 'react';
import { useI18n, type TranslationKey } from './i18n';

export type RlleCopy = (key: string, values?: Record<string, string | number>) => string;

export function useRlleCopy(): { copy: RlleCopy; locale: string } {
  const { locale, t } = useI18n();
  const copy = useCallback<RlleCopy>((key, values = {}) => {
    let result = t(key as TranslationKey);
    for (const [name, value] of Object.entries(values)) {
      result = result.replaceAll(`{${name}}`, String(value));
    }
    return result;
  }, [t]);
  return { copy, locale };
}
