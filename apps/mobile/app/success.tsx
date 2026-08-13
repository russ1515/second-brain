import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type {
  ConfidenceBand,
  ExamPrediction,
  SuccessForecast,
} from '@second-brain/shared';
import { api } from '../lib/client';
import { theme } from '../lib/theme';
import { useI18n, type TranslationKey } from '../lib/i18n';
import { Button, Card, ErrorBanner, Loading } from '../components/ui';

const BAND_KEY: Record<ConfidenceBand, TranslationKey> = {
  low: 'succ.band.low',
  medium: 'succ.band.medium',
  high: 'succ.band.high',
};

const BAND_COLOR: Record<ConfidenceBand, string> = {
  low: theme.textFaint,
  medium: theme.warn,
  high: theme.ok,
};

/**
 * 📊 Academic Success Predictor (Sprint 9.6). For each upcoming exam: the
 * preparation level, the estimated probability of success, and the model's own
 * confidence in that estimate. The point isn't to foretell the result — it's to
 * help the learner prepare better, so every card carries advice and its factors.
 */
export default function SuccessScreen() {
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
  return (
    <Card style={styles.card} testID={`success-${e.examId}`}>
      <View style={styles.head}>
        <Text style={styles.subject}>{e.subject}</Text>
        <Text style={styles.days}>
          {e.daysUntil === 0 ? t('succ.today') : `${t('succ.in')} ${e.daysUntil} ${t('succ.days')}`}
        </Text>
      </View>

      <View style={styles.metrics}>
        <Metric label={t('succ.preparation')} value={pct(e.preparation)} color={theme.accent} />
        <Metric
          label={t('succ.probability')}
          value={pct(e.successProbability)}
          color={theme.ok}
          big
        />
      </View>

      {/* Model confidence — how much to trust the numbers above. */}
      <View style={styles.confRow}>
        <Text style={styles.confLabel}>{t('succ.confidence')}</Text>
        <View style={[styles.confBadge, { backgroundColor: BAND_COLOR[e.confidenceBand] }]}>
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
  note: { fontSize: 13, color: theme.textFaint, fontStyle: 'italic', lineHeight: 18 },
  empty: { fontSize: 14, color: theme.textMuted },
  card: { gap: 10 },
  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  subject: { fontSize: 18, fontWeight: '700', color: theme.text },
  days: { fontSize: 13, color: theme.textMuted, fontWeight: '600' },
  metrics: { flexDirection: 'row', gap: 24 },
  metric: { gap: 2 },
  metricValue: { fontSize: 24, fontWeight: '800' },
  metricValueBig: { fontSize: 34 },
  metricLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.textFaint,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  confRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  confLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.textFaint,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  confBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  confText: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },
  adviceLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.textFaint,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 2,
  },
  advice: { fontSize: 15, color: theme.text, lineHeight: 22 },
  whyLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.textFaint,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 2,
  },
  factor: { fontSize: 13, color: theme.textMuted, lineHeight: 19 },
});
