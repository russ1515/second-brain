import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import type { ContextItem, ReviewHomeView } from '@second-brain/shared';
import { api } from '../../lib/client';
import { useAuth } from '../../lib/auth-context';
import { useI18n } from '../../lib/i18n';
import { useTokens } from '../../lib/design/theme';
import { useResponsive } from '../../lib/responsive';
import { loadReviewHomeCache, saveReviewHomeCache } from '../../lib/review-cache';
import { Alert, Button, Card } from '../../components/ds/core';
import { SmartErrorState, SmartLoadingState } from '../../components/ds/states';
import { ContextBar } from '../../components/context/context-bar';
import { DailyReviewPlanView, PriorityExplanation, ReviewQueuePreview, TodayReview } from '../../components/review/experience';

type RouteParams = {
  conceptId?: string | string[];
  documentId?: string | string[];
  goalId?: string | string[];
  examId?: string | string[];
  sourceSessionId?: string | string[];
};

/** Réviser answers one question: what should memory consolidate now? */
export default function StudyScreen() {
  const { user } = useAuth();
  const { t, formatLocale } = useI18n();
  const router = useRouter();
  const params = useLocalSearchParams<RouteParams>();
  const { colors: c, spacing, typography } = useTokens();
  const { width, maxContentWidth } = useResponsive();
  const wide = width >= 960;
  const [home, setHome] = useState<ReviewHomeView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [staleAt, setStaleAt] = useState<string | null>(null);
  const [size, setSize] = useState<5 | 10 | 'all'>(10);

  const context = useMemo(() => ({
    conceptId: first(params.conceptId),
    documentId: first(params.documentId),
    goalId: first(params.goalId),
    examId: first(params.examId),
    sourceSessionId: first(params.sourceSessionId),
  }), [params.conceptId, params.documentId, params.examId, params.goalId, params.sourceSessionId]);
  const query = useMemo(() => queryString(context), [context]);

  const load = useCallback(async () => {
    if (!user) return;
    setError(null);
    const cached = await loadReviewHomeCache(user.id, query);
    if (cached) {
      setHome(cached.value);
      setStaleAt(cached.savedAt);
      setLoading(false);
    }
    try {
      const fresh = await api<ReviewHomeView>(`/review/home${query ? `?${query}` : ''}`);
      setHome(fresh);
      setStaleAt(null);
      await saveReviewHomeCache(user.id, query, fresh);
    } catch (cause) {
      setError((cause as Error).message);
      if (cached) {
        setHome(cached.value);
        setStaleAt(cached.savedAt);
      }
    } finally {
      setLoading(false);
    }
  }, [query, user]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const start = () => router.push({ pathname: '/revision', params: compactParams({ ...context, size: String(size) }) });
  const contextItems = home ? toContextItems(home) : [];

  if (loading && !home) {
    return (
      <View style={[styles.screen, { backgroundColor: c.background }]}>
        <SmartLoadingState title={t('review9.loading')} detail={t('review9.loadingDetail')} />
      </View>
    );
  }
  if (!home) {
    return (
      <ScrollView
        style={[styles.screen, { backgroundColor: c.background }]}
        contentContainerStyle={[styles.container, styles.stateContainer, { maxWidth: maxContentWidth }]}
      >
        <SmartErrorState detail={error ?? undefined} retryable onRetry={() => void load()} />
      </ScrollView>
    );
  }

  const primary = (
    <View style={{ gap: spacing.md }}>
      {home.resumableSession ? (
        <Card style={{ gap: spacing.sm, borderColor: c.aiAccent }} testID="review-resume">
          <Text accessibilityRole="header" style={[typography.title, { color: c.textPrimary }]}>{t('review9.resume')}</Text>
          <Text style={[typography.bodySmall, { color: c.textSecondary }]}>{home.resumableSession.title ?? t('review9.resumeDetail')}</Text>
          {home.resumableSession.progress?.total !== undefined ? <Text style={[typography.caption, { color: c.textMuted }]}>{t('review9.resumeProgress').replace('{done}', String(home.resumableSession.progress.completed)).replace('{total}', String(home.resumableSession.progress.total))}</Text> : null}
          <Button label={t('review9.resumeAction')} onPress={() => router.push({ pathname: '/revision', params: { sessionId: home.resumableSession!.id } })} />
        </Card>
      ) : null}
      <TodayReview home={home} selectedSize={size} onSize={setSize} onStart={start} />
      <PriorityExplanation item={home.priorityItems[0]} dueCount={home.dueCount} />
      {home.dueCount === 0 ? <Button label={t('review9.continuePath')} variant="secondary" onPress={() => router.push('/learn')} /> : null}
    </View>
  );
  const secondary = (
    <View style={{ gap: spacing.md }}>
      <ReviewQueuePreview items={home.priorityItems} />
      <DailyReviewPlanView plan={home.plan} />
      <Card style={{ gap: spacing.xs }}>
        <Text accessibilityRole="header" style={[typography.title, { color: c.textPrimary }]}>{t('review9.history')}</Text>
        <Text style={[typography.bodySmall, { color: c.textSecondary }]}>{t('review9.reviewsToday').replace('{count}', String(home.stats.reviewsToday))}</Text>
      </Card>
    </View>
  );

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: c.background }]}
      contentContainerStyle={[styles.container, { maxWidth: maxContentWidth }]}
    >
      <View style={{ gap: spacing.xs }}>
        <Text accessibilityRole="header" style={[typography.h1, { color: c.textPrimary }]}>{t('review9.title')}</Text>
        <Text style={[typography.body, { color: c.textSecondary, maxWidth: 720 }]}>{t('review9.intro')}</Text>
      </View>
      <ContextBar items={contextItems} />
      {staleAt ? <Alert tone="warning" title={t('review9.offline')} detail={t('review9.stale').replace('{date}', new Date(staleAt).toLocaleString(formatLocale))} /> : null}
      {home.partial ? <Alert tone="warning" title={t('review9.partial')} detail={t('review9.partialDetail')} /> : null}
      {error && !staleAt ? <Alert tone="warning" title={t('state.error')} detail={error} /> : null}
      {wide ? <View style={{ flexDirection: 'row', gap: spacing.lg, alignItems: 'flex-start' }}><View style={{ flex: 1.25, minWidth: 0 }}>{primary}</View><View style={{ flex: 0.75, minWidth: 300 }}>{secondary}</View></View> : <View style={{ gap: spacing.md }}>{primary}{secondary}</View>}
    </ScrollView>
  );
}

