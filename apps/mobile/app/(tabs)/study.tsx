import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import type {
  ExamView,
  LearningCategory,
  LearningPath,
  LearningPredictionView,
  OnboardingState,
  ReviewStats,
} from '@second-brain/shared';
import { api } from '../../lib/client';
import { useAuth } from '../../lib/auth-context';
import { useTokens } from '../../lib/design/theme';
import { useResponsive } from '../../lib/responsive';
import { Skeleton } from '../../components/ds/core';
import {
  dueBreakdown,
  estimateMinutes,
  priorityOf,
  retentionOf,
  reviewPersona,
  todayWhy,
  type Priority,
  type RetentionState,
} from '../../lib/review/catalog';
import {
  AutoExtractCard,
  DueCounter,
  ExamRiskAlert,
  ForgettingCurve,
  QuickLaunch,
  ReviewStatsStrip,
  SessionComplete,
} from '../../components/review/components';
import {
  ConceptsToConsolidate,
  EmptyReview,
  RetentionMap,
  RevisionPlanner,
  TodayBriefing,
  WatchList,
} from '../../components/review/advanced';

/**
 * 📅 Réviser — the FSRS revision workspace (UI/UX Sprint 6, full spec).
 *
 * Five zones: Aujourd'hui (personalised briefing + the teacher's why), Concepts
 * à consolider, Smart Cards (launch), Progression de rétention (memory map +
 * watch list + forgetting curve + exam risk), and Planning des prochaines
 * révisions. Reads the EXISTING FSRS (/review/stats) + twin (/twin/next) +
 * prediction (/foresight) engines and adapts to the KYC persona — no scheduling
 * logic here. Honest states: first-use build, urgent, and an un-guilty "tout est
 * à jour".
 */
