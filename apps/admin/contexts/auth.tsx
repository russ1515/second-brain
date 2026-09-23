import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { api, restoreAccessToken, setAccessToken, type ApiProblem } from '../lib/api';

export interface AdminIdentity { userId: string; email: string; roles: string[]; capabilities: string[] }
interface AuthState {
  loading: boolean; identity: AdminIdentity | null; challenge: string | null; error: ApiProblem | null;
  login(email: string, password: string): Promise<void>; verify(code: string): Promise<void>; logout(): Promise<void>;
}
const Context = createContext<AuthState | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [loading, setLoading] = useState(true);
  const [identity, setIdentity] = useState<AdminIdentity | null>(null);
  const [challenge, setChallenge] = useState<string | null>(null);
  const [error, setError] = useState<ApiProblem | null>(null);

  async function loadSession() {
    const session = await api<{ identity: AdminIdentity }>('/admin/session');
    setIdentity(session.identity);
  }
  useEffect(() => {
    if (!restoreAccessToken()) { setLoading(false); return; }
    loadSession().catch((problem) => { setAccessToken(null); setError(problem); }).finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string) {
    setError(null); setLoading(true);
    try {
      const result = await api<any>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }, false);
      if (result.twoFactorRequired) { setChallenge(result.challengeToken); return; }
      setAccessToken(result.tokens.accessToken);
      await loadSession();
    } catch (problem) { setAccessToken(null); setError(problem as ApiProblem); throw problem; }
    finally { setLoading(false); }
  }
  async function verify(code: string) {
    if (!challenge) return;
    setError(null); setLoading(true);
    try {
      const result = await api<any>('/auth/2fa/verify', { method: 'POST', body: JSON.stringify({ challengeToken: challenge, code }) }, false);
      setAccessToken(result.tokens.accessToken); setChallenge(null); await loadSession();
    } catch (problem) { setError(problem as ApiProblem); throw problem; }
    finally { setLoading(false); }
  }
  async function logout() {
    try { await api('/auth/logout-all', { method: 'POST' }, false); }
    finally { setAccessToken(null); setIdentity(null); setChallenge(null); setError(null); }
  }
  const value = useMemo(() => ({ loading, identity, challenge, error, login, verify, logout }), [loading, identity, challenge, error]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useAuth(): AuthState {
  const value = useContext(Context);
  if (!value) throw new Error('AuthProvider missing');
  return value;
}
