import { useCallback, useEffect, useState, useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { ConceptScore, StrengthsWeaknesses } from '@second-brain/shared';
import { api } from '../lib/client';
import { useTokens } from '../lib/design/theme';
import type { ColorScale } from '../lib/design/tokens';
import { useI18n, type TranslationKey } from '../lib/i18n';
import { Button, ErrorBanner, Loading } from '../components/ui';

/**
 * Strengths & Weaknesses (task 4.5). A clear split of what the learner is
 * strong at vs what is slipping — the same view the AI reads to personalise the
 * next sessions (the Session Orchestrator already targets the weakest first).
 */
export default function StrengthsScreen() {
  const { colors: c } = useTokens();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { t } = useI18n();
  const router = useRouter();
  // Both the 💪 and ⚠️ tiles land here; `focus` just scrolls attention.
  const { focus } = useLocalSearchParams<{ focus?: string }>();
  const [data, setData] = useState<StrengthsWeaknesses | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await api<StrengthsWeaknesses>('/twin/strengths'));
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
  if (!data) return <Loading label={t('sw.loading')} />;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.masthead}>
        <Text style={styles.kicker}>💪 {t('sw.title')}</Text>
        <Text style={styles.intro}>{t('sw.intro')}</Text>
      </View>

      <Section
        icon="💪"
        title={t('sw.strengths')}
        empty={t('sw.noStrengths')}
        emphasis={focus !== 'weaknesses'}
        items={data.strengths}
        color={c.success}
        t={t}
      />
      <Section
        icon="⚠️"
        title={t('sw.weaknesses')}
        empty={t('sw.noWeaknesses')}
        emphasis={focus === 'weaknesses'}
        items={data.weaknesses}
        color={c.warning}
        t={t}
      />

      {data.weaknesses.length > 0 ? (
        <View style={styles.aiNote}>
          <Text style={styles.aiNoteText}>🤖 {t('sw.aiNote')}</Text>
          <Button label={t('sw.startWeakest')} onPress={() => router.push('/tutor')} />
        </View>
      ) : null}

      <Button variant="ghost" label={t('app.tryAgain')} onPress={() => void load()} />
    </ScrollView>
  );
}

function Section({
  icon,
  title,
  empty,
  emphasis,
  items,
  color,
  t,
}: {
  icon: string;
  title: string;
  empty: string;
  emphasis: boolean;
  items: ConceptScore[];
  color: string;
  t: (k: TranslationKey) => string;
}) {
  const { colors: c } = useTokens();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <View style={[styles.section, emphasis && { borderColor: color }]}>
      <Text style={[styles.sectionTitle, { color }]}>
        {icon} {title}
      </Text>
      {items.length === 0 ? (
        <Text style={styles.empty}>{empty}</Text>
      ) : (
        items.map((c) => (
          <View key={c.conceptId} style={styles.row}>
            <Text style={styles.name} numberOfLines={1}>
              {c.name}
            </Text>
            <Text style={styles.stars}>
              {'★'.repeat(c.stars)}
              <Text style={styles.starsOff}>{'☆'.repeat(5 - c.stars)}</Text>
              <Text style={styles.pct}> {Math.round(c.mastery * 100)}%</Text>
            </Text>
          </View>
        ))
      )}
    </View>
  );
}

const makeStyles = (c: ColorScale) => StyleSheet.create({
  container: { padding: 20, gap: 14, maxWidth: 960, width: '100%', alignSelf: 'center' },
  masthead: { gap: 4 },
  kicker: {
    fontSize: 13,
    fontWeight: '700',
    color: c.primary,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  intro: { fontSize: 15, color: c.textSecondary, lineHeight: 21 },
  section: {
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 12,
    padding: 14,
    gap: 8,
  },
  sectionTitle: { fontSize: 17, fontWeight: '700' },
  empty: { fontSize: 14, color: c.textSecondary },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: c.border,
    paddingTop: 8,
  },
  name: { flex: 1, fontSize: 15, fontWeight: '600', color: c.textPrimary },
  stars: { fontSize: 14, color: c.warning, letterSpacing: 1 },
  starsOff: { color: c.border },
  pct: { fontSize: 12, color: c.textSecondary, letterSpacing: 0 },
  aiNote: {
    backgroundColor: c.surfaceElevated,
    borderRadius: 12,
    borderLeftWidth: 3,
    borderLeftColor: c.primary,
    padding: 14,
    gap: 10,
  },
  aiNoteText: { fontSize: 14, color: c.textPrimary, lineHeight: 21 },
});
