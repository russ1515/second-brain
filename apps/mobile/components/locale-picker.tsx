import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LanguageSelector } from './ds/language';
import { supportedLocaleCodes, useI18n } from '../lib/i18n';

const RECENT_UI_LANGUAGES_KEY = 'sb.locale.recent';
const MAX_RECENT_LANGUAGES = 4;

/**
 * Backward-compatible app-language entry point. Presentation comes from the
 * design-system selector; existing screens retain the LocalePicker API.
 */
export function LocalePicker({ label }: { label?: string }) {
  const { locale, setLocale, t } = useI18n();
  const [recentCodes, setRecentCodes] = useState<string[]>([]);

  useEffect(() => {
    void AsyncStorage.getItem(RECENT_UI_LANGUAGES_KEY).then((raw) => {
      if (!raw) return;
      try {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setRecentCodes(parsed.filter((code): code is string => typeof code === 'string').slice(0, MAX_RECENT_LANGUAGES));
        }
      } catch {
        // Corrupt optional history must never block language selection.
      }
    });
  }, []);

  const choose = useCallback((code: string) => {
    setLocale(code);
    setRecentCodes((current) => {
      const next = [code, ...current.filter((item) => item !== code)].slice(0, MAX_RECENT_LANGUAGES);
      void AsyncStorage.setItem(RECENT_UI_LANGUAGES_KEY, JSON.stringify(next));
      return next;
    });
  }, [setLocale]);

  return (
    <LanguageSelector
      mode="ui"
      label={label ?? t('app.language')}
      value={locale}
      codes={supportedLocaleCodes()}
      recentCodes={recentCodes}
      onChange={choose}
    />
  );
}
