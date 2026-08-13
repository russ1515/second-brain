import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { MonitoringSnapshot } from '@second-brain/shared';
import { useApiQuery } from '../lib/query';
import { theme } from '../lib/theme';
import { useI18n } from '../lib/i18n';
import { Button, Card, ErrorBanner, Loading } from '../components/ui';

/**
 * 📊 Monitoring Dashboard (Sprint 10.4). The internal health view: HTTP traffic
 * and latency, error rate, AI calls, cache effectiveness and memory — read from
 * the in-process metrics registry (also exported to Prometheus at /metrics).
 */
export default function MonitoringScreen() {
  const { t } = useI18n();
  const { data, error, refetch } = useApiQuery<MonitoringSnapshot>(['monitoring'], '/monitoring');

  if (error && !data) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <ErrorBanner message={(error as Error).message} />
        <Button variant="ghost" label={t('app.tryAgain')} onPress={() => void refetch()} />
      </ScrollView>
    );
  }
  if (!data) return <Loading label={t('mon.loading')} />;

  const errPct = Math.round(data.http.errorRate * 100);
  const hitPct = Math.round(data.cache.hitRate * 100);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.masthead}>
        <Text style={styles.kicker}>📊 {t('mon.title')}</Text>
        <Text style={styles.intro}>{t('mon.intro')}</Text>
      </View>

      <Section label={t('mon.http')}>
        <Stat value={String(data.http.total)} label={t('mon.requests')} />
        <Stat value={`${errPct}%`} label={t('mon.errorRate')} color={errPct > 0 ? theme.danger : theme.ok} />
        <Stat value={`${data.http.p50Ms}ms`} label="p50" />
        <Stat value={`${data.http.p95Ms}ms`} label="p95" />
      </Section>

      <Section label={t('mon.ai')}>
        <Stat value={String(data.ai.calls)} label={t('mon.aiCalls')} />
        <Stat value={String(data.ai.errors)} label={t('mon.errors')} color={data.ai.errors > 0 ? theme.warn : theme.ok} />
        <Stat value={`${data.ai.avgMs}ms`} label={t('mon.avgLatency')} />
      </Section>

      {data.ai.byModel.length > 0 ? (
        <Card style={styles.modelsCard}>
          <Text style={styles.sectionLabel}>{t('mon.byModel')}</Text>
          {data.ai.byModel.map((m) => (
            <View key={m.model} style={styles.modelRow}>
              <Text style={styles.modelName}>{m.model}</Text>
              <Text style={styles.modelMeta}>
                {m.calls} · {m.avgMs}ms{m.errors > 0 ? ` · ${m.errors}✗` : ''}
              </Text>
            </View>
          ))}
        </Card>
      ) : null}

      <Section label={t('mon.cache')}>
        <Stat value={`${hitPct}%`} label={t('mon.hitRate')} color={hitPct >= 50 ? theme.ok : theme.warn} />
        <Stat value={String(data.cache.hits)} label={t('mon.hits')} />
        <Stat value={String(data.cache.misses)} label={t('mon.misses')} />
      </Section>

      <Section label={t('mon.process')}>
        <Stat value={`${data.process.rssMb}MB`} label={t('mon.memory')} />
        <Stat value={`${data.process.heapUsedMb}MB`} label={t('mon.heap')} />
        <Stat value={`${data.uptimeSeconds}s`} label={t('mon.uptime')} />
      </Section>

      <Text style={styles.note}>{t('mon.note')}</Text>
      <Button variant="ghost" label={t('app.tryAgain')} onPress={() => void refetch()} />
    </ScrollView>
  );
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Card style={styles.section}>
      <Text style={styles.sectionLabel}>{label}</Text>
      <View style={styles.stats}>{children}</View>
    </Card>
  );
}

function Stat({ value, label, color }: { value: string; label: string; color?: string }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, color ? { color } : null]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
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
  section: { gap: 10 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.textFaint,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 20 },
  stat: { minWidth: 70 },
  statValue: { fontSize: 22, fontWeight: '800', color: theme.text },
  statLabel: { fontSize: 12, color: theme.textMuted, marginTop: 2 },
  modelsCard: { gap: 8 },
  modelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modelName: { fontSize: 14, color: theme.text, fontWeight: '600' },
  modelMeta: { fontSize: 13, color: theme.textMuted },
  note: { fontSize: 12, color: theme.textFaint, lineHeight: 17, marginTop: 4 },
});
