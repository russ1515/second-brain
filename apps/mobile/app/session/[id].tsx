import { useCallback, useEffect, useState, useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { SessionReport } from '@second-brain/shared';
import { api } from '../../lib/client';
import { useTokens } from '../../lib/design/theme';
import type { ColorScale } from '../../lib/design/tokens';
import { useI18n } from '../../lib/i18n';
import { Button, Card, ErrorBanner, Loading } from '../../components/ui';

/** The ordered stages the orchestrator drives — shown on both the Accueil
 *  (as the plan) and the recap (as the loop that just closed). */
const STAGE_KEYS = [
  'session.stageLesson',
  'session.stageQuestions',
  'session.stageExercises',
  'session.stageCorrection',
  'session.stageSummary',
  'session.stageFlashcards',
  'session.stageFsrs',
  'session.stageTwin',
] as const;

/**
 * Session Orchestrator hub (task 3.7). One screen, two phases:
 *  • Accueil — the AI's plan for the session, then "Commencer" into the lesson.
 *  • Fin de séance — after the lesson, it closes the loop (POST complete) and
 *    reports what moved: FSRS queue + Digital Twin / Learning Score delta.
 */
export default function SessionScreen() {
  const { colors: c } = useTokens();
  const styles = useMemo(() => makeStyles(c), [c]);
  const params = useLocalSearchParams<{
    id: string;
    lessonId?: string;
    subject?: string;
    planMessage?: string;
    minutes?: string;
    scoreBefore?: string;
    phase?: string;
  }>();
  const router = useRouter();
  const { t } = useI18n();
  const isEnd = params.phase === 'end';

  const [report, setReport] = useState<SessionReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const complete = useCallback(async () => {
    try {
      setReport(await api<SessionReport>(`/sessions/${params.id}/complete`, { method: 'POST' }));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [params.id]);

  useEffect(() => {
    if (isEnd) void complete();
  }, [isEnd, complete]);

  // ── Fin de séance ────────────────────────────────────────────────────────
  if (isEnd) {
    if (error && !report) {
      return (
        <ScrollView contentContainerStyle={styles.container}>
          <ErrorBanner message={error} />
          <Button variant="ghost" label={t('app.tryAgain')} onPress={() => void complete()} />
          <Button variant="ghost" label={t('session.home')} onPress={() => router.replace('/')} />
        </ScrollView>
      );
    }
    if (!report) return <Loading label={t('session.closing')} />;

    const delta = report.scoreDelta;
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.masthead}>
          <Text style={styles.kicker}>🎉 {t('session.done')}</Text>
          <Text style={styles.topic}>{report.subject}</Text>
        </View>

        {/* The loop the AI just drove, closed. */}
        <Card>
          <Text style={styles.cardTitle}>{t('session.whatWeDid')}</Text>
          {STAGE_KEYS.map((k) => (
            <View key={k} style={styles.stageRow}>
              <Text style={styles.stageCheck}>✓</Text>
              <Text style={styles.stageText}>{t(k)}</Text>
            </View>
          ))}
        </Card>

        {/* Digital Twin update — the measured result, not a claim. */}
        <Card style={styles.twinCard}>
          <Text style={styles.cardTitle}>🧠 {t('session.twinUpdate')}</Text>
          <View style={styles.scoreRow}>
            <ScoreBlock label={t('session.before')} value={report.learningScoreBefore} />
            <Text style={styles.arrow}>→</Text>
            <ScoreBlock label={t('session.after')} value={report.learningScoreAfter} highlight />
          </View>
          {delta !== null ? (
            <Text style={[styles.delta, delta >= 0 ? styles.deltaUp : styles.deltaDown]}>
              {delta >= 0 ? '▲ +' : '▼ '}
              {delta} {t('session.points')}
            </Text>
          ) : null}
          {report.conceptTracked && report.masteryAfter !== null ? (
            <Text style={styles.masteryLine}>
              {t('session.conceptMastery')} {report.masteryBefore ?? 0}% → {report.masteryAfter}%
            </Text>
          ) : (
            <Text style={styles.hint}>{t('session.nowTracked')}</Text>
          )}
        </Card>

        {/* FSRS queue + graded work. */}
        <Card>
          <Text style={styles.cardTitle}>📊 {t('session.results')}</Text>
          <Text style={styles.resultLine}>
            ✍️ {report.exercisesCorrect}/{report.exercisesAttempted} {t('session.exercisesRight')}
          </Text>
          <Text style={styles.resultLine}>
            🗂️ {report.cardsScheduled} {t('session.cardsScheduled')}
          </Text>
          {report.nextReviewInDays !== null ? (
            <Text style={styles.resultLine}>
              🔁 {t('session.nextReview')} {formatDue(report.nextReviewInDays, t)}
            </Text>
          ) : null}
        </Card>

        <Button label={t('session.reviewNow')} onPress={() => router.replace('/revision')} />
        <Button variant="ghost" label={t('session.home')} onPress={() => router.replace('/')} />
      </ScrollView>
    );
  }

  // ── Accueil ────────────────────────────────────────────────────────────────
  const minutes = params.minutes ? Number(params.minutes) : null;
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.masthead}>
        <Text style={styles.kicker}>👋 {t('session.welcome')}</Text>
        <Text style={styles.topic}>{params.subject ?? t('session.yourSession')}</Text>
      </View>

      <Card style={styles.planCard}>
        <Text style={styles.avatar}>🧑‍🏫</Text>
        <Text style={styles.planText}>{params.planMessage ?? t('session.defaultPlan')}</Text>
        {minutes ? (
          <View style={styles.metaChip}>
            <Text style={styles.metaChipText}>⏱️ ~{minutes} min</Text>
          </View>
        ) : null}
      </Card>

      <Card>
        <Text style={styles.cardTitle}>{t('session.thePlan')}</Text>
        {STAGE_KEYS.map((k, i) => (
          <View key={k} style={styles.stageRow}>
            <Text style={styles.stageNum}>{i + 1}</Text>
            <Text style={styles.stageText}>{t(k)}</Text>
          </View>
        ))}
      </Card>

      {params.lessonId ? (
        <Button
          label={t('session.start')}
          onPress={() =>
            router.replace(`/lesson/${params.lessonId}?session=${params.id}`)
          }
        />
      ) : (
        <ErrorBanner message={t('session.noLesson')} />
      )}
      <Button variant="ghost" label={t('session.home')} onPress={() => router.replace('/')} />
    </ScrollView>
  );
}

