import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { RefreshControl, ScrollView, View } from 'react-native';
import type {
  ActionDestination,
  HomeOverview,
  HomeResumableSession,
  LearningDeletionPreview,
} from '@second-brain/shared';
import { resolveHomeComposition } from '@second-brain/shared';
import { useAuth } from '../../lib/auth-context';
import { api } from '../../lib/client';
import { useI18n } from '../../lib/i18n';
import { useTokens } from '../../lib/design/theme';
import { useResponsive } from '../../lib/responsive';
import { actionDestinationHref } from '../../lib/action-destination';
import { Alert, Button, Skeleton } from '../../components/ds/core';
import { Page } from '../../components/ds/layout';
import { SmartErrorState, SmartState } from '../../components/ds/states';
import {
  HomeContextHeader,
  MainGoalEmpty,
  MainGoalPreview,
  NextBestActionCard,
  ResumeSection,
} from '../../components/home/decision';
import { EvidenceProgressPanel } from '../../components/learning/evidence-progress';

/**
 * Accueil is a decision surface: one server-ranked next action, then continuity
 * and planning. Business priority stays on the API so every client sees the
 * same factual recommendation and the same explanation.
 */
export default function HomeScreen() {
  const { user } = useAuth();
  const { t, locale } = useI18n();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors: c, spacing } = useTokens();
  const { width } = useResponsive();
  const composition = resolveHomeComposition(width);
  const overviewQueryKey = ['home', 'overview', locale, user?.id] as const;
  const [deletingResumeId, setDeletingResumeId] = useState<string | null>(null);
  const [deletingGoalId, setDeletingGoalId] = useState<string | null>(null);
  const [deleteFailed, setDeleteFailed] = useState(false);

  const overview = useQuery<HomeOverview>({
    queryKey: overviewQueryKey,
    queryFn: ({ signal }) => api<HomeOverview>('/home/overview', { signal }),
    enabled: Boolean(user),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    retry: 1,
    placeholderData: (previous) => previous,
  });

  const open = (destination: ActionDestination) => {
    router.push(actionDestinationHref(destination) as never);
  };
  const resume = (session: HomeResumableSession) => open(session.destination);
  const invalidateLearningViews = async () => {
    await queryClient.invalidateQueries({
      predicate: ({ queryKey }) => [
        'home', 'calendar', 'goals', 'lessons', 'revision', 'recommendations',
        'brain', 'tutor', 'library', 'research', 'workspace',
      ].includes(String(queryKey[0] ?? '')),
    });
  };
  const previewResume = (session: HomeResumableSession) =>
    api<LearningDeletionPreview>(`/experience-sessions/${session.id}/deletion-preview`);
  const deleteResume = async (session: HomeResumableSession) => {
    if (deletingResumeId) return;
    setDeletingResumeId(session.id);
    setDeleteFailed(false);
    await queryClient.cancelQueries({ queryKey: overviewQueryKey });
    const previous = queryClient.getQueryData<HomeOverview>(overviewQueryKey);
    queryClient.setQueryData<HomeOverview>(overviewQueryKey, (current) => (
      current
        ? { ...current, resumableSessions: current.resumableSessions.filter((item) => item.id !== session.id) }
        : current
    ));
    try {
      await api(`/experience-sessions/${session.id}`, { method: 'DELETE' });
      await invalidateLearningViews();
    } catch {
      if (previous) queryClient.setQueryData(overviewQueryKey, previous);
      setDeleteFailed(true);
    } finally {
      setDeletingResumeId(null);
    }
  };
  const previewGoal = (goalId: string) =>
    api<LearningDeletionPreview>(`/goals/${goalId}/deletion-preview`);
  const deleteGoal = async (goalId: string) => {
    if (deletingGoalId) return;
    setDeletingGoalId(goalId);
    setDeleteFailed(false);
    await queryClient.cancelQueries({ queryKey: overviewQueryKey });
    const previous = queryClient.getQueryData<HomeOverview>(overviewQueryKey);
    queryClient.setQueryData<HomeOverview>(overviewQueryKey, (current) => current
      ? { ...current, mainGoal: current.mainGoal?.id === goalId ? null : current.mainGoal }
      : current);
    try {
      await api(`/goals/${goalId}`, { method: 'DELETE' });
      await invalidateLearningViews();
    } catch {
      if (previous) queryClient.setQueryData(overviewQueryKey, previous);
      setDeleteFailed(true);
    } finally {
      setDeletingGoalId(null);
    }
  };

  if (overview.isPending || !user) {
    return <HomeSkeleton />;
  }

  if (!overview.data) {
    return (
      <ScrollView style={{ flex: 1, backgroundColor: c.background }} contentContainerStyle={{ flexGrow: 1 }}>
        <Page width="wide">
          <SmartErrorState
            title={t('home4.unavailable')}
            retryable
            onRetry={() => { void overview.refetch(); }}
          />
        </Page>
      </ScrollView>
    );
  }

  const data = overview.data;
  const name = user.displayName?.trim().split(' ')[0] ?? '';
  const showSplit = composition !== 'single-column';
  const hasGoal = data.mainGoal !== null;

  const resumeSection = (
    <ResumeSection
      sessions={data.resumableSessions}
      onResume={resume}
      onDelete={(session) => { void deleteResume(session); }}
      onPreviewDelete={previewResume}
      deletingSessionId={deletingResumeId}
    />
  );
  const goalSection = data.mainGoal ? (
    <MainGoalPreview
      goal={data.mainGoal}
      onOpen={() => open(data.mainGoal!.destination)}
      onPreviewDelete={() => previewGoal(data.mainGoal!.id)}
      onDelete={() => { void deleteGoal(data.mainGoal!.id); }}
      deleting={deletingGoalId === data.mainGoal.id}
    />
  ) : (
    <MainGoalEmpty onCreate={() => router.push('/goals' as never)} />
  );
  const progressSection = (
    <EvidenceProgressPanel
      progress={data.evidenceProgress}
      compact
      onOpen={() => router.push('/brain' as never)}
    />
  );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.background }}
      contentContainerStyle={{ flexGrow: 1 }}
      refreshControl={(
        <RefreshControl
          refreshing={overview.isRefetching}
          onRefresh={() => { void overview.refetch(); }}
          tintColor={c.primary}
          colors={[c.primary]}
        />
      )}
    >
      <Page width="wide" style={{ gap: spacing.xl, paddingBottom: spacing.huge }} testID="home-decision-surface">
        <HomeContextHeader name={name} context={data.context} />

        {overview.error ? (
          <SmartState state="stale" detail={t('home4.stale')} />
        ) : data.partial ? (
          <SmartState state="partial" detail={t('home4.partial')} />
        ) : null}

        {deleteFailed ? (
          <Alert tone="error" title={t('state.error')} detail={t('home4.unavailable')} />
        ) : null}

        {data.nextBestAction ? (
          <NextBestActionCard action={data.nextBestAction} onOpen={() => open(data.nextBestAction!.primaryAction.destination)} />
        ) : (
          <Alert tone="warning" title={t('home4.unavailable')} detail={t('home4.partial')} />
        )}

        {resumeSection}
        <View style={{ alignItems: 'flex-start' }}>
          <Button
            testID="home-learning-calendar"
            label={t('home4.planning')}
            variant="secondary"
            onPress={() => router.push('/calendar' as never)}
          />
        </View>

        {showSplit && hasGoal ? (
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xl }}>
            <View style={{ flex: 1, minWidth: 0 }}>{goalSection}</View>
            <View style={{ flex: 1, minWidth: 0 }}>{progressSection}</View>
          </View>
        ) : (
          <>
            {goalSection}
            {progressSection}
          </>
        )}

      </Page>
    </ScrollView>
  );
}

