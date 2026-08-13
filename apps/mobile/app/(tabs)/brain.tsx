import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import type {
  ConceptMasteryDetail,
  LearnerProfile,
  LearningMemory,
  ProactivePlan,
  StrengthsWeaknesses,
  TwinGraph,
} from '@second-brain/shared';
import { api } from '../../lib/client';
import { useI18n, type TranslationKey } from '../../lib/i18n';
import { theme } from '../../lib/theme';

const BAND_KEY = {
  new: 'twin.band.new',
  weak: 'twin.band.weak',
  building: 'twin.band.building',
  strong: 'twin.band.strong',
} as const;

interface Dash {
  profile: LearnerProfile | null;
  mastery: ConceptMasteryDetail[] | null;
  sw: StrengthsWeaknesses | null;
  graph: TwinGraph | null;
  memory: LearningMemory | null;
  recs: ProactivePlan | null;
}

/**
 * 🧠 My Brain — the dashboard that IS Second Brain (task 4.8).
 *
 * One page that pulls a live glance from every part of the twin — profile,
 * memory, mastery, graph, progress, strengths, weaknesses and the AI's advice —
 * each a real number you can tap into. This is the product's identity: not a
 * feature list, but a mind that visibly learns.
 */
export default function BrainScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const [d, setD] = useState<Dash | null>(null);

  const load = useCallback(async () => {
    const val = <T,>(r: PromiseSettledResult<T>): T | null =>
      r.status === 'fulfilled' ? r.value : null;
    const [profile, mastery, sw, graph, memory, recs] = await Promise.allSettled([
      api<LearnerProfile>('/twin/profile'),
      api<ConceptMasteryDetail[]>('/twin/mastery'),
      api<StrengthsWeaknesses>('/twin/strengths'),
      api<TwinGraph>('/twin/graph'),
      api<LearningMemory>('/memory'),
      api<ProactivePlan>('/twin/recommendations'),
    ]);
    setD({
      profile: val(profile),
      mastery: val(mastery),
      sw: val(sw),
      graph: val(graph),
      memory: val(memory),
      recs: val(recs),
    });
  }, []);

  // Refresh every time the tab regains focus, so the brain reflects the latest.
  useFocusEffect(useCallback(() => void load(), [load]));

  const score = d?.profile?.overallProgress.score ?? null;
  const topMastery = d?.mastery?.[0] ?? null;
  const topStrength = d?.sw?.strengths[0] ?? null;
  const topWeakness = d?.sw?.weaknesses[0] ?? null;
  const topRec = d?.recs?.recommendations[0] ?? null;
  const dash = '—';

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.masthead}>
        <Text style={styles.h1}>🧠 {t('tab.brain')}</Text>
        <Text style={styles.intro}>{t('brain.dash.tagline')}</Text>
      </View>

      {/* Progression — the headline of the whole brain. */}
      <Pressable style={styles.hero} onPress={() => router.push('/progress')}>
        <Text style={styles.heroLabel}>📈 {t('coach.score')}</Text>
        <Text style={styles.heroScore}>
          {score === null ? dash : score}
          {score !== null ? <Text style={styles.heroUnit}> / 100</Text> : null}
        </Text>
        <Text style={styles.heroMeta}>
          {d?.profile ? `${d.profile.interactions} ${t('twin.interactions')}` : ''}
        </Text>
      </Pressable>

      <Metric
        emoji="🧬"
        title={t('dna.title')}
        value={t('dna.metricValue')}
        onPress={() => router.push('/learning-dna')}
        t={t}
        highlight
      />
      <Metric
        emoji="🧠"
        title={t('ic.title')}
        value={t('ic.metricValue')}
        onPress={() => router.push('/insights-center')}
        t={t}
        highlight
      />
      <Metric
        emoji="🧠"
        title={t('brain.twin')}
        value={d?.profile ? t(BAND_KEY[d.profile.level.band]) : dash}
        onPress={() => router.push('/twin-profile')}
        t={t}
      />
      <Metric
        emoji="📚"
        title={t('brain.memory')}
        value={d?.memory ? `${d.memory.summary.total} ${t('brain.dash.memories')}` : dash}
        onPress={() => router.push('/memory')}
        t={t}
      />
      <Metric
        emoji="🎯"
        title={t('brain.mastery')}
        value={
          topMastery
            ? `${topMastery.name} ${stars(topMastery.stars)}`
            : d?.mastery
              ? t('brain.dash.none')
              : dash
        }
        onPress={() => router.push('/mastery')}
        t={t}
      />
      <Metric
        emoji="🕸️"
        title={t('brain.graph')}
        value={
          d?.graph
            ? `${d.graph.nodes.length} ${t('brain.dash.concepts')} · ${d.graph.edges.length} ${t('brain.dash.links')}`
            : dash
        }
        onPress={() => router.push('/graph')}
        t={t}
      />
      <Metric
        emoji="💪"
        title={t('brain.strengths')}
        value={topStrength ? `${topStrength.name} ${stars(topStrength.stars)}` : d?.sw ? t('brain.dash.none') : dash}
        onPress={() => router.push('/strengths')}
        t={t}
      />
      <Metric
        emoji="⚠️"
        title={t('brain.weaknesses')}
        value={topWeakness ? `${topWeakness.name} ${stars(topWeakness.stars)}` : d?.sw ? t('sw.noWeaknesses') : dash}
        onPress={() => router.push('/strengths?focus=weaknesses')}
        t={t}
      />
      <Metric
        emoji="🤖"
        title={t('brain.recommend')}
        value={topRec ? recValue(topRec, t) : d?.recs ? t('brain.dash.none') : dash}
        onPress={() => router.push('/recommendations')}
        t={t}
        highlight
      />
    </ScrollView>
  );
}

