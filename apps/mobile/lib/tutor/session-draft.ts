import AsyncStorage from '@react-native-async-storage/async-storage';

const VERSION = 1 as const;
const PREFIX = 'sb.tutor.draft.v1';
const MAX_DRAFT_CHARS = 4_000;

export interface TutorSessionDraft {
  version: typeof VERSION;
  text: string;
  updatedAt: string;
}

function key(userId: string, sessionId: string): string {
  return `${PREFIX}.${userId}.${sessionId}`;
}

export async function loadTutorSessionDraft(
  userId: string,
  sessionId: string,
): Promise<TutorSessionDraft | null> {
  try {
    const raw = await AsyncStorage.getItem(key(userId, sessionId));
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<TutorSessionDraft>;
    if (value.version !== VERSION || typeof value.text !== 'string') return null;
    return {
      version: VERSION,
      text: value.text.slice(0, MAX_DRAFT_CHARS),
      updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : new Date(0).toISOString(),
    };
  } catch {
    return null;
  }
}

export async function saveTutorSessionDraft(
  userId: string,
  sessionId: string,
  text: string,
): Promise<void> {
  const value: TutorSessionDraft = {
    version: VERSION,
    text: text.slice(0, MAX_DRAFT_CHARS),
    updatedAt: new Date().toISOString(),
  };
  await AsyncStorage.setItem(key(userId, sessionId), JSON.stringify(value));
}

export async function clearTutorSessionDraft(
  userId: string,
  sessionId: string,
): Promise<void> {
  await AsyncStorage.removeItem(key(userId, sessionId));
}
