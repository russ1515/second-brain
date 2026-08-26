import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import { useI18n } from '../../lib/i18n';

/**
 * Global App-Shell state (Desktop SaaS layout).
 *
 * The desktop sidebar can be expanded or collapsed. That single piece of state
 * is lifted here so BOTH the sidebar (which renders it) and the tabs layout
 * (which offsets the main workspace by the sidebar's width) stay in sync — the
 * main content always begins exactly where the sidebar ends, at either width.
 * The choice is persisted per browser so it survives navigation and reloads.
 */
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
      // storage unavailable (private mode) — default to expanded
    }
  }, []);

  const toggle = useCallback(() => {
    setCollapsed((v) => {
      const next = !v;
      if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
        try {
          localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
        } catch {
          // best-effort
        }
      }
      return next;
    });
  }, []);

  const value = useMemo(() => ({ collapsed, toggle, width: collapsed ? COLLAPSED : EXPANDED }), [collapsed, toggle]);
  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
}

export function useSidebar(): SidebarState {
  return useContext(SidebarContext);
}

/** Locales that lay the shell out right-to-left. */
const RTL_LOCALES = new Set(['ar', 'fa', 'he', 'ur']);
export function useIsRTL(): boolean {
  const { locale } = useI18n();
  return RTL_LOCALES.has(locale as string);
}
