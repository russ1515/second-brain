import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import type {
  RecommendationFeed,
  ResourceKind,
  ResourceRecommendation,
} from '@second-brain/shared';
import { api } from '../lib/client';
import { theme } from '../lib/theme';
import { useI18n, type TranslationKey } from '../lib/i18n';
import { Button, ErrorBanner, Loading } from '../components/ui';

const KIND_ICON: Record<ResourceKind, string> = {
  lesson: '📘',
  exercise: '✍️',
  reading: '📖',
  review: '🎴',
  practical: '🔬',
  document: '📄',
};

const KIND_KEY: Record<ResourceKind, TranslationKey> = {
  lesson: 'reco.kind.lesson',
  exercise: 'reco.kind.exercise',
  reading: 'reco.kind.reading',
  review: 'reco.kind.review',
  practical: 'reco.kind.practical',
  document: 'reco.kind.document',
};

/**
 * ✨ Recommendation Engine (Sprint 9.4). A personalized feed of resources the AI
 * proposes — lessons, exercises, readings, reviews, practicals, documents — each
 * explaining why. The learner accepts (which opens it) or dismisses; their
 * decision is recorded and kept distinct from the AI's suggestion.
 */
export default function ForYouScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const [feed, setFeed] = useState<ResourceRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api<RecommendationFeed>('/recommendations');
      setFeed(res.recommendations);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const respond = async (
    rec: ResourceRecommendation,
    action: 'accept' | 'dismiss',
  ) => {
    setFeed((prev) => prev.filter((r) => r.id !== rec.id));
    try {
      await api(`/recommendations/${rec.id}/${action}`, { method: 'POST' });
    } catch {
      // Best-effort: the card is already gone from the UI.
    }
    if (action === 'accept') openTarget(rec, router);
  };

  if (error && feed.length === 0) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <ErrorBanner message={error} />
        <Button variant="ghost" label={t('app.tryAgain')} onPress={() => void load()} />
      </ScrollView>
    );
  }
  if (loading) return <Loading label={t('reco.loading')} />;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.masthead}>
        <Text style={styles.kicker}>✨ {t('reco.title')}</Text>
        <Text style={styles.intro}>{t('reco.intro')}</Text>
      </View>

      {feed.length === 0 ? (
        <Text style={styles.empty}>{t('reco.empty')}</Text>
      ) : (
        feed.map((r) => (
          <View key={r.id} style={styles.card} testID={`reco-${r.kind}`}>
            <View style={styles.head}>
              <Text style={styles.icon}>{KIND_ICON[r.kind]}</Text>
              <View style={styles.headText}>
                <Text style={styles.kindLabel}>{t(KIND_KEY[r.kind])}</Text>
                <Text style={styles.title}>{r.title}</Text>
              </View>
            </View>
            <Text style={styles.reason}>{r.reason}</Text>
            <View style={styles.actions}>
              <View style={styles.flex}>
                <Button label={t('reco.accept')} onPress={() => void respond(r, 'accept')} />
              </View>
              <Button
                variant="ghost"
                label={t('reco.dismiss')}
                onPress={() => void respond(r, 'dismiss')}
              />
            </View>
          </View>
        ))
      )}

      <Button variant="ghost" label={t('app.tryAgain')} onPress={() => void load()} />
    </ScrollView>
  );
}

/** Accepting a recommendation opens the resource it points to. */
function openTarget(rec: ResourceRecommendation, router: ReturnType<typeof useRouter>) {
  if (!rec.target) return;
  if (rec.target.kind === 'route') {
    router.push(rec.target.id as never);
  } else if (rec.target.kind === 'document') {
    router.push('/library');
  } else {
    // concept → the guided path is the best entry point to work on it.
    router.push('/adaptive-path');
  }
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 12, maxWidth: 720, width: '100%', alignSelf: 'center' },
  masthead: { gap: 4, marginBottom: 2 },
  kicker: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.accent,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  intro: { fontSize: 15, color: theme.textMuted, lineHeight: 21 },
  empty: { fontSize: 14, color: theme.textMuted },
  card: {
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    borderLeftWidth: 3,
    borderLeftColor: theme.accent,
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  head: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  icon: { fontSize: 24 },
  headText: { flex: 1, gap: 2 },
  kindLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.textFaint,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  title: { fontSize: 16, fontWeight: '700', color: theme.text, lineHeight: 22 },
  reason: { fontSize: 14, color: theme.textMuted, lineHeight: 20 },
  actions: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  flex: { flex: 1 },
});
