import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Insight, LearnerInsights } from '@second-brain/shared';
import { api } from '../lib/client';
import { theme } from '../lib/theme';
import { useI18n, type Locale, type TranslationKey } from '../lib/i18n';
import { Button, ErrorBanner, Loading } from '../components/ui';

const ICON: Record<Insight['kind'], string> = {
  strength: '🚀',
  forgetting: '⏳',
  atRisk: '⚠️',
  focusWindow: '🕐',
  accuracy: '🎯',
  rhythm: '📅',
  style: '🎨',
};

const RHYTHM_WORD: Record<NonNullable<Insight['rhythm']>, TranslationKey> = {
  occasional: 'insight.rhythm.occasional',
  regular: 'insight.rhythm.regular',
  intensive: 'insight.rhythm.intensive',
};
const STYLE_WORD: Record<NonNullable<Insight['style']>, TranslationKey> = {
  voice: 'insight.style.voice',
  handsOn: 'insight.style.handsOn',
  reading: 'insight.style.reading',
};

/**
 * AI Insights (task 4.6). Plain-language explanations of the AI's
 * recommendations — every line derived from real data, so the learner
 * understands WHY the AI proposes what it does.
 */
export default function InsightsScreen() {
  const { t, locale } = useI18n();
  const [data, setData] = useState<LearnerInsights | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await api<LearnerInsights>('/twin/insights'));
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
  if (!data) return <Loading label={t('insight.loading')} />;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.masthead}>
        <Text style={styles.kicker}>💡 {t('insight.title')}</Text>
        <Text style={styles.intro}>{t('insight.intro')}</Text>
      </View>

      {data.insights.length === 0 ? (
        <Text style={styles.empty}>{t('insight.empty')}</Text>
      ) : (
        data.insights.map((ins, i) => (
          <View key={i} style={styles.card}>
            <Text style={styles.icon}>{ICON[ins.kind]}</Text>
            <Text style={styles.text}>{describe(ins, t, locale)}</Text>
          </View>
        ))
      )}

      <Button variant="ghost" label={t('app.tryAgain')} onPress={() => void load()} />
    </ScrollView>
  );
}

/** Compose one insight into a natural sentence in the learner's language. */
function describe(ins: Insight, t: (k: TranslationKey) => string, locale: Locale): string {
  const hour = (h: number) => (locale === 'fr' ? `${h} h` : `${h}:00`);
  switch (ins.kind) {
    case 'strength':
      return `${t('insight.strengthA')} ${ins.concept} (${ins.percent} %).`;
    case 'forgetting':
      return `${t('insight.forgetA')} ${ins.concept} ${t('insight.forgetB')} ${ins.days} ${t('insight.days')}.`;
    case 'atRisk':
      return `${t('insight.atRiskA')} ${ins.concept} ${t('insight.atRiskB')}`;
    case 'focusWindow':
      return `${t('insight.focusA')} ${hour(ins.fromHour ?? 0)} ${t('insight.focusB')} ${hour(ins.toHour ?? 0)}.`;
    case 'accuracy':
      return `${t('insight.accA')} ${ins.percent} % ${t('insight.accB')}`;
    case 'rhythm':
      return `${t('insight.rhythmA')} ${t(RHYTHM_WORD[ins.rhythm ?? 'occasional'])} (${ins.count} ${t('insight.interactions')}).`;
    case 'style':
      return `${t('insight.styleA')} ${t(STYLE_WORD[ins.style ?? 'reading'])}.`;
    default:
      return '';
  }
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 12, maxWidth: 720, width: '100%', alignSelf: 'center' },
  masthead: { gap: 4 },
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
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 12,
    padding: 14,
  },
  icon: { fontSize: 24 },
  text: { flex: 1, fontSize: 15, color: theme.text, lineHeight: 22, fontWeight: '500' },
});
