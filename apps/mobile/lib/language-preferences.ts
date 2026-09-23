import AsyncStorage from '@react-native-async-storage/async-storage';

const ACTIVE_LANGUAGE_PREFIX = 'sb.active-language.v1';
const RECENT_LANGUAGE_PREFIX = 'sb.recent-languages.v1';
const MAX_RECENT = 5;

function key(prefix: string, userId: string): string {
  return `${prefix}.${userId}`;
}

export async function loadActiveLanguage(userId: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(key(ACTIVE_LANGUAGE_PREFIX, userId));
  } catch {
    return null;
  }
}

export async function saveActiveLanguage(userId: string, profileId: string): Promise<void> {
  await AsyncStorage.setItem(key(ACTIVE_LANGUAGE_PREFIX, userId), profileId);
}

export async function loadRecentLanguageCodes(userId: string): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(key(RECENT_LANGUAGE_PREFIX, userId));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string').slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

export async function rememberLanguageCode(userId: string, code: string): Promise<void> {
  const previous = await loadRecentLanguageCodes(userId);
  const next = [code, ...previous.filter((value) => value !== code)].slice(0, MAX_RECENT);
  await AsyncStorage.setItem(key(RECENT_LANGUAGE_PREFIX, userId), JSON.stringify(next));
}
