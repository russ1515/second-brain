import AsyncStorage from '@react-native-async-storage/async-storage';
import type { LibraryDocument, LibraryFacets } from '@second-brain/shared';

const PREFIX = 'sb.library-cache.v1';

export interface LibraryCacheEntry {
  query: string;
  documents: LibraryDocument[];
  facets: LibraryFacets;
  nextCursor: string | null;
  savedAt: string;
}

function key(userId: string, query: string): string {
  return `${PREFIX}.${userId}.${encodeURIComponent(query)}`;
}

export async function loadLibraryCache(userId: string, query: string): Promise<LibraryCacheEntry | null> {
  try {
    const raw = await AsyncStorage.getItem(key(userId, query));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LibraryCacheEntry>;
    if (!Array.isArray(parsed.documents) || !parsed.facets || parsed.query !== query) return null;
    return parsed as LibraryCacheEntry;
  } catch {
    return null;
  }
}

export async function saveLibraryCache(
  userId: string,
  value: Omit<LibraryCacheEntry, 'savedAt'>,
): Promise<void> {
  const entry: LibraryCacheEntry = { ...value, savedAt: new Date().toISOString() };
  await AsyncStorage.setItem(key(userId, value.query), JSON.stringify(entry));
}
