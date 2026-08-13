import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import type { UsageItem, UsageView } from '@second-brain/shared';
import { api } from '../lib/client';
import { theme } from '../lib/theme';
import { useI18n, type TranslationKey } from '../lib/i18n';
import { Card, ErrorBanner, Loading } from '../components/ui';

const GB = 1024 * 1024 * 1024;

/** Usage & Quotas (Sprint 8.3) — how much of each plan limit has been used. */
export default function UsageScreen() {
  const { t } = useI18n();
  const [usage, setUsage] = useState<UsageView | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setUsage(await api<UsageView>('/usage'));
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (!usage && !error) return <Loading />;

  const fmt = (item: UsageItem, value: number): string => {
    if (item.unit === 'bytes') return `${(value / GB).toFixed(1)} ${t('usage.gb')}`;
    if (item.unit === 'minutes') return `${value} ${t('usage.min')}`;
    return String(value);
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.h1}>{t('usage.title')}</Text>
      <Text style={styles.intro}>{t('usage.intro')}</Text>

      {error ? <ErrorBanner message={error} /> : null}

      {usage?.items.map((item) => {
        const unlimited = item.limit === null;
        const ratio =
          item.limit === null || item.limit === 0
            ? 0
            : Math.min(1, item.used / item.limit);
        const near = ratio >= 0.8;
        return (
          <Card key={item.key} style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.label}>{t(`usage.metric.${item.key}` as TranslationKey)}</Text>
              <Text style={styles.value}>
                {fmt(item, item.used)}
                {unlimited ? ` / ${t('usage.unlimited')}` : ` / ${fmt(item, item.limit as number)}`}
              </Text>
            </View>
            <View style={styles.track}>
              <View
                style={[
                  styles.fill,
                  { width: `${Math.round(ratio * 100)}%` },
                  near ? styles.fillNear : null,
                ]}
              />
            </View>
          </Card>
        );
      })}

      <Text style={styles.note}>{t('usage.note')}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 12, maxWidth: 720, width: '100%', alignSelf: 'center' },
  h1: { fontSize: 28, fontWeight: '700', color: theme.text },
  intro: { fontSize: 14, color: theme.textMuted, lineHeight: 20, marginBottom: 4 },
  card: { gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { fontSize: 15, fontWeight: '600', color: theme.text },
  value: { fontSize: 14, color: theme.textMuted, fontVariant: ['tabular-nums'] },
  track: { height: 8, borderRadius: 999, backgroundColor: theme.surfaceAlt, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 999, backgroundColor: theme.accent },
  fillNear: { backgroundColor: theme.warn },
  note: { fontSize: 12, color: theme.textFaint, fontStyle: 'italic', marginTop: 4 },
});
