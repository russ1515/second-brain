import { useCallback, useState, type ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import type {
  DailyPlanItemView,
  DailyPlanView,
  ExamView,
  InitiativeView,
  LearningPath,
  LearningPathItem,
  LessonSummary,
  MentorOverview,
  OnboardingState,
  ProactiveBriefing,
  StudyRecommendation,
} from '@second-brain/shared';
import { useAuth } from '../../lib/auth-context';
import { api } from '../../lib/client';
import { enqueue } from '../../lib/offline';
import { useI18n } from '../../lib/i18n';
import { useTokens } from '../../lib/design/theme';
import { useResponsive } from '../../lib/responsive';
import { Skeleton } from '../../components/ds/core';
import { homePersona } from '../../lib/home/persona';
import {
  BlockError,
  CapacityBar,
  ContinueLearning,
  DailyPlan,
  HeroBriefing,
  MasterySnapshot,
  NextBestAction,
  ProactiveState,
  ProgressWeek,
  QuickCapture,
  Recommendations,
  StreakStrip,
  UpcomingExams,
  type HomeContext,
} from '../../components/home/blocks';

/**
 * 🏠 Home — the daily control hub (UI/UX Sprint 3).
 *
 * Rebuilt on the Sprint 1 design system and personalised by the Sprint 2 KYC.
 * It is NOT a wall of statistics: it opens with what the AI teacher recommends
 * NOW and WHY, then the day's plan, then progress, then secondary signals — the
 * strict information hierarchy (3.15). Every block is fed by an existing engine
 * (journey, coach, mentor, twin, exams); `allSettled` keeps one dead endpoint
 * from blanking the board, and each block states its empty case honestly.
 */
export default function HomeScreen() {
  const { user } = useAuth();
  const { t } = useI18n();
  const { colors: c } = useTokens();
  const { width, maxContentWidth } = useResponsive();
  const router = useRouter();

  const [plan, setPlan] = useState<DailyPlanView | null>(null);
  const [mentor, setMentor] = useState<MentorOverview | null>(null);
  const [lastLesson, setLastLesson] = useState<LessonSummary | null>(null);
  const [coach, setCoach] = useState<ProactiveBriefing | null>(null);
  const [initiatives, setInitiatives] = useState<InitiativeView[]>([]);
  const [path, setPath] = useState<LearningPath | null>(null);
  const [exams, setExams] = useState<ExamView[]>([]);
  const [kyc, setKyc] = useState<OnboardingState | null>(null);
  const [failed, setFailed] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    if (mode === 'refresh') setRefreshing(true);
    const results = await Promise.allSettled([
      api<DailyPlanView>('/journey/today'),
      api<MentorOverview>('/mentor'),
      api<LessonSummary[]>('/lessons'),
      api<ProactiveBriefing>('/coach/today'),
      api<InitiativeView[]>('/proactive'),
      api<LearningPath>('/twin/next'),
      api<ExamView[]>('/exams'),
      api<OnboardingState>('/onboarding'),
    ]);
    const [planR, mentorR, lessonsR, coachR, initR, pathR, examsR, kycR] = results;
    const fail = new Set<string>();
    if (planR.status === 'fulfilled') setPlan(planR.value); else fail.add('plan');
    if (mentorR.status === 'fulfilled') setMentor(mentorR.value); else fail.add('mentor');
    if (lessonsR.status === 'fulfilled') setLastLesson(lessonsR.value[0] ?? null); else fail.add('lesson');
    if (coachR.status === 'fulfilled') setCoach(coachR.value); else fail.add('coach');
    if (initR.status === 'fulfilled') setInitiatives(initR.value); else fail.add('initiatives');
    if (pathR.status === 'fulfilled') setPath(pathR.value); else fail.add('path');
    if (examsR.status === 'fulfilled') setExams(examsR.value); else fail.add('exams');
    if (kycR.status === 'fulfilled') setKyc(kycR.value); else fail.add('kyc');
    setFailed(fail);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (user) void load();
    }, [user, load]),
  );

  const name = user?.displayName?.trim() || user?.email?.split('@')[0] || '';
  const persona = homePersona(kyc?.answers.education?.category ?? null);

  // ── derived signals (no new logic — all from the fetched engine data) ──────
  const context = computeContext({ lastLesson, plan, mentor, exams });
  const nbaItem =
    path?.items.find((i) => i.status === 'at_risk') ??
    path?.items.find((i) => i.status === 'in_progress') ??
    path?.items.find((i) => i.status === 'ready') ??
    null;
  const capacityMinutes = (coach?.recommendations ?? []).reduce((s, r) => s + r.minutes, 0);

  // ── routing (Home is an entry point; it routes INTO Learn/Study, 3.21) ─────
  const openItem = (item: DailyPlanItemView) => {
    if (['review', 'quick_revision', 'vocabulary'].includes(item.kind)) return router.push('/revision');
    router.push({ pathname: '/lesson/new', params: { conceptId: item.conceptId ?? '', title: item.title } });
  };
  const startNba = (item: LearningPathItem | null) => {
    if (!item) return router.push('/revision');
    if (item.status === 'at_risk' || item.status === 'in_progress') return router.push('/revision');
    router.push({ pathname: '/lesson/new', params: { conceptId: item.conceptId, title: item.name } });
  };
  const openRecommendation = (r: StudyRecommendation) => {
    if (r.kind === 'review' || r.kind === 'vocabulary') return router.push('/revision');
    router.push({ pathname: '/lesson/new', params: { conceptId: r.conceptId ?? '', title: r.activity } });
  };
  const respondInitiative = async (id: string, action: 'act' | 'dismiss') => {
    setInitiatives((prev) => prev.filter((i) => i.id !== id));
    await enqueue({
      method: 'POST',
      path: `/proactive/${id}/${action}`,
      label: action === 'act' ? 'Accepted a suggestion' : 'Dismissed a suggestion',
    });
  };
  // Universal input (3.11): Home routes into the teacher / scan / library — it
  // never becomes the library itself.
  const captureText = (text: string) =>
    router.push({ pathname: '/tutor', params: { q: text } });
  const captureSpeak = () => router.push('/tutor');
  const captureScan = () => router.push('/scan');
  const captureImport = () => router.push('/library');

  const wide = width >= 760;

  if (loading) return <HomeSkeleton maxWidth={maxContentWidth} />;

  // Two-column pairing on wide screens (3.16); stacked on mobile (3.17).
  const Pair = ({ a, b }: { a: ReactNode; b: ReactNode }) =>
    wide ? (
      <View style={{ flexDirection: 'row', gap: 14 }}>
        <View style={{ flex: 1 }}>{a}</View>
        <View style={{ flex: 1 }}>{b}</View>
      </View>
    ) : (
      <>
        {a}
        {b}
      </>
    );

  return (
    <ScrollView
      contentContainerStyle={[styles.container, { maxWidth: maxContentWidth }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load('refresh')} tintColor={c.textMuted} />}
    >
      {/* Level 1 — the teacher's briefing + the one action */}
      {failed.has('coach') && failed.has('mentor') ? (
        <BlockError onRetry={() => load('refresh')} />
      ) : (
        <HeroBriefing
          name={name}
          context={context}
          coach={coach}
          onStart={() => router.push('/daily-session')}
          onDetail={() => router.push('/progress')}
        />
      )}

      {failed.has('path') ? <BlockError onRetry={() => load('refresh')} /> : <NextBestAction item={nbaItem} onStart={startNba} />}

      {/* Universal input — the daily door into learning */}
      <QuickCapture persona={persona} onText={captureText} onSpeak={captureSpeak} onScan={captureScan} onImport={captureImport} />

      {/* Level 1.5 — the AI took the initiative */}
      <ProactiveState initiatives={initiatives} onAct={(id) => respondInitiative(id, 'act')} onDismiss={(id) => respondInitiative(id, 'dismiss')} />

      {/* Level 3 — the programme */}
      <Pair
        a={failed.has('plan') ? <BlockError onRetry={() => load('refresh')} /> : <DailyPlan plan={plan} onOpen={openItem} />}
        b={failed.has('lesson') ? <BlockError onRetry={() => load('refresh')} /> : <ContinueLearning lesson={lastLesson} onOpen={() => lastLesson && router.push(`/lesson/${lastLesson.id}`)} />}
      />

      {capacityMinutes > 0 ? <CapacityBar minutes={capacityMinutes} /> : null}

      {/* Level 4 — progression */}
      {failed.has('mentor') ? <BlockError onRetry={() => load('refresh')} /> : <ProgressWeek mentor={mentor} />}
      <StreakStrip mentor={mentor} />

      {/* Level 5 — secondary signals; order tuned by the KYC persona */}
      <Pair
        a={persona.showMastery ? <MasterySnapshot items={path?.items ?? []} /> : <View />}
        b={persona.exams !== 'hidden' ? <UpcomingExams exams={exams} onPlan={() => router.push('/exams')} /> : <View />}
      />

      <Recommendations recs={coach?.recommendations ?? []} onAct={openRecommendation} />

      <Text style={{ color: c.textMuted, fontSize: 12, textAlign: 'center', marginTop: 4 }}>
        {plan ? new Date(`${plan.date}T00:00:00Z`).toDateString() : ''}
      </Text>
    </ScrollView>
  );
}

