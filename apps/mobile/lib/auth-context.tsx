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
} from '@second-brain/shared';
import { ApiError, api } from './client';
import { clearSession, loadSession, saveSession } from './storage';

interface AuthState {
  user: AuthUser | null;
  /** True until the stored session has been checked — don't flash the login
   *  screen at someone who is already signed in. */
  loading: boolean;
  /** We hold a session but could not reach the API to confirm it. The learner
   *  is NOT signed out; the classroom is simply unreachable right now. */
  offline: boolean;
  retry: () => void;
  register: (email: string, password: string, displayName?: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => setAttempt((a) => a + 1), []);

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
  }, []);

  const register = useCallback(
    async (email: string, password: string, displayName?: string) => {
      const res = await api<AuthResponse>('/auth/register', {
        method: 'POST',
        anonymous: true,
        body: { email, password, ...(displayName ? { displayName } : {}) },
      });
      await accept(res);
    },
    [accept],
  );

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await api<LoginResponse>('/auth/login', {
        method: 'POST',
        anonymous: true,
        body: { email, password },
      });
      // 2FA is fully built in the API but has no screen yet; say so plainly
      // rather than silently failing to sign the learner in.
      if (isTwoFactorChallenge(res)) {
        throw new Error(
          'This account has two-factor authentication enabled, which the classroom cannot complete yet.',
        );
      }
      await accept(res);
    },
    [accept],
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
  }, []);

  const value = useMemo(
    () => ({ user, loading, offline, retry, register, login, logout }),
    [user, loading, offline, retry, register, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
