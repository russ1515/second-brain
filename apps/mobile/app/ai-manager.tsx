import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { AiOrchestratorView, AiProviderInfo, AiStrategy } from '@second-brain/shared';
import { api } from '../lib/client';
import { useApiQuery } from '../lib/query';
import { theme } from '../lib/theme';
import { useI18n, type TranslationKey } from '../lib/i18n';
import { Button, Card, ErrorBanner, Loading } from '../components/ui';

const STRATEGIES: AiStrategy[] = ['quality', 'cost', 'speed', 'balanced'];
const STRAT_KEY: Record<AiStrategy, TranslationKey> = {
  quality: 'aim.strat.quality',
  cost: 'aim.strat.cost',
  speed: 'aim.strat.speed',
  balanced: 'aim.strat.balanced',
};

/**
 * 🤖 AI Provider Manager (Sprint 10.6). The multi-model control room: the catalog
 * of AI backends (which are usable now), the active orchestration strategy (which
 * one gets picked — best / cheapest / fastest), and live usage. Switching the
 * strategy re-routes every AI call transparently.
 */
export default function AiManagerScreen() {
  const { t } = useI18n();
  const { data, error, refetch } = useApiQuery<AiOrchestratorView>(['ai-orchestrator'], '/ai/orchestrator');
  const [busy, setBusy] = useState(false);

  const setStrategy = async (strategy: AiStrategy) => {
    setBusy(true);
    try {
      await api('/ai/orchestrator/strategy', { method: 'PUT', body: { strategy } });
      await refetch();
    } finally {
      setBusy(false);
    }
  };

  if (error && !data) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <ErrorBanner message={(error as Error).message} />
        <Button variant="ghost" label={t('app.tryAgain')} onPress={() => void refetch()} />
      </ScrollView>
    );
  }
  if (!data) return <Loading label={t('aim.loading')} />;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.masthead}>
        <Text style={styles.kicker}>🤖 {t('aim.title')}</Text>
        <Text style={styles.intro}>{t('aim.intro')}</Text>
      </View>

      {/* Strategy selector. */}
      <Card style={styles.card}>
        <Text style={styles.sectionLabel}>{t('aim.strategy')}</Text>
        <View style={styles.chips}>
          {STRATEGIES.map((s) => {
            const active = s === data.strategy;
            return (
              <Pressable
                key={s}
                disabled={busy}
                onPress={() => void setStrategy(s)}
                style={[styles.chip, active && styles.chipActive, busy && styles.chipOff]}
                testID={`strat-${s}`}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {t(STRAT_KEY[s])} → {data.selection[s]}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.active}>
          {t('aim.active')}: <Text style={styles.activeName}>{data.active}</Text>
        </Text>
      </Card>

      {/* Provider catalog. */}
      <Text style={styles.sectionLabel}>{t('aim.catalog')}</Text>
      {data.providers.map((p) => (
        <ProviderCard key={p.name} p={p} usage={data.usage.find((u) => u.model === p.name)} t={t} />
      ))}
    </ScrollView>
  );
}

function ProviderCard({
  p,
  usage,
  t,
}: {
  p: AiProviderInfo;
  usage?: { calls: number; avgMs: number };
  t: (k: TranslationKey) => string;
}) {
  return (
    <Card style={StyleSheet.flatten([styles.provCard, p.available ? styles.provOn : styles.provOff])}>
      <View style={styles.provHead}>
        <Text style={styles.provName}>{p.family}</Text>
        <View style={[styles.badge, { backgroundColor: p.available ? theme.ok : theme.textFaint }]}>
          <Text style={styles.badgeText}>{p.available ? t('aim.ready') : t('aim.off')}</Text>
        </View>
      </View>
      <Text style={styles.provModel}>{p.model}</Text>
      <View style={styles.tiers}>
        <Tier label={t('aim.cost')} value={'$'.repeat(p.costTier)} />
        <Tier label={t('aim.speed')} value={'⚡'.repeat(p.speedTier)} />
        <Tier label={t('aim.quality')} value={'★'.repeat(p.qualityTier)} />
        {p.vision ? <Tier label={t('aim.vision')} value="👁" /> : null}
      </View>
      {usage && usage.calls > 0 ? (
        <Text style={styles.usage}>{usage.calls} calls · {usage.avgMs}ms avg</Text>
      ) : null}
      {p.unavailableReason ? <Text style={styles.reason}>{p.unavailableReason}</Text> : null}
    </Card>
  );
}

function Tier({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.tier}>
      <Text style={styles.tierValue}>{value}</Text>
      <Text style={styles.tierLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 12, maxWidth: 720, width: '100%', alignSelf: 'center' },
  masthead: { gap: 4, marginBottom: 2 },
  kicker: { fontSize: 13, fontWeight: '700', color: theme.accent, textTransform: 'uppercase', letterSpacing: 1.2 },
  intro: { fontSize: 15, color: theme.textMuted, lineHeight: 21 },
  card: { gap: 10 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: theme.textFaint, textTransform: 'uppercase', letterSpacing: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: theme.border, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: theme.surface },
  chipActive: { backgroundColor: theme.accent, borderColor: theme.accent },
  chipOff: { opacity: 0.5 },
  chipText: { fontSize: 13, color: theme.text, fontWeight: '600' },
  chipTextActive: { color: theme.accentText },
  active: { fontSize: 13, color: theme.textMuted },
  activeName: { color: theme.text, fontWeight: '700' },
  provCard: { gap: 6, borderLeftWidth: 3 },
  provOn: { borderLeftColor: theme.ok },
  provOff: { borderLeftColor: theme.border, opacity: 0.7 },
  provHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  provName: { fontSize: 16, fontWeight: '700', color: theme.text },
  badge: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 2 },
  badgeText: { fontSize: 10, fontWeight: '800', color: '#FFFFFF', textTransform: 'uppercase' },
  provModel: { fontSize: 13, color: theme.textMuted, fontFamily: 'monospace' },
  tiers: { flexDirection: 'row', gap: 18, marginTop: 2 },
  tier: { alignItems: 'center' },
  tierValue: { fontSize: 14, color: theme.text },
  tierLabel: { fontSize: 10, color: theme.textFaint, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 1 },
  usage: { fontSize: 12, color: theme.accent, fontWeight: '600' },
  reason: { fontSize: 12, color: theme.textFaint, fontStyle: 'italic' },
});