function ScoreBlock({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number | null;
  highlight?: boolean;
}) {
  const { colors: c } = useTokens();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <View style={styles.scoreBlock}>
      <Text style={styles.scoreLabel}>{label}</Text>
      <Text style={[styles.scoreValue, highlight && styles.scoreValueHi]}>
        {value === null ? '—' : value}
      </Text>
    </View>
  );
}

function formatDue(days: number, t: (k: 'session.today' | 'session.inDays' | 'session.tomorrow') => string): string {
  if (days <= 0) return t('session.today');
  if (days === 1) return t('session.tomorrow');
  return `${days} ${t('session.inDays')}`;
}

const makeStyles = (c: ColorScale) => StyleSheet.create({
  container: { padding: 20, gap: 14, maxWidth: 960, width: '100%', alignSelf: 'center' },
  masthead: { gap: 4 },
  kicker: {
    fontSize: 13,
    fontWeight: '700',
    color: c.primary,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  topic: { fontSize: 26, fontWeight: '800', color: c.textPrimary, lineHeight: 32 },
  planCard: { gap: 10, alignItems: 'flex-start' },
  avatar: { fontSize: 34 },
  planText: { fontSize: 16, color: c.textPrimary, lineHeight: 24 },
  metaChip: {
    backgroundColor: c.surfaceElevated,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  metaChipText: { fontSize: 13, color: c.textSecondary, fontWeight: '600' },
  cardTitle: { fontSize: 16, fontWeight: '700', color: c.textPrimary, marginBottom: 10 },
  stageRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 5 },
  stageNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: c.surfaceElevated,
    color: c.primary,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 24,
  },
  stageCheck: {
    width: 24,
    fontSize: 15,
    fontWeight: '800',
    color: c.success,
    textAlign: 'center',
  },
  stageText: { flex: 1, fontSize: 15, color: c.textPrimary },
  twinCard: { borderColor: c.primary },
  scoreRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16 },
  scoreBlock: { alignItems: 'center', gap: 2 },
  scoreLabel: {
    fontSize: 11,
    color: c.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: '700',
  },
  scoreValue: { fontSize: 34, fontWeight: '800', color: c.textSecondary },
  scoreValueHi: { color: c.textPrimary },
  arrow: { fontSize: 24, color: c.textMuted },
  delta: { textAlign: 'center', fontSize: 15, fontWeight: '700', marginTop: 8 },
  deltaUp: { color: c.success },
  deltaDown: { color: c.warning },
  masteryLine: { textAlign: 'center', color: c.textSecondary, fontSize: 14, marginTop: 8 },
  hint: { textAlign: 'center', color: c.textMuted, fontSize: 13, marginTop: 8 },
  resultLine: { fontSize: 15, color: c.textPrimary, lineHeight: 26 },
});
