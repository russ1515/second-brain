import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { DnaConfidenceBand, DnaTrait, DnaTraitKey, LearningDna } from '@second-brain/shared';
import { useApiQuery } from '../lib/query';
import { useTokens } from '../lib/design/theme';
import type { ColorScale } from '../lib/design/tokens';
import { useI18n, type TranslationKey } from '../lib/i18n';
import { Button, Card, ErrorBanner, Loading } from '../components/ui';

const TRAIT_ICON: Record<DnaTraitKey, string> = {
  memory: '🧠',
  peakTime: '⏰',
  modality: '🎨',
  explanation: '💡',
  retentionFormat: '📼',
};

const TRAIT_KEY: Record<DnaTraitKey, TranslationKey> = {
  memory: 'dna.trait.memory',
  peakTime: 'dna.trait.peakTime',
  modality: 'dna.trait.modality',
  explanation: 'dna.trait.explanation',
  retentionFormat: 'dna.trait.retentionFormat',
};

const BAND_KEY: Record<DnaConfidenceBand, TranslationKey> = {
  emerging: 'dna.band.emerging',
  forming: 'dna.band.forming',
  established: 'dna.band.established',
};

const bandColor = (c: ColorScale): Record<DnaConfidenceBand, string> => ({
  emerging: c.textMuted,
  forming: c.warning,
  established: c.success,
});

/**
 * 🧬 Learning DNA (Sprint 9 ⭐). The learner's deep, stable profile of HOW they
 * learn best — memory, peak time, modality, explanation depth, best-retention
 * format — built progressively, each trait firming up as evidence grows.
 */
export default function LearningDnaScreen() {
  const { colors: c } = useTokens();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { t } = useI18n();
  // TanStack Query (Sprint 10.1): dedup + 30s staleTime — revisiting the screen
  // within the window is instant, no refetch, no boilerplate.
  const { data, error, refetch } = useApiQuery<LearningDna>(['learning-dna'], '/learning-dna');

  if (error && !data) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <ErrorBanner message={(error as Error).message} />
        <Button variant="ghost" label={t('app.tryAgain')} onPress={() => void refetch()} />
      </ScrollView>
    );
  }
  if (!data) return <Loading label={t('dna.loading')} />;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.masthead}>
        <Text style={styles.kicker}>🧬 {t('dna.title')}</Text>
        <Text style={styles.intro}>{t('dna.intro')}</Text>
      </View>

      {/* Maturity — how completely the DNA is mapped (grows over time). */}
      <Card style={styles.maturityCard}>
        <Text style={styles.maturityLabel}>{t('dna.maturity')}</Text>
        <Text style={styles.maturityValue}>{data.maturity}%</Text>
        <View style={styles.maturityTrack}>
          <View style={[styles.maturityFill, { width: `${data.maturity}%` }]} />
        </View>
        <Text style={styles.maturityMeta}>
          {data.interactions} {t('dna.interactions')}
        </Text>
      </Card>

      {data.traits.map((tr) => (
        <TraitCard key={tr.key} tr={tr} t={t} />
      ))}

      <Button variant="ghost" label={t('app.tryAgain')} onPress={() => void refetch()} />
    </ScrollView>
  );
}

function TraitCard({ tr, t }: { tr: DnaTrait; t: (k: TranslationKey) => string }) {
  const { colors: c } = useTokens();
  const styles = useMemo(() => makeStyles(c), [c]);
  const color = bandColor(c)[tr.band];
  return (
    <Card style={styles.card} testID={`dna-${tr.key}`}>
      <View style={styles.head}>
        <Text style={styles.icon}>{TRAIT_ICON[tr.key]}</Text>
        <View style={styles.headText}>
          <Text style={styles.traitName}>{t(TRAIT_KEY[tr.key])}</Text>
          <Text style={styles.label}>{tr.label}</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: color }]}>
          <Text style={styles.badgeText}>{t(BAND_KEY[tr.band])}</Text>
        </View>
      </View>
      <Text style={styles.summary}>{tr.summary}</Text>
      <View style={styles.confTrack}>
        <View style={[styles.confFill, { width: `${tr.confidence}%`, backgroundColor: color }]} />
      </View>
    </Card>
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
  maturityCard: { alignItems: 'center', gap: 6 },
  maturityLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: c.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  maturityValue: { fontSize: 40, fontWeight: '800', color: c.primary },
  maturityTrack: {
    height: 8,
    width: '100%',
    borderRadius: 999,
    backgroundColor: c.border,
    overflow: 'hidden',
  },
  maturityFill: { height: 8, borderRadius: 999, backgroundColor: c.primary },
  maturityMeta: { fontSize: 12, color: c.textSecondary },
  card: { gap: 8 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: { fontSize: 22 },
  headText: { flex: 1, gap: 1 },
  traitName: {
    fontSize: 11,
    fontWeight: '700',
    color: c.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  label: { fontSize: 16, fontWeight: '700', color: c.textPrimary },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText: { fontSize: 10, fontWeight: '800', color: c.onColor, textTransform: 'uppercase' },
  summary: { fontSize: 14, color: c.textSecondary, lineHeight: 20 },
  confTrack: { height: 6, borderRadius: 999, backgroundColor: c.border, overflow: 'hidden' },
  confFill: { height: 6, borderRadius: 999 },
});
