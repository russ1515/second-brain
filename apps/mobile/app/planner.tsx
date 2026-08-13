import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { DayPlan, PlanBlock, PlanBlockKind, PlanSource } from '@second-brain/shared';
import { api } from '../lib/client';
import { theme } from '../lib/theme';
import { useI18n, type TranslationKey } from '../lib/i18n';
import { Button, ErrorBanner, Loading } from '../components/ui';

const KIND_ICON: Record<PlanBlockKind, string> = {
  revision: '🔁',
  lesson: '📘',
  discussion: '💬',
  practical: '🔬',
  quiz: '❓',
  summary: '📝',
  break: '☕',
  end: '🏁',
};
const KIND_KEY: Record<PlanBlockKind, TranslationKey> = {
  revision: 'plan.k.revision',
  lesson: 'plan.k.lesson',
  discussion: 'plan.k.discussion',
  practical: 'plan.k.practical',
  quiz: 'plan.k.quiz',
  summary: 'plan.k.summary',
  break: 'plan.k.break',
  end: 'plan.k.end',
};
const SOURCE_LABEL: Record<PlanSource, string> = {
  fsrs: 'FSRS',
  digitalTwin: 'Digital Twin',
  conceptMastery: 'ConceptMastery',
  learningMemory: 'Learning Memory',
  knowledgeGraph: 'Knowledge Graph',
  adaptivePath: 'Adaptive Path',
};

/**
 * AI Study Planner (task 5.2) — the conductor's timeline.
 *
 * It shows the day the planner assembled from the other engines: a time-blocked
 * sequence you can launch block by block. It's alive — "Replan now" rebuilds the
 * rest of the day from the current moment.
 */
export default function PlannerScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const [plan, setPlan] = useState<DayPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (replan = false) => {
    setBusy(true);
    try {
      setPlan(
        replan
          ? await api<DayPlan>('/planner/replan', { method: 'POST' })
          : await api<DayPlan>('/planner/today'),
      );
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
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
  if (!plan) return <Loading label={t('plan.loading')} />;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.masthead}>
        <Text style={styles.kicker}>🗓️ {t('plan.title')}</Text>
        <Text style={styles.intro}>{t('plan.intro')}</Text>
      </View>

      {/* Which engines the planner assembled — it creates nothing itself. */}
      <View style={styles.sources}>
        <Text style={styles.sourcesLabel}>{t('plan.assembled')}</Text>
        <View style={styles.chips}>
          {plan.sources.map((s) => (
            <View key={s} style={styles.chip}>
              <Text style={styles.chipText}>{SOURCE_LABEL[s]}</Text>
            </View>
          ))}
        </View>
      </View>

      {plan.live ? <Text style={styles.liveTag}>🟢 {t('plan.live')}</Text> : null}

      <View style={styles.timeline}>
        {plan.blocks.map((b, i) => (
          <Row key={i} block={b} last={i === plan.blocks.length - 1} t={t} router={router} />
        ))}
      </View>

      <Button label={t('plan.replan')} onPress={() => void load(true)} busy={busy} />
    </ScrollView>
  );
}

function Row({
  block,
  last,
  t,
  router,
}: {
  block: PlanBlock;
  last: boolean;
  t: (k: TranslationKey) => string;
  router: ReturnType<typeof useRouter>;
}) {
  const isEnd = block.kind === 'end';
  const tappable = !!block.route && !isEnd;
  const subject =
    block.kind === 'revision' ? `${block.subject} ${t('plan.items')}` : block.subject;
  return (
    <View style={styles.row}>
      <View style={styles.timeCol}>
        <Text style={styles.time}>{block.start}</Text>
        {!last ? <View style={styles.connector} /> : null}
      </View>
      <Pressable
        style={[styles.card, isEnd && styles.cardEnd, tappable && styles.cardTap]}
        disabled={!tappable}
        onPress={() => block.route && router.push(block.route as never)}
        accessibilityRole={tappable ? 'button' : undefined}
      >
        <Text style={styles.cardIcon}>{KIND_ICON[block.kind]}</Text>
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle}>{t(KIND_KEY[block.kind])}</Text>
          {!isEnd ? (
            <Text style={styles.cardMeta}>
              {block.minutes} min{subject ? ` · ${subject}` : ''}
            </Text>
          ) : null}
        </View>
        {tappable ? <Text style={styles.chevron}>›</Text> : null}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 14, maxWidth: 720, width: '100%', alignSelf: 'center' },
  masthead: { gap: 4 },
  kicker: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.accent,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  intro: { fontSize: 15, color: theme.textMuted, lineHeight: 21 },
  sources: { gap: 6 },
  sourcesLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.textFaint,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    backgroundColor: theme.surfaceAlt,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chipText: { fontSize: 11, color: theme.textMuted, fontWeight: '600' },
  liveTag: { fontSize: 13, color: theme.ok, fontWeight: '600' },
  timeline: { gap: 0 },
  row: { flexDirection: 'row', gap: 12 },
  timeCol: { alignItems: 'center', width: 48 },
  time: { fontSize: 14, fontWeight: '800', color: theme.text, paddingTop: 14 },
  connector: { flex: 1, width: 2, backgroundColor: theme.border, marginTop: 4 },
  card: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  cardTap: { borderLeftWidth: 3, borderLeftColor: theme.accent },
  cardEnd: { backgroundColor: theme.surfaceAlt, borderStyle: 'dashed' },
  cardIcon: { fontSize: 22 },
  cardBody: { flex: 1, gap: 1 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: theme.text },
  cardMeta: { fontSize: 12, color: theme.textMuted },
  chevron: { fontSize: 22, color: theme.textFaint },
});
