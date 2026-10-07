import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearOfflineLearningState } from './offline';
import { queryClient } from './query';

/**
 * Remove only learner-owned pedagogical state after the server has confirmed a
 * reset. Auth tokens, cached identity, UI locale and theme are deliberately not
 * matched by this list.
 */
export async function clearLocalLearningState(userId: string): Promise<void> {
  const exact = new Set([
    `sb.learn.composer.v1.${userId}`,
    `sb.brain-cache.v1.${userId}`,
    `sb.active-language.v1.${userId}`,
    `sb.recent-languages.v1.${userId}`,
  ]);
  const prefixes = [
    `sb.tutor.draft.v1.${userId}.`,
    `sb.library-cache.v1.${userId}.`,
    `sb.review-home-cache.v1.${userId}.`,
    `sb.review-session-cache.v1.${userId}.`,
  ];

  try {
    const keys = (await AsyncStorage.getAllKeys()).filter((key) =>
      exact.has(key) || prefixes.some((prefix) => key.startsWith(prefix)),
    );
    if (keys.length) await AsyncStorage.multiRemove(keys);
    await clearOfflineLearningState();
  } finally {
    // In-memory queries can otherwise repaint a deleted Home/Brain/Library view
    // before onboarding navigation completes.
    queryClient.clear();
  }
}
