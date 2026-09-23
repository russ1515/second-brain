import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, type ContextItem, type ContextItemInput, type LearnDepth, type LearnIntent } from '@second-brain/shared';

const VERSION = 1 as const;
const PREFIX = 'sb.learn.composer.v1';

export interface LearnDraftAttachment {
  uri: string;
  name: string;
  mimeType: string;
  size: number | null;
}

export interface LearnComposerDraft {
  version: typeof VERSION;
  text: string;
  selectedIntent: LearnIntent | null;
  depth: LearnDepth;
  contexts: ContextItem[];
  attachment: LearnDraftAttachment | null;
  updatedAt: string;
}

function key(userId: string): string {
  return `${PREFIX}.${userId}`;
}

export async function loadLearnDraft(userId: string): Promise<LearnComposerDraft | null> {
  try {
    const raw = await AsyncStorage.getItem(key(userId));
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<LearnComposerDraft>;
    if (value.version !== VERSION || typeof value.text !== 'string') return null;
    const contexts = Array.isArray(value.contexts)
      ? createContext(userId, value.contexts.slice(0, 5) as ContextItemInput[]).items
      : [];
    return {
      version: VERSION,
      text: value.text.slice(0, 20_000),
      selectedIntent: isIntent(value.selectedIntent) ? value.selectedIntent : null,
      depth: value.depth === 'quick' || value.depth === 'deep' ? value.depth : 'standard',
      contexts,
      attachment: isAttachment(value.attachment) ? value.attachment : null,
      updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : new Date(0).toISOString(),
    };
  } catch {
    return null;
  }
}

export async function saveLearnDraft(userId: string, draft: Omit<LearnComposerDraft, 'version' | 'updatedAt'>): Promise<void> {
  const value: LearnComposerDraft = {
    version: VERSION,
    text: draft.text.slice(0, 20_000),
    selectedIntent: draft.selectedIntent,
    depth: draft.depth,
    contexts: draft.contexts.slice(0, 5),
    attachment: draft.attachment,
    updatedAt: new Date().toISOString(),
  };
  await AsyncStorage.setItem(key(userId), JSON.stringify(value));
}

export async function clearLearnDraft(userId: string): Promise<void> {
  await AsyncStorage.removeItem(key(userId));
}

function isIntent(value: unknown): value is LearnIntent {
  return value === 'understand' || value === 'learn' || value === 'practice' || value === 'research' || value === 'create';
}

function isAttachment(value: unknown): value is LearnDraftAttachment {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<LearnDraftAttachment>;
  return typeof candidate.uri === 'string' && candidate.uri.length <= 10_000
    && typeof candidate.name === 'string' && candidate.name.length <= 500
    && typeof candidate.mimeType === 'string' && candidate.mimeType.length <= 200
    && (candidate.size === null || (typeof candidate.size === 'number' && candidate.size >= 0));
}
