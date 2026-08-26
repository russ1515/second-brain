import { useCallback, useEffect, useState, useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type {
  ConceptMasteryDetail,
  ErrorFrequency,
  MasteryConfidence,
  RevisionPriority,
} from '@second-brain/shared';
import { api } from '../lib/client';
import { useTokens } from '../lib/design/theme';
import type { ColorScale } from '../lib/design/tokens';
import { useI18n, type TranslationKey } from '../lib/i18n';
import { Button, ErrorBanner, Loading } from '../components/ui';

const CONFIDENCE_KEY: Record<MasteryConfidence, TranslationKey> = {
  low: 'mastery.conf.low',
  medium: 'mastery.conf.medium',
  high: 'mastery.conf.high',
};
const ERROR_KEY: Record<ErrorFrequency, TranslationKey> = {
  none: 'mastery.err.none',
  low: 'mastery.err.low',
  high: 'mastery.err.high',
};
const PRIORITY_KEY: Record<RevisionPriority, TranslationKey> = {
  low: 'mastery.prio.low',
  medium: 'mastery.prio.medium',
  high: 'mastery.prio.high',
  urgent: 'mastery.prio.urgent',
};
const priorityColor = (c: ColorScale): Record<RevisionPriority, string> => ({
  urgent: c.error,
  high: c.warning,
  medium: c.primary,
  low: c.success,
});

/**
 * ConceptMastery (task 4.3): every concept gets a star rating plus its five
 * signals — mastery, confidence, error frequency, estimated forgetting and
 * revision priority. Ordered most-urgent first, all derived from FSRS state.
 */
export default function MasteryScreen() {
  const { colors: c } = useTokens();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { t } = useI18n();
  const [concepts, setConcepts] = useState<ConceptMasteryDetail[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setConcepts(await api<ConceptMasteryDetail[]>('/twin/mastery'));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (error && !concepts) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <ErrorBanner message={error} />
        <Button variant="ghost" label={t('app.tryAgain')} onPress={() => void load()} />
      </ScrollView>
    );
  }
  if (!concepts) return <Loading label={t('mastery.loading')} />;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.masthead}>
        <Text style={styles.kicker}>🎯 {t('mastery.title')}</Text>
        <Text style={styles.intro}>{t('mastery.intro')}</Text>
      </View>

      {concepts.length === 0 ? (
        <Text style={styles.empty}>{t('mastery.empty')}</Text>
      ) : (
        concepts.map((c) => <ConceptRow key={c.conceptId} c={c} t={t} />)
      )}

      <Button variant="ghost" label={t('app.tryAgain')} onPress={() => void load()} />
    </ScrollView>
  );
}

function ConceptRow({
  c,
  t,
}: {
  c: ConceptMasteryDetail;
  t: (k: TranslationKey) => string;
}) {
  const { colors: tk } = useTokens();
  const styles = useMemo(() => makeStyles(tk), [tk]);
  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.name} numberOfLines={1}>
          {c.name}
        </Text>
        <Text style={styles.stars}>
          {'★'.repeat(c.stars)}
          <Text style={styles.starsOff}>{'☆'.repeat(5 - c.stars)}</Text>
        </Text>
      </View>

      <View style={styles.signals}>
        <Signal label={t('mastery.mastery')} value={c.mastery === null ? '—' : `${Math.round(c.mastery * 100)}%`} />
        <Signal label={t('mastery.confidence')} value={t(CONFIDENCE_KEY[c.confidence])} />
        <Signal label={t('mastery.errors')} value={t(ERROR_KEY[c.errorFrequency])} />
        <Signal
          label={t('mastery.forgetting')}
          value={c.forgettingRisk === null ? '—' : `${c.forgettingRisk}%`}
        />
      </View>

      <View style={[styles.priority, { borderColor: priorityColor(tk)[c.revisionPriority] }]}>
        <Text style={[styles.priorityText, { color: priorityColor(tk)[c.revisionPriority] }]}>
          {t('mastery.priority')}: {t(PRIORITY_KEY[c.revisionPriority])}
        </Text>
      </View>
    </View>
  );
}

function Signal({ label, value }: { label: string; value: string }) {
  const { colors: c } = useTokens();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <View style={styles.signal}>
      <Text style={styles.signalLabel}>{label}</Text>
      <Text style={styles.signalValue}>{value}</Text>
    </View>
  );
}

const makeStyles = (c: ColorScale) => StyleSheet.create({
  container: { padding: 20, gap: 12, maxWidth: 1280, width: '100%', alignSelf: 'center' },
  masthead: { gap: 4 },
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
    borderRadius: 12,
    padding: 14,
    gap: 12,
  },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  name: { flex: 1, fontSize: 17, fontWeight: '700', color: c.textPrimary },
  stars: { fontSize: 17, color: c.warning, letterSpacing: 1 },
  starsOff: { color: c.border },
  signals: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  signal: {
    flexGrow: 1,
    flexBasis: '44%',
    backgroundColor: c.surfaceElevated,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    gap: 2,
  },
  signalLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: c.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  signalValue: { fontSize: 15, fontWeight: '600', color: c.textPrimary },
  priority: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  priorityText: { fontSize: 12, fontWeight: '700' },
});