export default function StudyScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const { colors: c } = useTokens();
  const { maxContentWidth } = useResponsive();

  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [foresight, setForesight] = useState<LearningPredictionView | null>(null);
  const [path, setPath] = useState<LearningPath | null>(null);
  const [exams, setExams] = useState<ExamView[]>([]);
  const [category, setCategory] = useState<LearningCategory | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [s, f, p, e, k] = await Promise.allSettled([
      api<ReviewStats>('/review/stats'),
      api<LearningPredictionView>('/foresight'),
      api<LearningPath>('/twin/next'),
      api<ExamView[]>('/exams'),
      api<OnboardingState>('/onboarding'),
    ]);
    if (s.status === 'fulfilled') setStats(s.value);
    if (f.status === 'fulfilled') setForesight(f.value);
    if (p.status === 'fulfilled') setPath(p.value);
    if (e.status === 'fulfilled') setExams(e.value);
    if (k.status === 'fulfilled') setCategory(k.value.answers.education?.category ?? undefined);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { if (user) void load(); }, [user, load]));

  const persona = reviewPersona(category ?? null);
  const name = user?.displayName?.trim().split(' ')[0] || '';
  const forgettingRisk = foresight?.predictions.find((p) => p.kind === 'forgetting') ?? null;
  const launch = (mode: 'flash' | 'full') => router.push({ pathname: '/revision', params: { mode } });
  const items = path?.items ?? [];

  if (loading) return <StudySkeleton maxWidth={maxContentWidth} />;

  const counts = stats ? dueBreakdown(stats) : { critical: 0, regular: 0, fresh: 0 };
  const hasCards = !!stats && stats.due + stats.new + stats.learning + stats.review + stats.relearning + stats.reviewsToday > 0;
  const allCaughtUp = !!stats && stats.due === 0 && hasCards;

  // First-use empty build (task 9): no FSRS cards and no twin concepts yet.
  if (!hasCards && items.length === 0) {
    return (
      <ScrollView contentContainerStyle={[styles.container, { maxWidth: maxContentWidth }]}>
        <Header intro={persona.intro} />
        <EmptyReview onStart={() => router.push('/learn')} />
      </ScrollView>
    );
  }

  // Derived twin data for the zones.
  const consolidate = items
    .filter((i) => i.status === 'at_risk' || i.status === 'blocked' || (i.mastery != null && i.mastery < 0.65))
    .map((i) => ({ id: i.conceptId, name: i.name, priority: priorityOf(i.status, i.mastery) }));
  const retentionCounts = items.reduce(
    (acc, i) => { acc[retentionOf(i.status, i.dueCount)] += 1; return acc; },
    { solid: 0, progressing: 0, fragile: 0, urgent: 0 } as Record<RetentionState, number>,
  );
  const watch = items
    .filter((i) => i.status === 'at_risk')
    .slice(0, 4)
    .map((i) => ({ id: i.conceptId, name: i.name, when: 'demain', minutes: estimateMinutes(Math.max(3, i.dueCount || 3)) }));
  const todayPlan = items.filter((i) => i.dueCount > 0).map((i) => ({ id: i.conceptId, name: i.name, priority: priorityOf(i.status, i.mastery) as Priority }));
  const tomorrowPlan = items.filter((i) => i.status === 'in_progress' || i.status === 'at_risk').map((i) => ({ id: i.conceptId, name: i.name, priority: priorityOf(i.status, i.mastery) as Priority }));
  const keyDates = exams.filter((e) => e.daysUntil >= 0).sort((a, b) => a.daysUntil - b.daysUntil).slice(0, 4)
    .map((e) => ({ id: e.id, label: e.subject, when: e.daysUntil === 0 ? 'aujourd’hui' : `dans ${e.daysUntil} j` }));

  return (
    <ScrollView contentContainerStyle={[styles.container, { maxWidth: maxContentWidth }]}>
      <Header intro={persona.intro} />

      {/* ZONE 1 — Aujourd'hui, OR an un-guilty "all caught up" */}
      {allCaughtUp ? (
        <SessionComplete reviewed={stats!.reviewsToday} onDone={() => router.push('/learn')} />
      ) : (
        <TodayBriefing
          name={name}
          counts={counts}
          minutes={estimateMinutes(stats?.due ?? 0)}
          why={todayWhy(stats!)}
          onStart={() => launch('full')}
        />
      )}

      {/* ZONE 2 — Concepts à consolider */}
      <ConceptsToConsolidate concepts={consolidate} onReview={() => router.push('/revision')} />

      {/* ZONE 3 — Smart Cards (launch + breakdown) */}
      <View style={{ gap: 10 }}>
        <SectionLabel>Smart Cards</SectionLabel>
        <QuickLaunch due={stats?.due ?? 0} onLaunch={(o) => launch(o.key)} />
        <DueCounter counts={counts} onPick={() => router.push('/revision')} />
        <ReviewStatsStrip reviewsToday={stats?.reviewsToday ?? 0} retention={stats?.retention ?? null} />
      </View>

      {/* ZONE 4 — Progression de rétention */}
      <View style={{ gap: 10 }}>
        <RetentionMap counts={retentionCounts} />
        <WatchList items={watch} onReview={() => router.push('/revision')} />
        {persona.analytic || forgettingRisk ? <ForgettingCurve retention={stats?.retention ?? null} /> : null}
        {forgettingRisk ? <ExamRiskAlert risk={forgettingRisk} onReview={() => router.push('/revision')} /> : null}
      </View>

      {/* ZONE 5 — Planning des prochaines révisions */}
      <RevisionPlanner today={todayPlan} tomorrow={tomorrowPlan} keyDates={keyDates} />

      <AutoExtractCard onExtract={() => router.push('/library')} />

      <Text style={{ color: c.textMuted, fontSize: 12, textAlign: 'center', marginTop: 4 }}>{persona.encourage}</Text>
    </ScrollView>
  );

  function Header({ intro }: { intro: string }) {
    return (
      <View style={{ gap: 4 }}>
        <Text style={{ color: c.textPrimary, fontSize: 30, fontWeight: '800' }}>📅 Réviser</Text>
        <Text style={{ color: c.textSecondary, fontSize: 15, lineHeight: 22 }}>{intro}</Text>
      </View>
    );
  }
  function SectionLabel({ children }: { children: string }) {
    return <Text style={{ color: c.textMuted, fontSize: 12, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' }}>{children}</Text>;
  }
}

function StudySkeleton({ maxWidth }: { maxWidth: number }) {
  return (
    <ScrollView contentContainerStyle={[styles.container, { maxWidth }]}>
      <Skeleton height={40} width="50%" />
      <Skeleton height={150} />
      <Skeleton height={110} />
      <Skeleton height={140} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 16, width: '100%', alignSelf: 'center', paddingBottom: 48 },
});
