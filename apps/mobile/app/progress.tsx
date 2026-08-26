import { useCallback, useEffect, useState, useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { MentorBriefing, MentorOverview } from '@second-brain/shared';
import { api } from '../lib/client';
import { useTokens } from '../lib/design/theme';
import type { ColorScale } from '../lib/design/tokens';
import { useI18n } from '../lib/i18n';
import { Button, Card, ErrorBanner, Loading } from '../components/ui';

/** Progress: the Mentor's view. Every number here is measured, never flattered. */
export default function ProgressScreen() {
  const { colors: c } = useTokens();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { t } = useI18n();
  const [overview, setOverview] = useState<MentorOverview | null>(null);
  const [briefing, setBriefing] = useState<MentorBriefing | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setOverview(await api<MentorOverview>('/mentor'));
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const coach = async () => {
    setBusy(true);
    setError(null);
    try {
      setBriefing(await api<MentorBriefing>('/mentor/briefing', { method: 'POST' }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!overview && !error) return <Loading />;

  const s = overview?.stats;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {error ? <ErrorBanner message={error} /> : null}

      <View style={styles.streakRow}>
        <Stat label={t('progress.currentStreak')} value={`${overview?.streak.current ?? 0}`} unit={t('progress.days')} testID="streak-current" />
        <Stat label={t('progress.longest')} value={`${overview?.streak.longest ?? 0}`} unit={t('progress.days')} />
        <Stat label={t('progress.activeDays')} value={`${overview?.streak.totalActiveDays ?? 0}`} />
      </View>

      <Card>
        <Text style={styles.sectionTitle}>{t('progress.yourNumbers')}</Text>
        <Row label={t('progress.cardsReviewed')} value={`${s?.cardsReviewed ?? 0}`} />
        <Row
          label={t('progress.retention')}
          value={s?.retention === null || s?.retention === undefined ? t('progress.noReviews') : `${Math.round(s.retention * 100)}%`}
        />
        <Row label={t('progress.dueNow')} value={`${s?.dueNow ?? 0}`} />
        <Row label={t('progress.conceptsMastered')} value={`${s?.conceptsMastered ?? 0}`} />
        <Row label={t('progress.atRisk')} value={`${s?.atRiskConcepts ?? 0}`} />
        <Row label={t('progress.lessonsCompleted')} value={`${s?.lessonsCompleted ?? 0}`} />
        <Row label={t('progress.exercisesCorrect')} value={`${s?.exercisesCorrect ?? 0}`} />
      </Card>

      {overview?.achievements.length ? (
        <Card>
          <Text style={styles.sectionTitle}>{t('progress.milestones')}</Text>
          {overview.achievements.map((a) => (
            <View key={`${a.kind}-${a.threshold}`} style={styles.win}>
              <Text style={styles.winLabel}>{a.label}</Text>
              <Text style={styles.winDate}>
                {new Date(a.achievedAt).toLocaleDateString()}
              </Text>
            </View>
          ))}
        </Card>
      ) : null}

      <Button label={t('progress.askMentor')} onPress={coach} busy={busy} />

      {briefing ? (
        <Card testID="briefing">
          <Text style={styles.encouragement}>{briefing.encouragement}</Text>
          {briefing.strategies.map((strategy, i) => (
            <Text key={i} style={styles.strategy}>
              • {strategy}
            </Text>
          ))}
        </Card>
      ) : null}
    </ScrollView>
  );
}

function Stat({
  label,
  value,
  unit,
  testID,
}: {
  label: string;
  value: string;
  unit?: string;
  testID?: string;
}) {
  const { colors: c } = useTokens();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <Card style={styles.stat}>
      <Text style={styles.statValue} testID={testID}>
        {value}
      </Text>
      {unit ? <Text style={styles.statUnit}>{unit}</Text> : null}
      <Text style={styles.statLabel}>{label}</Text>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const { colors: c } = useTokens();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const makeStyles = (c: ColorScale) => StyleSheet.create({
  container: { padding: 20, gap: 12, maxWidth: 1280, width: '100%', alignSelf: 'center' },
  streakRow: { flexDirection: 'row', gap: 10 },
  stat: { flex: 1, alignItems: 'center', paddingVertical: 18 },
  statValue: { fontSize: 30, fontWeight: '700', color: c.warning },
  statUnit: { fontSize: 11, color: c.textMuted },
  statLabel: { fontSize: 12, color: c.textSecondary, marginTop: 6, textAlign: 'center' },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: c.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: c.border,
  },
  rowLabel: { color: c.textSecondary, fontSize: 15 },
  rowValue: { color: c.textPrimary, fontSize: 15, fontWeight: '600' },
  win: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: c.border,
  },
  winLabel: { color: c.textPrimary, fontSize: 15, fontWeight: '600' },
  winDate: { color: c.textMuted, fontSize: 13 },
  encouragement: { color: c.textPrimary, fontSize: 16, lineHeight: 24, marginBottom: 10 },
  strategy: { color: c.textSecondary, fontSize: 15, lineHeight: 22, marginTop: 6 },
});
