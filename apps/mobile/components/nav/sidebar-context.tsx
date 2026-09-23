import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import { useI18n } from '../../lib/i18n';

const STORAGE_KEY = 'sb.sidebar.collapsed';
const EXPANDED = 232;
const COLLAPSED = 68;

type SidebarState = { collapsed: boolean; toggle: () => void; width: number };
const SidebarContext = createContext<SidebarState>({ collapsed: false, toggle: () => {}, width: EXPANDED });

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof localStorage === 'undefined') return;
    try {
      if (localStorage.getItem(STORAGE_KEY) === '1') setCollapsed(true);
    } catch {
      // Storage can be unavailable in private browsing; expanded remains safe.
    }
  }, []);

  const toggle = useCallback(() => {
    setCollapsed((value) => {
      const next = !value;
      if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
        try {
          localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
        } catch {
          // Best-effort preference only.
        }
      }
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ collapsed, toggle, width: collapsed ? COLLAPSED : EXPANDED }),
    [collapsed, toggle],
  );
  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
}

export function useSidebar(): SidebarState {
  return useContext(SidebarContext);
}

const RTL_LOCALES = new Set(['ar', 'fa', 'he', 'ur']);
export function useIsRTL(): boolean {
  const { locale } = useI18n();
  return RTL_LOCALES.has(locale as string);
}