/** The opening context (3.13) — derived from real signals, never random. */
function computeContext({
  lastLesson,
  plan,
  mentor,
  exams,
}: {
  lastLesson: LessonSummary | null;
  plan: DailyPlanView | null;
  mentor: MentorOverview | null;
  exams: ExamView[];
}): HomeContext {
  const hasHistory = (mentor?.stats.cardsReviewed ?? 0) > 0 || !!lastLesson;
  if (!hasHistory && (plan?.items.length ?? 0) === 0) return 'new';
  if ((mentor?.newlyEarned?.length ?? 0) > 0) return 'success';
  if (exams.some((e) => e.daysUntil >= 0 && e.daysUntil <= 10)) return 'exam';
  if ((mentor?.stats.atRiskConcepts ?? 0) > 0 || (mentor?.stats.dueNow ?? 0) >= 5) return 'revision';
  if ((mentor?.streak.current ?? 0) === 0 && hasHistory) return 'inactive';
  return 'active';
}

/** Block-level loading (3.19): the shape of the board, not a spinner. */
function HomeSkeleton({ maxWidth }: { maxWidth: number }) {
  return (
    <ScrollView contentContainerStyle={[styles.container, { maxWidth }]}>
      <Skeleton height={150} />
      <Skeleton height={120} />
      <Skeleton height={90} />
      <Skeleton height={110} />
      <Skeleton height={90} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    gap: 14,
    width: '100%',
    alignSelf: 'center',
    paddingBottom: 48,
  },
});
