import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type {
  InsightCategory,
  InsightCategoryKey,
  InsightsCenter,
} from '@second-brain/shared';
import { api } from '../lib/client';
import { theme } from '../lib/theme';
import { useI18n, type TranslationKey } from '../lib/i18n';
import { Button, Card, ErrorBanner, Loading } from '../components/ui';

const CAT_ICON: Record<InsightCategoryKey, string> = {
  strengths: '💪',
  weaknesses: '⚠️',
  progress: '📈',
  habits: '🕒',
  performance: '🎯',
  improvement: '🚀',
};

const CAT_KEY: Record<InsightCategoryKey, TranslationKey> = {
  strengths: 'ic.cat.strengths',
  weaknesses: 'ic.cat.weaknesses',
  progress: 'ic.cat.progress',
  habits: 'ic.cat.habits',
  performance: 'ic.cat.performance',
  improvement: 'ic.cat.improvement',
};

const CAT_COLOR: Record<InsightCategoryKey, string> = {
  strengths: theme.ok,
  weaknesses: theme.danger,
  progress: theme.accent,
  habits: theme.textMuted,
  performance: theme.accent,
  improvement: theme.warn,
};

/**
 * 🧠 AI Insights Center (Sprint 9.7). One hub where the learner discovers their
 * strengths, weaknesses, progress, habits, performance and areas to improve —
 * every finding explained. Composes the twin, the insights, the path and the
 * streak; the AI always says why.
 */
export default function InsightsCenterScreen() {
  const { t } = useI18n();
  const [data, setData] = useState<InsightsCenter | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await api<InsightsCenter>('/insights-center'));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (error && !data) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <ErrorBanner message={error} />
        <Button variant="ghost" label={t('app.tryAgain')} onPress={() => void load()} />
      </ScrollView>
    );
  }
  if (!data) return <Loading label={t('ic.loading')} />;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.masthead}>
        <Text style={styles.kicker}>🧠 {t('ic.title')}</Text>
        <Text style={styles.intro}>{t('ic.intro')}</Text>
      </View>

      {data.categories.map((c) => (
        <CategoryCard key={c.key} c={c} t={t} />
      ))}

      <Button variant="ghost" label={t('app.tryAgain')} onPress={() => void load()} />
    </ScrollView>
  );
}

function CategoryCard({ c, t }: { c: InsightCategory; t: (k: TranslationKey) => string }) {
  const color = CAT_COLOR[c.key];
  return (
    <Card style={StyleSheet.flatten([styles.card, { borderLeftColor: color }])} testID={`ic-${c.key}`}>
      <View style={styles.head}>
        <Text style={styles.icon}>{CAT_ICON[c.key]}</Text>
        <Text style={[styles.catTitle, { color }]}>{t(CAT_KEY[c.key])}</Text>
      </View>
      <Text style={styles.headline}>{c.headline}</Text>
      {c.items.map((it, i) => (
        <View key={i} style={styles.item}>
          <Text style={styles.itemTitle}>{it.title}</Text>
          <Text style={styles.itemDetail}>{it.detail}</Text>
        </View>
      ))}
    </Card>
  );
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
  card: { gap: 8, borderLeftWidth: 4 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: { fontSize: 20 },
  catTitle: { fontSize: 16, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
  headline: { fontSize: 15, color: theme.text, fontWeight: '600', lineHeight: 21 },
  item: {
    gap: 2,
    borderTopWidth: 1,
    borderTopColor: theme.border,
    paddingTop: 8,
  },
  itemTitle: { fontSize: 15, color: theme.text, fontWeight: '600' },
  itemDetail: { fontSize: 13, color: theme.textMuted, lineHeight: 19 },
});
