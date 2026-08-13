import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Token storage.
 *
 * AsyncStorage is used rather than expo-secure-store because the classroom must
 * run on web too (that is how it is verified here, and how it is demoed), and
 * SecureStore has no web implementation. On a real device build this should move
 * to SecureStore — the seam is this file, nothing else imports the backend.
 */
const ACCESS = 'sb.accessToken';
const REFRESH = 'sb.refreshToken';

export interface StoredSession {
  accessToken: string;
  refreshToken: string;
}

export async function loadSession(): Promise<StoredSession | null> {
  const [accessToken, refreshToken] = await Promise.all([
    AsyncStorage.getItem(ACCESS),
    AsyncStorage.getItem(REFRESH),
  ]);
  if (!accessToken || !refreshToken) return null;
  return { accessToken, refreshToken };
}

export async function saveSession(session: StoredSession): Promise<void> {
  await AsyncStorage.multiSet([
    [ACCESS, session.accessToken],
    [REFRESH, session.refreshToken],
  ]);
}

export async function clearSession(): Promise<void> {
  await AsyncStorage.multiRemove([ACCESS, REFRESH]);
}
