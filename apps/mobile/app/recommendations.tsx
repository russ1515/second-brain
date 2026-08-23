import { useCallback, useEffect, useState, useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { ProactivePlan, ProactiveRecommendation } from '@second-brain/shared';
import { api } from '../lib/client';
import { useTokens } from '../lib/design/theme';
import type { ColorScale } from '../lib/design/tokens';
import { useI18n, type TranslationKey } from '../lib/i18n';
import { Button, ErrorBanner, Loading } from '../components/ui';

const ICON: Record<ProactiveRecommendation['kind'], string> = {
  review: '🔁',
  consolidate: '🧱',
  levelUp: '🎓',
  advance: '🚀',
};

/**
 * Proactive Recommendations (task 4.7) — the mentor. The AI doesn't just report
 * state; it tells the learner what to do next and gives a button to do it: a
 * timed revision, consolidating weak spots, or levelling up something mastered.
 */
export default function RecommendationsScreen() {
  const { colors: c } = useTokens();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { t } = useI18n();
  const router = useRouter();
  const [plan, setPlan] = useState<ProactivePlan | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setPlan(await api<ProactivePlan>('/twin/recommendations'));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (error && !plan) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <ErrorBanner message={error} />
        <Button variant="ghost" label={t('app.tryAgain')} onPress={() => void load()} />
      </ScrollView>
    );
  }
  if (!plan) return <Loading label={t('rec.loading')} />;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.masthead}>
        <Text style={styles.kicker}>🧭 {t('rec.title')}</Text>
        <Text style={styles.intro}>{t('rec.intro')}</Text>
      </View>

      {plan.recommendations.length === 0 ? (
        <Text style={styles.empty}>{t('rec.empty')}</Text>
      ) : (
        plan.recommendations.map((r, i) => (
          <View key={`${r.kind}-${i}`} style={styles.card}>
            <View style={styles.head}>
              <Text style={styles.icon}>{ICON[r.kind]}</Text>
              <Text style={styles.text}>{sentence(r, t)}</Text>
            </View>
            <Button label={t(CTA_KEY[r.kind])} onPress={() => act(r, router)} />
          </View>
        ))
      )}

      <Button variant="ghost" label={t('app.tryAgain')} onPress={() => void load()} />
    </ScrollView>
  );
}

const CTA_KEY: Record<ProactiveRecommendation['kind'], TranslationKey> = {
  review: 'rec.cta.review',
  consolidate: 'rec.cta.consolidate',
  levelUp: 'rec.cta.levelUp',
  advance: 'rec.cta.advance',
};

/** The action behind each recommendation — this is what makes the AI act. */
function act(r: ProactiveRecommendation, router: ReturnType<typeof useRouter>) {
  if (r.kind === 'review') {
    router.push('/revision');
  } else {
    // Consolidate / level up / advance all start a guided AI-Teacher session.
    router.push('/tutor');
  }
}

/** Fill the localized template for a recommendation. */
function sentence(r: ProactiveRecommendation, t: (k: TranslationKey) => string): string {
  const fill = (tpl: string) =>
    tpl
      .replace('{s}', r.subject ?? '')
      .replace('{m}', String(r.minutes ?? ''));
  switch (r.kind) {
    case 'review':
      return fill(t('rec.review'));
    case 'consolidate':
      return fill(t('rec.consolidate'));
    case 'levelUp':
      return fill(t('rec.levelUp'));
    case 'advance':
      return t('rec.advance');
  }
}

const makeStyles = (c: ColorScale) => StyleSheet.create({
  container: { padding: 20, gap: 12, maxWidth: 720, width: '100%', alignSelf: 'center' },
  masthead: { gap: 4, marginBottom: 2 },
  kicker: {
    fontSize: 13,
    fontWeight: '700',
    color: c.primary,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  intro: { fontSize: 15, color: c.textSecondary, lineHeight: 21 },
  empty: { fontSize: 14, color: c.textSecondary },
  card: {
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    borderLeftWidth: 3,
    borderLeftColor: c.primary,
    borderRadius: 12,
    padding: 14,
    gap: 12,
  },
  head: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  icon: { fontSize: 24 },
  text: { flex: 1, fontSize: 16, color: c.textPrimary, lineHeight: 23, fontWeight: '500' },
});
