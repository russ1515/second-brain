import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type {
  AdaptivePath,
  ConceptSummary,
  PathStepAction,
} from '@second-brain/shared';
import { api } from '../lib/client';
import { theme } from '../lib/theme';
import { useI18n, type TranslationKey } from '../lib/i18n';
import { Card, ErrorBanner, Loading } from '../components/ui';

const ACTION_ICON: Record<PathStepAction, string> = {
  ready: '✅',
  consolidate: '🔧',
  target: '🎯',
};
const ACTION_KEY: Record<PathStepAction, TranslationKey> = {
  ready: 'apath.a.ready',
  consolidate: 'apath.a.consolidate',
  target: 'apath.a.target',
};
const ACTION_COLOR: Record<PathStepAction, string> = {
  ready: theme.ok,
  consolidate: theme.warn,
  target: theme.accent,
};

/**
 * Adaptive Learning Path Engine (task 5.7) ⭐. The learner names a goal; the
 * engine consults the Knowledge Graph, ConceptMastery, the Digital Twin and
 * FSRS and DECIDES the order — consolidate the weak prerequisites first, then
 * the goal. "Before Genetics, let's consolidate DNA and Mitosis."
 */
export default function AdaptivePathScreen() {
  const { t } = useI18n();
  const [concepts, setConcepts] = useState<ConceptSummary[] | null>(null);
  const [goal, setGoal] = useState<ConceptSummary | null>(null);
  const [path, setPath] = useState<AdaptivePath | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadConcepts = useCallback(async () => {
    try {
      setConcepts(await api<ConceptSummary[]>('/concepts'));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void loadConcepts();
  }, [loadConcepts]);

  const pickGoal = async (c: ConceptSummary) => {
    setGoal(c);
    setBusy(true);
    setPath(null);
    try {
      setPath(await api<AdaptivePath>(`/twin/path/${c.id}`));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (error && !concepts) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <ErrorBanner message={error} />
      </ScrollView>
    );
  }
  if (!concepts) return <Loading label={t('apath.loading')} />;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.masthead}>
        <Text style={styles.kicker}>🧭 {t('apath.title')}</Text>
        <Text style={styles.intro}>{t('apath.intro')}</Text>
      </View>

      {/* "I want to learn…" — pick the goal. */}
      <Text style={styles.pick}>{t('apath.pickGoal')}</Text>
      {concepts.length === 0 ? (
        <Text style={styles.empty}>{t('apath.noConcepts')}</Text>
      ) : (
        <View style={styles.chips}>
          {concepts.map((c) => (
            <Pressable
              key={c.id}
              style={[styles.chip, goal?.id === c.id && styles.chipOn]}
              onPress={() => pickGoal(c)}
              accessibilityRole="button"
            >
              <Text style={[styles.chipText, goal?.id === c.id && styles.chipTextOn]}>{c.name}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {busy ? <Loading label={t('apath.thinking')} /> : null}

      {path ? (
        <>
          {/* The teacher's verdict. */}
          <Card style={styles.verdict}>
            <Text style={styles.verdictText}>👨‍🏫 {verdict(path, t)}</Text>
          </Card>

          {/* The ordered path. */}
          <View style={styles.pathList}>
            {path.steps.map((s, i) => (
              <View key={s.conceptId} style={styles.step}>
                <View style={styles.stepCol}>
                  <Text style={styles.stepIcon}>{ACTION_ICON[s.action]}</Text>
                  {i < path.steps.length - 1 ? <View style={styles.connector} /> : null}
                </View>
                <View style={[styles.stepCard, { borderLeftColor: ACTION_COLOR[s.action] }]}>
                  <Text style={styles.stepName}>{s.name}</Text>
                  <Text style={[styles.stepAction, { color: ACTION_COLOR[s.action] }]}>
                    {t(ACTION_KEY[s.action])}
                    {s.mastery !== null ? ` · ${s.mastery}%` : ''}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </>
      ) : null}
    </ScrollView>
  );
}

/** Compose the teacher's ordering verdict. */
function verdict(path: AdaptivePath, t: (k: TranslationKey) => string): string {
  if (path.readyForTarget) {
    return t('apath.verdictReady').replace('{target}', path.target.name);
  }
  const list = joinAnd(path.consolidateFirst, t('apath.and'));
  return t('apath.verdictConsolidate')
    .replace('{target}', path.target.name)
    .replace('{list}', list);
}

function joinAnd(names: string[], and: string): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} ${and} ${names[names.length - 1]}`;
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 14, maxWidth: 720, width: '100%', alignSelf: 'center' },
  masthead: { gap: 4 },
  kicker: { fontSize: 13, fontWeight: '700', color: theme.accent, textTransform: 'uppercase', letterSpacing: 1.2 },
  intro: { fontSize: 15, color: theme.textMuted, lineHeight: 21 },
  pick: { fontSize: 12, fontWeight: '700', color: theme.textFaint, textTransform: 'uppercase', letterSpacing: 0.8 },
  empty: { fontSize: 14, color: theme.textMuted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: theme.border, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: theme.surfaceAlt },
  chipOn: { borderColor: theme.accent, backgroundColor: theme.accent },
  chipText: { fontSize: 14, color: theme.textMuted, fontWeight: '600' },
  chipTextOn: { color: theme.accentText },
  verdict: { borderColor: theme.accent, borderLeftWidth: 3 },
  verdictText: { fontSize: 16, color: theme.text, lineHeight: 24, fontWeight: '600' },
  pathList: { gap: 0 },
  step: { flexDirection: 'row', gap: 12 },
  stepCol: { alignItems: 'center', width: 32 },
  stepIcon: { fontSize: 22, paddingTop: 12 },
  connector: { flex: 1, width: 2, backgroundColor: theme.border, marginTop: 4 },
  stepCard: {
    flex: 1,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    borderLeftWidth: 3,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    gap: 2,
  },
  stepName: { fontSize: 16, fontWeight: '700', color: theme.text },
  stepAction: { fontSize: 12, fontWeight: '700' },
});
