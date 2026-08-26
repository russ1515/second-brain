import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  isTwoFactorChallenge,
  type AuthResponse,
  type AuthUser,
  type LoginResponse,
  type OnboardingState,
} from '@second-brain/shared';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiError, api } from './client';
import { clearSession, loadSession, saveSession } from './storage';

/** Sync the UI's Learning Locale to the backend so deterministic AI content
 *  (coach, predictions, insights…) is generated in the learner's language.
 *  The picker persists it on change; this covers session start, when the
 *  stored locale would otherwise never reach `preferredLanguage`. Best-effort:
 *  a hiccup here never blocks auth. */
async function syncLocale(): Promise<void> {
  try {
    const loc = await AsyncStorage.getItem('sb.locale');
    if (loc) await api('/auth/locale', { method: 'PATCH', body: { locale: loc } });
  } catch {
    // best-effort
  }
}

interface AuthState {
  user: AuthUser | null;
  /** True until the stored session has been checked — don't flash the login
   *  screen at someone who is already signed in. */
  loading: boolean;
  /** We hold a session but could not reach the API to confirm it. The learner
   *  is NOT signed out; the classroom is simply unreachable right now. */
  offline: boolean;
  /** Whether the Universal KYC is done (UI/UX Sprint 2). `null` = unknown yet
   *  (still checking, or the check failed — the gate fails OPEN on null so an
   *  onboarding-status hiccup never traps the learner). */
  onboarded: boolean | null;
  /** Re-check onboarding status — called after the flow completes. */
  refreshOnboarding: () => Promise<void>;
  retry: () => void;
  register: (email: string, password: string, displayName?: string) => Promise<void>;
  /** Sign in. Returns a 2FA challenge instead of throwing when the account has
   *  two-step verification enabled, so the UI can collect the TOTP/recovery code. */
  login: (email: string, password: string) => Promise<LoginOutcome>;
  /** Complete a 2FA challenge with a TOTP or recovery code. */
  verifyTwoFactor: (challengeToken: string, code: string) => Promise<void>;
  logout: () => Promise<void>;
}

export type LoginOutcome = { status: 'ok' } | { status: '2fa'; challengeToken: string };

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [onboarded, setOnboarded] = useState<boolean | null>(null);
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => setAttempt((a) => a + 1), []);

  /** Read onboarding status AND refresh the in-memory user. Completing the KYC
   *  updates the Profile server-side (display name, preferred language); without
   *  re-reading `/auth/me` the dashboard would greet the learner with their
   *  register-time name until a reload. Both run in parallel; the user refetch
   *  is best-effort so a hiccup there never affects the onboarding gate. On any
   *  onboarding-status failure we leave it `null` — the gate treats null as
   *  "let them through" so a status hiccup never blocks the app. */
  const refreshOnboarding = useCallback(async () => {
    const [stateRes, meRes] = await Promise.allSettled([
      api<OnboardingState>('/onboarding'),
      api<AuthUser>('/auth/me'),
    ]);
    if (meRes.status === 'fulfilled') setUser(meRes.value);
    try {
      if (stateRes.status === 'rejected') throw stateRes.reason;
      setOnboarded(stateRes.value.status === 'completed');
    } catch {
      setOnboarded(null);
    }
  }, []);

  // Restore an existing session on boot. `/auth/me` is the honest check: it
  // proves the stored token still works rather than trusting its presence.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!cancelled) {
        setLoading(true);
        setOffline(false);
      }
      const session = await loadSession();
      if (!session) {
        if (!cancelled) setLoading(false);
        return;
      }
      try {
        const me = await api<AuthUser>('/auth/me');
        if (!cancelled) {
          setUser(me);
          setOffline(false);
          void syncLocale();
          void refreshOnboarding();
        }
      } catch (e) {
        // ONLY a rejected session logs the learner out. A network blip (API
        // restarting, laptop asleep, tunnel dropped) must not silently sign
        // them out and throw away their tokens — the client already retries a
        // 401 once behind a refresh, so reaching here with 401 means the
        // session really is gone.
        if (e instanceof ApiError && e.status === 401) {
          await clearSession();
        } else if (!cancelled) {
          // Session kept, API unreachable — say so instead of pretending they
          // are signed out and dumping them on the login screen.
          setOffline(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const accept = useCallback(async (res: AuthResponse) => {
    await saveSession({
      accessToken: res.tokens.accessToken,
      refreshToken: res.tokens.refreshToken,
    });
    setUser(res.user);
    void syncLocale();
  }, []);

  const register = useCallback(
    async (email: string, password: string, displayName?: string) => {
      const res = await api<AuthResponse>('/auth/register', {
        method: 'POST',
        anonymous: true,
        body: { email, password, ...(displayName ? { displayName } : {}) },
      });
      await accept(res);
      // A brand-new account has not done the KYC yet.
      setOnboarded(false);
    },
    [accept],
  );

  const login = useCallback(
    async (email: string, password: string): Promise<LoginOutcome> => {
      const res = await api<LoginResponse>('/auth/login', {
        method: 'POST',
        anonymous: true,
        body: { email, password },
      });
      // 2FA enabled: hand the challenge back so the UI can complete the second step.
      if (isTwoFactorChallenge(res)) {
        return { status: '2fa', challengeToken: res.challengeToken };
      }
      await accept(res);
      await refreshOnboarding();
      return { status: 'ok' };
    },
    [accept, refreshOnboarding],
  );

  const verifyTwoFactor = useCallback(
    async (challengeToken: string, code: string) => {
      const res = await api<AuthResponse>('/auth/2fa/verify', {
        method: 'POST',
        anonymous: true,
        body: { challengeToken, code },
      });
      await accept(res);
      await refreshOnboarding();
    },
    [accept, refreshOnboarding],
  );

  const logout = useCallback(async () => {
    const session = await loadSession();
    if (session) {
      await api('/auth/logout', {
        method: 'POST',
        anonymous: true,
        body: { refreshToken: session.refreshToken },
      }).catch(() => undefined); // logging out locally must always succeed
    }
    await clearSession();
    setUser(null);
    setOffline(false);
    setOnboarded(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      offline,
      onboarded,
      refreshOnboarding,
      retry,
      register,
      login,
      verifyTwoFactor,
      logout,
    }),
    [user, loading, offline, onboarded, refreshOnboarding, retry, register, login, verifyTwoFactor, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
