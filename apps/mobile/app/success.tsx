import { useCallback, useEffect, useState, useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type {
  ConfidenceBand,
  ExamPrediction,
  SuccessForecast,
} from '@second-brain/shared';
import { api } from '../lib/client';
import { useTokens } from '../lib/design/theme';
import type { ColorScale } from '../lib/design/tokens';
import { useI18n, type TranslationKey } from '../lib/i18n';
import { Button, Card, ErrorBanner, Loading } from '../components/ui';

const BAND_KEY: Record<ConfidenceBand, TranslationKey> = {
  low: 'succ.band.low',
  medium: 'succ.band.medium',
  high: 'succ.band.high',
};

const bandColor = (c: ColorScale): Record<ConfidenceBand, string> => ({
  low: c.textMuted,
  medium: c.warning,
  high: c.success,
});

/**
 * 📊 Academic Success Predictor (Sprint 9.6). For each upcoming exam: the
 * preparation level, the estimated probability of success, and the model's own
 * confidence in that estimate. The point isn't to foretell the result — it's to
 * help the learner prepare better, so every card carries advice and its factors.
 */
export default function SuccessScreen() {
  const { colors: c } = useTokens();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { t } = useI18n();
  const [data, setData] = useState<SuccessForecast | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await api<SuccessForecast>('/success'));
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
  if (!data) return <Loading label={t('succ.loading')} />;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.masthead}>
        <Text style={styles.kicker}>📊 {t('succ.title')}</Text>
        <Text style={styles.intro}>{t('succ.intro')}</Text>
        <Text style={styles.note}>{t('succ.note')}</Text>
      </View>

      {data.exams.length === 0 ? (
        <Text style={styles.empty}>{t('succ.empty')}</Text>
      ) : (
        data.exams.map((e) => <ExamCard key={e.examId} e={e} t={t} />)
      )}

      <Button variant="ghost" label={t('app.tryAgain')} onPress={() => void load()} />
    </ScrollView>
  );
}

function ExamCard({ e, t }: { e: ExamPrediction; t: (k: TranslationKey) => string }) {
  const { colors: c } = useTokens();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <Card style={styles.card} testID={`success-${e.examId}`}>
      <View style={styles.head}>
        <Text style={styles.subject}>{e.subject}</Text>
        <Text style={styles.days}>
          {e.daysUntil === 0 ? t('succ.today') : `${t('succ.in')} ${e.daysUntil} ${t('succ.days')}`}
        </Text>
      </View>

      <View style={styles.metrics}>
        <Metric label={t('succ.preparation')} value={pct(e.preparation)} color={c.primary} />
        <Metric
          label={t('succ.probability')}
          value={pct(e.successProbability)}
          color={c.success}
          big
        />
      </View>

      {/* Model confidence — how much to trust the numbers above. */}
      <View style={styles.confRow}>
        <Text style={styles.confLabel}>{t('succ.confidence')}</Text>
        <View style={[styles.confBadge, { backgroundColor: bandColor(c)[e.confidenceBand] }]}>
          <Text style={styles.confText}>
            {e.confidence}% · {t(BAND_KEY[e.confidenceBand])}
          </Text>
        </View>
      </View>

      <Text style={styles.adviceLabel}>{t('succ.advice')}</Text>
      <Text style={styles.advice}>{e.advice}</Text>

      {e.factors.length > 0 ? (
        <>
          <Text style={styles.whyLabel}>{t('succ.why')}</Text>
          {e.factors.map((f, i) => (
            <Text key={i} style={styles.factor}>
              • {f}
            </Text>
          ))}
        </>
      ) : null}
    </Card>
  );
}

function Metric({
  label,
  value,
  color,
  big,
}: {
  label: string;
  value: string;
  color: string;
  big?: boolean;
}) {
  const { colors: c } = useTokens();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <View style={styles.metric}>
      <Text style={[styles.metricValue, big && styles.metricValueBig, { color }]}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function pct(v: number | null): string {
  return v === null ? '—' : `${v}%`;
}

const makeStyles = (c: ColorScale) => StyleSheet.create({
  container: { padding: 20, gap: 12, maxWidth: 1280, width: '100%', alignSelf: 'center' },
  masthead: { gap: 4, marginBottom: 2 },
  kicker: {
    fontSize: 13,
    fontWeight: '700',
    color: c.primary,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  intro: { fontSize: 15, color: c.textSecondary, lineHeight: 21 },
  note: { fontSize: 13, color: c.textMuted, fontStyle: 'italic', lineHeight: 18 },
  empty: { fontSize: 14, color: c.textSecondary },
  card: { gap: 10 },
  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  subject: { fontSize: 18, fontWeight: '700', color: c.textPrimary },
  days: { fontSize: 13, color: c.textSecondary, fontWeight: '600' },
  metrics: { flexDirection: 'row', gap: 24 },
  metric: { gap: 2 },
  metricValue: { fontSize: 24, fontWeight: '800' },
  metricValueBig: { fontSize: 34 },
  metricLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: c.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  confRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  confLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: c.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  confBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  confText: { fontSize: 12, fontWeight: '700', color: c.onColor },
  adviceLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: c.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 2,
  },
  advice: { fontSize: 15, color: c.textPrimary, lineHeight: 22 },
  whyLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: c.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 2,
  },
  factor: { fontSize: 13, color: c.textSecondary, lineHeight: 19 },
});
