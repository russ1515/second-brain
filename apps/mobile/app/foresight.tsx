import { useCallback, useEffect, useState, useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type {
  LearningPredictionView,
  PredictionKind,
  RiskLevel,
  RiskPrediction,
} from '@second-brain/shared';
import { api } from '../lib/client';
import { useTokens } from '../lib/design/theme';
import type { ColorScale } from '../lib/design/tokens';
import { useI18n, type TranslationKey } from '../lib/i18n';
import { Button, ErrorBanner, Loading } from '../components/ui';

const KIND_ICON: Record<PredictionKind, string> = {
  dropout: '🚪',
  difficulty: '⛰️',
  overload: '⚡',
  motivation: '🔋',
  forgetting: '🧠',
};

const KIND_KEY: Record<PredictionKind, TranslationKey> = {
  dropout: 'risk.kind.dropout',
  difficulty: 'risk.kind.difficulty',
  overload: 'risk.kind.overload',
  motivation: 'risk.kind.motivation',
  forgetting: 'risk.kind.forgetting',
};

const LEVEL_KEY: Record<RiskLevel, TranslationKey> = {
  low: 'risk.level.low',
  moderate: 'risk.level.moderate',
  high: 'risk.level.high',
};

const levelColor = (c: ColorScale): Record<RiskLevel, string> => ({
  low: c.success,
  moderate: c.warning,
  high: c.error,
});

/**
 * 🔭 Learning Prediction Engine (Sprint 9.3). Anticipates the risks on the
 * learner's trajectory — dropout, difficulty ahead, overload, motivation loss,
 * probable forgetting — each as a probability with its probable cause, the
 * recommended action, and the signals behind it (so the AI always explains why).
 */
export default function ForesightScreen() {
  const { colors: c } = useTokens();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { t } = useI18n();
  const [data, setData] = useState<LearningPredictionView | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await api<LearningPredictionView>('/foresight'));
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
  if (!data) return <Loading label={t('risk.loading')} />;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.masthead}>
        <Text style={styles.kicker}>🔭 {t('risk.title')}</Text>
        <Text style={styles.intro}>{t('risk.intro')}</Text>
      </View>

      {data.topRisk === null ? (
        <View style={styles.calm}>
          <Text style={styles.calmText}>✅ {t('risk.calm')}</Text>
        </View>
      ) : null}

      {data.predictions.map((p) => (
        <RiskCard key={p.kind} p={p} t={t} />
      ))}

      <Button variant="ghost" label={t('app.tryAgain')} onPress={() => void load()} />
    </ScrollView>
  );
}

function RiskCard({ p, t }: { p: RiskPrediction; t: (k: TranslationKey) => string }) {
  const { colors: c } = useTokens();
  const styles = useMemo(() => makeStyles(c), [c]);
  const color = levelColor(c)[p.level];
  return (
    <View style={[styles.card, { borderLeftColor: color }]} testID={`risk-${p.kind}`}>
      <View style={styles.head}>
        <Text style={styles.icon}>{KIND_ICON[p.kind]}</Text>
        <Text style={styles.title}>{t(KIND_KEY[p.kind])}</Text>
        <View style={[styles.badge, { backgroundColor: color }]}>
          <Text style={styles.badgeText}>{p.probability}%</Text>
        </View>
      </View>

      {/* Probability gauge. */}
      <View style={styles.gaugeTrack}>
        <View style={[styles.gaugeFill, { width: `${p.probability}%`, backgroundColor: color }]} />
      </View>
      <Text style={[styles.level, { color }]}>{t(LEVEL_KEY[p.level])}</Text>

      <Text style={styles.rowLabel}>{t('risk.cause')}</Text>
      <Text style={styles.rowText}>{p.cause}</Text>

      <Text style={styles.rowLabel}>{t('risk.action')}</Text>
      <Text style={styles.rowText}>{p.action}</Text>

      {p.reasons.length > 0 ? (
        <>
          <Text style={styles.rowLabel}>{t('risk.why')}</Text>
          {p.reasons.map((r, i) => (
            <Text key={i} style={styles.reason}>
              • {r}
            </Text>
          ))}
        </>
      ) : null}
    </View>
  );
}

const makeStyles = (c: ColorScale) => StyleSheet.create({
  container: { padding: 20, gap: 12, maxWidth: 720, width: '100%', alignSelf: 'center' },
  masthead: { gap: 4, marginBottom: 2 },
  kicker: {
    fontSize: 13,
    fontWeight: '700',
    color: c.primary,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  intro: { fontSize: 15, color: c.textSecondary, lineHeight: 21 },
  calm: {
    backgroundColor: c.successSoft,
    borderRadius: 12,
    padding: 14,
  },
  calmText: { fontSize: 15, color: c.success, fontWeight: '600' },
  card: {
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    borderLeftWidth: 4,
    borderRadius: 12,
    padding: 14,
    gap: 6,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: { fontSize: 22 },
  title: { flex: 1, fontSize: 16, fontWeight: '700', color: c.textPrimary },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText: { fontSize: 13, fontWeight: '800', color: c.onColor },
  gaugeTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: c.border,
    overflow: 'hidden',
    marginTop: 2,
  },
  gaugeFill: { height: 8, borderRadius: 999 },
  level: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  rowLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: c.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 4,
  },
  rowText: { fontSize: 15, color: c.textPrimary, lineHeight: 21 },
  reason: { fontSize: 13, color: c.textSecondary, lineHeight: 19 },
});