function Metric({
  emoji,
  title,
  value,
  onPress,
  t,
  highlight,
}: {
  emoji: string;
  title: string;
  value: string;
  onPress: () => void;
  t: (k: TranslationKey) => string;
  highlight?: boolean;
}) {
  return (
    <Pressable
      style={[styles.metric, highlight && styles.metricHi]}
      onPress={onPress}
      accessibilityRole="button"
    >
      <Text style={styles.metricIcon}>{emoji}</Text>
      <View style={styles.metricBody}>
        <Text style={styles.metricTitle}>{title}</Text>
        <Text style={styles.metricValue} numberOfLines={1}>
          {value}
        </Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

function stars(n: number): string {
  return '★'.repeat(n) + '☆'.repeat(Math.max(0, 5 - n));
}

/** Compact preview of the top AI recommendation. */
function recValue(r: ProactivePlan['recommendations'][number], t: (k: TranslationKey) => string): string {
  const icon = { review: '🔁', consolidate: '🧱', levelUp: '🎓', advance: '🚀' }[r.kind];
  if (r.kind === 'advance') return `${icon} ${t('rec.cta.advance').replace(/^🚀\s*/, '')}`;
  return `${icon} ${r.subject ?? ''}`.trim();
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 12, maxWidth: 720, width: '100%', alignSelf: 'center' },
  masthead: { gap: 4 },
  h1: { fontSize: 30, fontWeight: '800', color: theme.text },
  intro: { fontSize: 15, color: theme.textMuted, lineHeight: 21 },
  hero: {
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.accent,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    gap: 2,
    marginBottom: 2,
  },
  heroLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.textFaint,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  heroScore: { fontSize: 52, fontWeight: '800', color: theme.text, lineHeight: 58 },
  heroUnit: { fontSize: 20, fontWeight: '600', color: theme.textFaint },
  heroMeta: { fontSize: 13, color: theme.textMuted },
  metric: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 12,
    padding: 14,
  },
  metricHi: { borderColor: theme.accent, borderLeftWidth: 3 },
  metricIcon: { fontSize: 24 },
  metricBody: { flex: 1, gap: 1 },
  metricTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.textFaint,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  metricValue: { fontSize: 16, fontWeight: '600', color: theme.text },
  chevron: { fontSize: 24, color: theme.textFaint, fontWeight: '400' },
});
