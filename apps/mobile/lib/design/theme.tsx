import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { AccessibilityInfo, useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  aiGradient,
  borderWidth,
  darkColors,
  elevation,
  lightColors,
  motion,
  radius,
  spacing,
  typography,
  type ColorScale,
} from './tokens';

/**
 * Theme provider (UI/UX Sprint 1).
 *
 * Resolves the active colour scheme (light / dark / follow-system, persisted),
 * exposes every token through `useTokens()`, and surfaces the OS "reduce motion"
 * preference so the motion system can honour it. Components read tokens from
 * here — never hard-coded values — so light/dark and future theming are free.
 */
type Scheme = 'light' | 'dark' | 'system';
const STORAGE_KEY = 'sb.theme';

interface ThemeValue {
  /** The user's choice (may be 'system'). */
  scheme: Scheme;
  /** The concrete scheme in effect. */
  resolved: 'light' | 'dark';
  setScheme: (s: Scheme) => void;
  reducedMotion: boolean;
  colors: ColorScale;
  aiGradient: [string, string];
  spacing: typeof spacing;
  radius: typeof radius;
  borderWidth: typeof borderWidth;
  elevation: typeof elevation;
  typography: typeof typography;
  motion: typeof motion;
}

const ThemeContext = createContext<ThemeValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme(); // 'light' | 'dark' | null
  const [scheme, setSchemeState] = useState<Scheme>('system');
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    void (async () => {
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      if (saved === 'light' || saved === 'dark' || saved === 'system') setSchemeState(saved);
    })();
    AccessibilityInfo.isReduceMotionEnabled().then(setReducedMotion).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReducedMotion);
    return () => sub.remove();
  }, []);

  const setScheme = useCallback((s: Scheme) => {
    setSchemeState(s);
    void AsyncStorage.setItem(STORAGE_KEY, s);
  }, []);

  const resolved: 'light' | 'dark' = scheme === 'system' ? (system === 'dark' ? 'dark' : 'light') : scheme;

  const value = useMemo<ThemeValue>(
    () => ({
      scheme,
      resolved,
      setScheme,
      reducedMotion,
      colors: resolved === 'dark' ? darkColors : lightColors,
      aiGradient: resolved === 'dark' ? aiGradient.dark : aiGradient.light,
      spacing,
      radius,
      borderWidth,
      elevation,
      typography,
      motion,
    }),
    [scheme, resolved, setScheme, reducedMotion],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** Full theme (colours + all tokens + scheme controls + reduced motion). */
export function useTheme(): ThemeValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}

/** Shorthand for the token bundle most components need. */
export function useTokens() {
  const t = useTheme();
  return {
    colors: t.colors,
    spacing: t.spacing,
    radius: t.radius,
    borderWidth: t.borderWidth,
    elevation: t.elevation,
    typography: t.typography,
    motion: t.motion,
    aiGradient: t.aiGradient,
    reducedMotion: t.reducedMotion,
  };
}
