import { createContext, useContext, useEffect, useMemo, useState, type Dispatch, type PropsWithChildren, type SetStateAction } from 'react';
import { useColorScheme } from 'react-native';
import type { Locale } from '../lib/i18n';

export interface AdminUiState {
  dark: boolean;
  locale: Locale;
  setDark: Dispatch<SetStateAction<boolean>>;
  setLocale: Dispatch<SetStateAction<Locale>>;
}

const AdminUiContext = createContext<AdminUiState | null>(null);

/**
 * Keeps UI-only preferences available to both public and protected routes.
 * Authentication, roles, and any server-authoritative state stay outside this
 * context. The browser effects are guarded so native rendering remains safe.
 */
export function AdminUiProvider({ children }: PropsWithChildren) {
  const systemTheme = useColorScheme();
  const [dark, setDark] = useState(systemTheme === 'dark');
  const [locale, setLocale] = useState<Locale>('en');

  useEffect(() => {
    if (typeof localStorage === 'undefined') return;
    setDark(localStorage.getItem('sb-admin-theme') === 'dark');
    setLocale(localStorage.getItem('sb-admin-locale') === 'fr' ? 'fr' : 'en');
  }, []);

  useEffect(() => {
    if (typeof localStorage !== 'undefined') localStorage.setItem('sb-admin-theme', dark ? 'dark' : 'light');
  }, [dark]);

  useEffect(() => {
    if (typeof localStorage !== 'undefined') localStorage.setItem('sb-admin-locale', locale);
    if (typeof document !== 'undefined') document.documentElement.lang = locale;
  }, [locale]);

  const value = useMemo<AdminUiState>(() => ({ dark, locale, setDark, setLocale }), [dark, locale]);
  return <AdminUiContext.Provider value={value}>{children}</AdminUiContext.Provider>;
}

/** Shared shell preferences, so protected pages react immediately to the header controls. */
export function useAdminUi(): AdminUiState {
  const value = useContext(AdminUiContext);
  if (!value) throw new Error('AdminUiProvider missing');
  return value;
}
