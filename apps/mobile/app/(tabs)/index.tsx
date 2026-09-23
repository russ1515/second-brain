import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { RefreshControl, ScrollView, View } from 'react-native';
import type {
  ActionDestination,
  HomeOverview,
  HomeResumableSession,
  HomeUpcomingItem,
} from '@second-brain/shared';
import { resolveHomeComposition } from '@second-brain/shared';
import { useAuth } from '../../lib/auth-context';
import { api } from '../../lib/client';
import { useI18n } from '../../lib/i18n';
import { useTokens } from '../../lib/design/theme';
import { useResponsive } from '../../lib/responsive';
import { actionDestinationHref } from '../../lib/action-destination';
import { Alert, Skeleton } from '../../components/ds/core';
import { Page } from '../../components/ds/layout';
import { SmartErrorState, SmartState } from '../../components/ds/states';
import {
  HomeContextHeader,
  HomeQuickActions,
  MainGoalPreview,
  NextBestActionCard,
  ProgressSummary,
  ResumeSection,
  UpcomingSection,
} from '../../components/home/decision';

/**
 * Accueil is a decision surface: one server-ranked next action, then continuity
 * and planning. Business priority stays on the API so every client sees the
 * same factual recommendation and the same explanation.
 */
export default function HomeScreen() {
  const { user } = useAuth();
  const { t, locale } = useI18n();
  const router = useRouter();
  const { colors: c, spacing } = useTokens();
  const { width } = useResponsive();
  const composition = resolveHomeComposition(width);

  const overview = useQuery<HomeOverview>({
    queryKey: ['home', 'overview', locale, user?.id],
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
  const openUpcoming = (item: HomeUpcomingItem) => open(item.destination);

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
  const hasResume = data.resumableSessions.length > 0;
  const hasGoal = data.mainGoal !== null;
  const hasProgress = data.progress !== null;

  const resumeSection = <ResumeSection sessions={data.resumableSessions} onResume={resume} />;
  const upcomingSection = (
    <UpcomingSection
      items={data.upcoming}
      onOpen={openUpcoming}
      onPlanning={() => router.push('/calendar' as never)}
    />
  );
  const goalSection = data.mainGoal ? (
    <MainGoalPreview goal={data.mainGoal} onOpen={() => open(data.mainGoal!.destination)} />
  ) : null;
  const progressSection = data.progress ? (
    <ProgressSummary progress={data.progress} onOpen={() => router.push('/brain' as never)} />
  ) : null;

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

        {data.nextBestAction ? (
          <NextBestActionCard action={data.nextBestAction} onOpen={() => open(data.nextBestAction!.primaryAction.destination)} />
        ) : (
          <Alert tone="warning" title={t('home4.unavailable')} detail={t('home4.partial')} />
        )}

        {showSplit && hasResume ? (
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xl }}>
            <View style={{ flex: composition === 'wide' ? 1.25 : 1, minWidth: 0 }}>{resumeSection}</View>
            <View style={{ flex: 1, minWidth: 0 }}>{upcomingSection}</View>
          </View>
        ) : (
          <>
            {resumeSection}
            {upcomingSection}
          </>
        )}

        {showSplit && hasGoal && hasProgress ? (
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

        <HomeQuickActions
          onWrite={() => router.push('/tutor' as never)}
          onSpeak={() => router.push('/tutor?mode=voice' as never)}
          onScan={() => router.push('/scan' as never)}
          onImport={() => router.push('/library?action=import' as never)}
        />
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