function HomeSkeleton() {
  const { colors: c, spacing, radius } = useTokens();
  const { t } = useI18n();
  return (
    <ScrollView
      accessibilityLabel={t('home4.loading')}
      style={{ flex: 1, backgroundColor: c.background }}
      contentContainerStyle={{ flexGrow: 1 }}
    >
      <Page width="wide" style={{ gap: spacing.xl }}>
        <View style={{ gap: spacing.sm }}>
          <Skeleton height={36} width="45%" />
          <Skeleton height={20} width="65%" />
        </View>
        <View style={{ padding: spacing.lg, gap: spacing.md, borderRadius: radius.lg, backgroundColor: c.surface }}>
          <Skeleton height={20} width={150} />
          <Skeleton height={44} width="70%" />
          <Skeleton height={22} width="90%" />
          <Skeleton height={48} />
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg }}>
          <View style={{ flexGrow: 1, flexBasis: 320, gap: spacing.sm }}>
            <Skeleton height={28} width={190} />
            <Skeleton height={180} />
          </View>
          <View style={{ flexGrow: 1, flexBasis: 280, gap: spacing.sm }}>
            <Skeleton height={28} width={170} />
            <Skeleton height={180} />
          </View>
        </View>
      </Page>
    </ScrollView>
  );
}
