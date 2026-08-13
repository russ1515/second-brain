import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { LearnerProfile } from '@second-brain/shared';
import { api } from '../lib/client';
import { theme } from '../lib/theme';
import { useI18n, type TranslationKey } from '../lib/i18n';
import { Button, Card, ErrorBanner, Loading } from '../components/ui';

/**
 * Digital Twin — the learner's behavioural profile (task 4.1).
 *
 * Nine dimensions, each derived from real interaction data. A dimension with no
 * evidence yet shows "not enough data" rather than a fabricated trait, and the
 * whole profile refreshes on every open — it evolves after each interaction.
 */
export default function TwinProfileScreen() {
  const { t } = useI18n();
  const [profile, setProfile] = useState<LearnerProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setProfile(await api<LearnerProfile>('/twin/profile'));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (error && !profile) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <ErrorBanner message={error} />
        <Button variant="ghost" label={t('app.tryAgain')} onPress={() => void load()} />
      </ScrollView>
    );
  }
  if (!profile) return <Loading label={t('twin.loading')} />;

  const p = profile;
  const none = t('twin.notEnough');
  const dims: { icon: string; label: string; value: string }[] = [
    { icon: '📊', label: t('twin.level'), value: `${t(BAND_KEY[p.level.band])}${p.level.score !== null ? ` · ${p.level.score}%` : ''}` },
    { icon: '⚡', label: t('twin.speed'), value: p.learningSpeed ? t(SPEED_KEY[p.learningSpeed]) : none },
    { icon: '📚', label: t('twin.subjects'), value: p.preferredSubjects.length ? p.preferredSubjects.join(', ') : none },
    { icon: '🎨', label: t('twin.style'), value: p.learningStyle ? t(STYLE_KEY[p.learningStyle]) : none },
    { icon: '🔍', label: t('twin.depth'), value: p.explanationDepth ? t(DEPTH_KEY[p.explanationDepth]) : none },
    { icon: '🗣️', label: t('twin.language'), value: p.preferredLanguage ?? none },
    { icon: '📅', label: t('twin.rhythm'), value: p.workRhythm ? t(RHYTHM_KEY[p.workRhythm]) : none },
    { icon: '🕐', label: t('twin.focus'), value: p.focusWindow ? t(FOCUS_KEY[p.focusWindow]) : none },
  ];

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.masthead}>
        <Text style={styles.kicker}>👥 {t('twin.title')}</Text>
        <Text style={styles.intro}>{t('twin.intro')}</Text>
      </View>

      {/* Overall progress — the headline. */}
      <Card style={styles.progressCard}>
        <Text style={styles.progressLabel}>{t('twin.progress')}</Text>
        <Text style={styles.progressScore}>
          {p.overallProgress.score === null ? '—' : `${p.overallProgress.score}`}
          {p.overallProgress.score !== null ? <Text style={styles.progressUnit}> / 100</Text> : null}
        </Text>
        <Text style={styles.progressMeta}>
          {p.overallProgress.conceptsTracked} {t('twin.conceptsTracked')} · {p.overallProgress.lessons} {t('twin.lessons')}
        </Text>
      </Card>

      <View style={styles.grid}>
        {dims.map((d) => (
          <View key={d.label} style={styles.dim}>
            <Text style={styles.dimIcon}>{d.icon}</Text>
            <Text style={styles.dimLabel}>{d.label}</Text>
            <Text style={styles.dimValue}>{d.value}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.foot}>
        {t('twin.evolves')} · {p.interactions} {t('twin.interactions')}
      </Text>
      <Button variant="ghost" label={t('app.tryAgain')} onPress={() => void load()} />
    </ScrollView>
  );
}

const BAND_KEY = {
  new: 'twin.band.new',
  weak: 'twin.band.weak',
  building: 'twin.band.building',
  strong: 'twin.band.strong',
} as const satisfies Record<LearnerProfile['level']['band'], TranslationKey>;
const SPEED_KEY = {
  building: 'twin.speed.building',
  steady: 'twin.speed.steady',
  fast: 'twin.speed.fast',
} as const satisfies Record<NonNullable<LearnerProfile['learningSpeed']>, TranslationKey>;
const STYLE_KEY = {
  voice: 'twin.style.voice',
  handsOn: 'twin.style.handsOn',
  reading: 'twin.style.reading',
} as const satisfies Record<NonNullable<LearnerProfile['learningStyle']>, TranslationKey>;
const DEPTH_KEY = {
  simple: 'twin.depth.simple',
  balanced: 'twin.depth.balanced',
  deep: 'twin.depth.deep',
} as const satisfies Record<NonNullable<LearnerProfile['explanationDepth']>, TranslationKey>;
const RHYTHM_KEY = {
  occasional: 'twin.rhythm.occasional',
  regular: 'twin.rhythm.regular',
  intensive: 'twin.rhythm.intensive',
} as const satisfies Record<NonNullable<LearnerProfile['workRhythm']>, TranslationKey>;
const FOCUS_KEY = {
  morning: 'twin.focus.morning',
  afternoon: 'twin.focus.afternoon',
  evening: 'twin.focus.evening',
  night: 'twin.focus.night',
} as const satisfies Record<NonNullable<LearnerProfile['focusWindow']>, TranslationKey>;

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
  progressCard: { alignItems: 'center', gap: 2, borderColor: theme.accent },
  progressLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.textFaint,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  progressScore: { fontSize: 44, fontWeight: '800', color: theme.text },
  progressUnit: { fontSize: 18, fontWeight: '600', color: theme.textFaint },
  progressMeta: { fontSize: 13, color: theme.textMuted },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  dim: {
    flexGrow: 1,
    flexBasis: '46%',
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 12,
    padding: 14,
    gap: 4,
  },
  dimIcon: { fontSize: 22 },
  dimLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.textFaint,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  dimValue: { fontSize: 16, fontWeight: '600', color: theme.text },
  foot: { fontSize: 12, color: theme.textFaint, textAlign: 'center', marginTop: 4 },
});
