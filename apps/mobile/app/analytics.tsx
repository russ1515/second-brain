import { useCallback, useState, useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import type { AnalyticsOverview } from '@second-brain/shared';
import { api } from '../lib/client';
import { useTokens } from '../lib/design/theme';
import type { ColorScale } from '../lib/design/tokens';
import { useI18n, type TranslationKey } from '../lib/i18n';
import { Card, ErrorBanner, Loading } from '../components/ui';

/** Analytics & BI (Sprint 8.6) — platform indicators. Admin-only (server-gated). */
export default function AnalyticsScreen() {
  const { colors: c } = useTokens();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { t } = useI18n();
  const [data, setData] = useState<AnalyticsOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await api<AnalyticsOverview>('/admin/analytics'));
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  if (!data && !error) return <Loading />;

  const pct = (n: number) => `${Math.round(n * 100)}%`;
  const money = (c: number) => `$${(c / 100).toFixed(0)}`;
  const hours = (m: number) => (m >= 60 ? `${(m / 60).toFixed(1)} h` : `${m} min`);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.h1}>{t('an.title')}</Text>
      <Text style={styles.intro}>{t('an.intro')}</Text>
      {error ? <ErrorBanner message={error} /> : null}

      {data ? (
        <>
          <Text style={styles.section}>{t('an.active')}</Text>
          <View style={styles.grid}>
            <Stat label="DAU" value={String(data.activeUsers.dau)} />
            <Stat label="WAU" value={String(data.activeUsers.wau)} />
            <Stat label="MAU" value={String(data.activeUsers.mau)} />
            <Stat label={t('an.stickiness')} value={pct(data.stickiness)} />
            <Stat label={t('an.retention')} value={pct(data.retention7d)} />
            <Stat label={t('an.newUsers')} value={String(data.newUsers7d)} />
          </View>

          <Text style={styles.section}>{t('an.business')}</Text>
          <View style={styles.grid}>
            <Stat label={t('an.revenue')} value={money(data.revenue)} />
            <Stat label={t('an.conversion')} value={pct(data.conversionRate)} />
            <Stat label={t('an.paid')} value={String(data.paidUsers)} />
          </View>

          <Text style={styles.section}>{t('an.learning')}</Text>
          <View style={styles.grid}>
            <Stat label={t('an.studyTime')} value={hours(data.studyMinutes)} />
            <Stat label={t('an.mastery')} value={data.avgMastery === null ? '—' : pct(data.avgMastery)} />
            <Stat label={t('an.lessons')} value={String(data.lessonsCompleted)} />
            <Stat label={t('an.aiQuestions')} value={String(data.aiUsage.aiQuestions)} />
            <Stat label={t('an.voiceMinutes')} value={String(data.aiUsage.voiceMinutes)} />
          </View>

          <Text style={styles.section}>{t('an.topFeatures')}</Text>
          <Card>
            {data.topFeatures.length === 0 ? (
              <Text style={styles.sub}>—</Text>
            ) : (
              data.topFeatures.map((f) => (
                <View key={f.feature} style={styles.featRow}>
                  <Text style={styles.featName}>{t(`an.feature.${f.feature}` as TranslationKey)}</Text>
                  <Text style={styles.featCount}>{f.count}</Text>
                </View>
              ))
            )}
          </Card>
        </>
      ) : null}
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const { colors: c } = useTokens();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <Card style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Card>
  );
}

const makeStyles = (c: ColorScale) => StyleSheet.create({
  container: { padding: 20, gap: 10, maxWidth: 820, width: '100%', alignSelf: 'center' },
  h1: { fontSize: 28, fontWeight: '700', color: c.textPrimary },
  intro: { fontSize: 14, color: c.textSecondary, lineHeight: 20, marginBottom: 4 },
  section: { fontSize: 12, fontWeight: '700', color: c.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginTop: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  stat: { flexGrow: 1, flexBasis: '30%', minWidth: 96, alignItems: 'center', paddingVertical: 16 },
  statValue: { fontSize: 24, fontWeight: '800', color: c.primary, fontVariant: ['tabular-nums'] },
  statLabel: { fontSize: 12, color: c.textSecondary, marginTop: 4, textAlign: 'center' },
  sub: { fontSize: 13, color: c.textSecondary },
  featRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderTopWidth: 1, borderTopColor: c.border },
  featName: { fontSize: 14, color: c.textPrimary, textTransform: 'capitalize' },
  featCount: { fontSize: 14, fontWeight: '700', color: c.textPrimary, fontVariant: ['tabular-nums'] },
});
