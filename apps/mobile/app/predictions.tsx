import { useCallback, useEffect, useState, useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { ReviewableKind, RevisionForecastView } from '@second-brain/shared';
import { api } from '../lib/client';
import { useTokens } from '../lib/design/theme';
import type { ColorScale } from '../lib/design/tokens';
import { useI18n, type TranslationKey } from '../lib/i18n';
import { Button, Card, ErrorBanner, Loading } from '../components/ui';

const KIND_ICON: Record<ReviewableKind, string> = {
  lesson: '📘',
  exercise: '✍️',
  quiz: '❓',
  language: '🗣️',
  practical: '🔬',
  homework: '📝',
  report: '🎓',
  flashcard: '🎴',
  concept: '🎯',
};

/**
 * Predictive Revision Engine (task 5.5). A layer above FSRS: FSRS says what's
 * due NOW; this anticipates — "in N days your recall of X will drop and your
 * forgetting will pass the threshold" — so the AI acts BEFORE it's forgotten.
 */
export default function PredictionsScreen() {
  const { colors: c } = useTokens();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { t, locale } = useI18n();
  const router = useRouter();
  const [data, setData] = useState<RevisionForecastView | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await api<RevisionForecastView>('/revision-engine/forecast'));
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
  if (!data) return <Loading label={t('pred.loading')} />;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.masthead}>
        <Text style={styles.kicker}>🔮 {t('pred.title')}</Text>
        <Text style={styles.intro}>{t('pred.intro')}</Text>
      </View>

      {/* FSRS vs Predictive — the contrast that IS this feature. */}
      <Card style={styles.contrast}>
        <Text style={styles.contrastLine}>🧮 {t('pred.fsrs')}</Text>
        <Text style={styles.contrastLineHi}>🔮 {t('pred.predictive')}</Text>
      </Card>

      {data.forecasts.length === 0 ? (
        <Text style={styles.empty}>{t('pred.empty')}</Text>
      ) : (
        data.forecasts.map((f) => (
          <View key={f.reviewableId} style={styles.card}>
            <Text style={styles.icon}>{KIND_ICON[f.kind]}</Text>
            <View style={styles.body}>
              <Text style={styles.title} numberOfLines={1}>
                {f.title}
              </Text>
              <Text style={styles.forecast}>
                {t('pred.in')} {daysLabel(f.daysUntil, t)}, {t('pred.forgettingPass')} {f.forgettingAt}%
              </Text>
              <Text style={styles.meta}>
                🧠 {f.currentMemory}% {t('pred.now')} · {formatDate(f.date, locale)}
              </Text>
            </View>
          </View>
        ))
      )}

      {data.forecasts.length > 0 ? (
        <Button label={t('pred.reviewAhead')} onPress={() => router.push('/revision-engine')} />
      ) : null}
      <Button variant="ghost" label={t('app.tryAgain')} onPress={() => void load()} />
    </ScrollView>
  );
}

function daysLabel(days: number, t: (k: TranslationKey) => string): string {
  if (days <= 0) return t('pred.today');
  if (days === 1) return t('pred.oneDay');
  return `${days} ${t('pred.days')}`;
}

function formatDate(date: string, locale: string): string {
  return new Date(date).toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

const makeStyles = (c: ColorScale) => StyleSheet.create({
  container: { padding: 20, gap: 12, maxWidth: 960, width: '100%', alignSelf: 'center' },
  masthead: { gap: 4 },
  kicker: { fontSize: 13, fontWeight: '700', color: c.primary, textTransform: 'uppercase', letterSpacing: 1.2 },
  intro: { fontSize: 15, color: c.textSecondary, lineHeight: 21 },
  contrast: { gap: 6 },
  contrastLine: { fontSize: 14, color: c.textSecondary, lineHeight: 20 },
  contrastLineHi: { fontSize: 14, color: c.textPrimary, fontWeight: '600', lineHeight: 20 },
  empty: { fontSize: 14, color: c.textSecondary },
  card: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    borderLeftWidth: 3,
    borderLeftColor: c.warning,
    borderRadius: 12,
    padding: 14,
  },
  icon: { fontSize: 22 },
  body: { flex: 1, gap: 3 },
  title: { fontSize: 15, fontWeight: '700', color: c.textPrimary },
  forecast: { fontSize: 15, color: c.textPrimary, lineHeight: 22, fontWeight: '500' },
  meta: { fontSize: 12, color: c.textSecondary },
});
