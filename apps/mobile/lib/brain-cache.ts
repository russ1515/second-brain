import AsyncStorage from '@react-native-async-storage/async-storage';
import type { BrainGraphPage, BrainOverview } from '@second-brain/shared';

const PREFIX = 'sb.brain-cache.v1';

export interface BrainCacheEntry {
  overview: BrainOverview;
  graph: BrainGraphPage;
  savedAt: string;
}

function key(userId: string): string {
  return `${PREFIX}.${userId}`;
}

export async function loadBrainCache(userId: string): Promise<BrainCacheEntry | null> {
  try {
    const raw = await AsyncStorage.getItem(key(userId));
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<BrainCacheEntry>;
    if (!value.overview || !value.graph || !value.savedAt) return null;
    return value as BrainCacheEntry;
  } catch {
    return null;
  }
}

export async function saveBrainCache(userId: string, overview: BrainOverview, graph: BrainGraphPage): Promise<void> {
  await AsyncStorage.setItem(key(userId), JSON.stringify({ overview, graph, savedAt: new Date().toISOString() } satisfies BrainCacheEntry));
}
