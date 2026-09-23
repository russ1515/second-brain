import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ReviewHomeView, ReviewSessionView } from '@second-brain/shared';

const HOME_PREFIX = 'sb.review-home-cache.v1';
const SESSION_PREFIX = 'sb.review-session-cache.v1';

export interface CachedReviewHome {
  value: ReviewHomeView;
  savedAt: string;
}

export interface CachedReviewSession {
  value: ReviewSessionView;
  savedAt: string;
}

export async function loadReviewHomeCache(userId: string, scope: string): Promise<CachedReviewHome | null> {
  return read(`${HOME_PREFIX}.${userId}.${encodeURIComponent(scope)}`);
}

export async function saveReviewHomeCache(userId: string, scope: string, value: ReviewHomeView): Promise<void> {
  await write(`${HOME_PREFIX}.${userId}.${encodeURIComponent(scope)}`, value);
}

export async function loadReviewSessionCache(userId: string, sessionId: string): Promise<CachedReviewSession | null> {
  return read(`${SESSION_PREFIX}.${userId}.${sessionId}`);
}

export async function saveReviewSessionCache(userId: string, value: ReviewSessionView): Promise<void> {
  await write(`${SESSION_PREFIX}.${userId}.${value.session.id}`, value);
}

async function read<T>(key: string): Promise<{ value: T; savedAt: string } | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { value?: T; savedAt?: string };
    return parsed.value && parsed.savedAt ? { value: parsed.value, savedAt: parsed.savedAt } : null;
  } catch {
    return null;
  }
}

async function write<T>(key: string, value: T): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify({ value, savedAt: new Date().toISOString() }));
}