function first(value?: string | string[]): string | undefined { return Array.isArray(value) ? value[0] : value; }

function queryString(values: Record<string, string | undefined>): string {
  return Object.entries(values).filter((entry): entry is [string, string] => !!entry[1]).map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`).join('&');
}

function compactParams(values: Record<string, string | undefined>): Record<string, string> {
  return Object.fromEntries(Object.entries(values).filter((entry): entry is [string, string] => !!entry[1]));
}

function toContextItems(home: ReviewHomeView): ContextItem[] {
  const addedAt = home.generatedAt;
  return [
    ...(home.context.concept ? [{ id: `concept-${home.context.concept.id}`, kind: 'concept' as const, scope: 'active-object' as const, referenceId: home.context.concept.id, label: home.context.concept.name, priority: 90, visibility: 'visible' as const, addedAt }] : []),
    ...(home.context.document ? [{ id: `document-${home.context.document.documentId}`, kind: 'document' as const, scope: 'active-object' as const, referenceId: home.context.document.documentId, label: home.context.document.title, priority: 80, visibility: 'visible' as const, addedAt }] : []),
    ...(home.context.exam ? [{ id: `exam-${home.context.exam.id}`, kind: 'exam' as const, scope: 'experience-session' as const, referenceId: home.context.exam.id, label: home.context.exam.subject, priority: 60, visibility: 'visible' as const, addedAt }] : []),
    ...(home.context.goal ? [{ id: `goal-${home.context.goal.id}`, kind: 'goal' as const, scope: 'experience-session' as const, referenceId: home.context.goal.id, label: home.context.goal.title, priority: 50, visibility: 'summary' as const, addedAt }] : []),
  ];
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  container: { padding: 20, gap: 16, width: '100%', alignSelf: 'center', paddingBottom: 56 },
  stateContainer: { flexGrow: 1 },
});
