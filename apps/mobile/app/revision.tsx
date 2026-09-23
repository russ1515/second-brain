import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type {
  GradeReviewSessionItemResponse,
  ReviewFeedbackCode,
  ReviewRating,
  ReviewSessionSize,
  ReviewSessionView,
  StartReviewSessionRequest,
} from '@second-brain/shared';
import { api } from '../lib/client';
import { useAuth } from '../lib/auth-context';
import { useI18n } from '../lib/i18n';
import { useTokens } from '../lib/design/theme';
import { useResponsive } from '../lib/responsive';
import { loadReviewSessionCache, saveReviewSessionCache } from '../lib/review-cache';
import { Alert, Button, Card } from '../components/ds/core';
import { SmartErrorState, SmartLoadingState } from '../components/ds/states';
import { SourcePreview } from '../components/ds/sources';
import { ContextBar } from '../components/context/context-bar';
import { ProgressNarrative } from '../components/tutor/experience';
import { PriorityExplanation, ReviewFeedback, ReviewSummaryView, ReviewWorkItem } from '../components/review/experience';

type RouteParams = {
  sessionId?: string | string[];
  size?: string | string[];
  conceptId?: string | string[];
  documentId?: string | string[];
  goalId?: string | string[];
  examId?: string | string[];
  sourceSessionId?: string | string[];
  languageProfileId?: string | string[];
  returnTo?: string | string[];
};

/** Focused, resumable memory-consolidation session. */
export default function RevisionScreen() {
  const { user } = useAuth();
  const { t } = useI18n();
  const { colors: c, spacing, typography } = useTokens();
  const { width, maxContentWidth } = useResponsive();
  const wide = width >= 960;
  const router = useRouter();
  const params = useLocalSearchParams<RouteParams>();
  const requestedSessionId = first(params.sessionId);
  const returnToCourse = first(params.returnTo) === 'course';
  const idempotencyKey = useRef(`review:${Date.now()}:${Math.random().toString(36).slice(2)}`);
  const [review, setReview] = useState<ReviewSessionView | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [staleAt, setStaleAt] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [feedback, setFeedback] = useState<ReviewFeedbackCode | null>(null);
  const [showSource, setShowSource] = useState(false);

  const startRequest = useMemo<StartReviewSessionRequest>(() => ({
    size: parseSize(first(params.size)),
    conceptId: first(params.conceptId),
    documentId: first(params.documentId),
    goalId: first(params.goalId),
    examId: first(params.examId),
    sourceSessionId: first(params.sourceSessionId),
    languageProfileId: first(params.languageProfileId),
    idempotencyKey: idempotencyKey.current,
  }), [params.conceptId, params.documentId, params.examId, params.goalId, params.languageProfileId, params.size, params.sourceSessionId]);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    if (requestedSessionId) {
      const cached = await loadReviewSessionCache(user.id, requestedSessionId);
      if (cached) {
        setReview(cached.value);
        setStaleAt(cached.savedAt);
        setLoading(false);
      }
    }
    try {
      const fresh = requestedSessionId
        ? await api<ReviewSessionView>(`/review/sessions/${encodeURIComponent(requestedSessionId)}`)
        : await api<ReviewSessionView>('/review/sessions', { method: 'POST', body: startRequest });
      setReview(fresh);
      setStaleAt(null);
      await saveReviewSessionCache(user.id, fresh);
      if (!requestedSessionId) router.setParams({ sessionId: fresh.session.id });
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setLoading(false);
    }
  }, [requestedSessionId, router, startRequest, user]);

  useEffect(() => { void load(); }, [load]);

  const completed = new Set(review?.completedItemReferences ?? []);
  const current = review?.items.find((item) => !completed.has(item.reference));
  const currentIndex = current && review ? review.items.findIndex((item) => item.reference === current.reference) : -1;
  const sessionDone = !!review && (review.session.status === 'completed' || (!current && review.summary.reviewed > 0));

  const grade = async (rating: ReviewRating) => {
    if (!user || !review || !current || busy || staleAt) return;
    setBusy(true);
    setError(null);
    try {
      const result = await api<GradeReviewSessionItemResponse>(`/review/sessions/${review.session.id}/review`, {
        method: 'POST',
        body: { itemReference: current.reference, rating },
      });
      setReview(result.review);
      setFeedback(result.feedback);
      setRevealed(false);
      setShowSource(false);
      await saveReviewSessionCache(user.id, result.review);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const pauseAndLeave = async () => {
    if (review && review.session.status === 'active') {
      await api(`/experience-sessions/${review.session.id}/pause`, { method: 'POST' }).catch(() => undefined);
    }
    router.replace('/study');
  };

  const askTutor = () => {
    if (!current || !review) return;
    const concept = current.concepts[0];
    const goal = review.session.activeContexts.items.find((item) => item.kind === 'goal');
    const exam = review.session.activeContexts.items.find((item) => item.kind === 'exam');
    router.push({
      pathname: '/tutor',
      params: compactParams({
        mode: 'explain',
        intent: 'review-difficulty',
        conceptId: concept?.id,
        conceptName: concept?.name,
        documentId: current.source?.documentId,
        q: current.prompt,
        sourceSessionId: review.session.id,
        goalId: review.session.links.goalId ?? undefined,
        goalTitle: goal?.label,
        examId: exam?.referenceId,
        examTitle: exam?.label,
        title: current.source?.title,
      }),
    });
  };

  if (loading && !review) return <SmartLoadingState title={t('review9.sessionLoading')} detail={t('review9.sessionLoadingDetail')} />;
  if (!review) return <ScrollView contentContainerStyle={[styles.container, { maxWidth: maxContentWidth }]}><SmartErrorState title={t('review9.startError')} detail={error ?? undefined} retryable onRetry={() => void load()} /><Button label={t('review9.back')} variant="ghost" onPress={() => router.replace('/study')} /></ScrollView>;

  if (sessionDone) {
    const firstConcept = review.summary.concepts[0];
    return (
      <ScrollView contentContainerStyle={[styles.container, { maxWidth: Math.min(maxContentWidth, 880) }]}>
        {feedback ? <ReviewFeedback code={feedback} /> : null}
        <ReviewSummaryView summary={review.summary} />
        <ProgressNarrative session={review.session} />
        <Card style={{ gap: spacing.sm }}>
          <Text accessibilityRole="header" style={[typography.title, { color: c.textPrimary }]}>{t('review9.nextAction')}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {review.summary.difficult > 0 ? <Button label={t('review9.askTutor')} onPress={() => router.push({ pathname: '/tutor', params: compactParams({ mode: 'explain', intent: 'review-summary', q: t('review9.tutorSummaryPrompt'), conceptId: firstConcept?.id, conceptName: firstConcept?.name, sourceSessionId: review.session.id }) })} /> : null}
            <Button label={t('review9.openBrain')} variant="secondary" onPress={() => router.push({ pathname: '/brain', params: compactParams({ view: firstConcept ? 'knowledge' : 'memory', conceptId: firstConcept?.id, sessionId: review.session.id }) })} />
            <Button label={t('review9.doneToday')} variant="ghost" onPress={() => router.replace('/study')} />
            {review.session.links.languageProfileId ? (
              <Button
                label={t(returnToCourse ? 'rlle.ui.review.returnCourse' : 'languages11.review.return')}
                variant="secondary"
                onPress={() => router.replace(
                  returnToCourse
                    ? `/languages/${review.session.links.languageProfileId}/course` as never
                    : `/languages/${review.session.links.languageProfileId}` as never,
                )}
              />
            ) : null}
          </View>
        </Card>
      </ScrollView>
    );
  }

  if (!current) {
    return <ScrollView contentContainerStyle={[styles.container, { maxWidth: maxContentWidth }]}><SmartErrorState title={t('review9.unavailable')} detail={t('review9.unavailableDetail').replace('{count}', String(review.unavailableCount))} /><Button label={t('review9.back')} variant="ghost" onPress={() => router.replace('/study')} /></ScrollView>;
  }

  const work = (
    <View style={{ gap: spacing.md }}>
      <ReviewWorkItem
        key={current.reference}
        item={current}
        index={Math.max(0, currentIndex)}
        total={review.items.length}
        revealed={revealed}
        busy={busy || !!staleAt}
        onReveal={() => setRevealed(true)}
        onRate={(rating) => void grade(rating)}
        onOpenSource={() => setShowSource(true)}
        onAskTutor={askTutor}
        onOpenLanguage={current.languageProfileId ? () => router.push(`/languages/${current.languageProfileId}` as never) : undefined}
      />
      {feedback ? <ReviewFeedback code={feedback} /> : null}
      {error ? <Alert tone="error" title={t('review9.notSaved')} detail={error} /> : null}
      {staleAt ? <Alert tone="warning" title={t('review9.offlineSession')} detail={t('review9.offlineSessionDetail')} /> : null}
    </View>
  );
  const context = (
    <View style={{ gap: spacing.md }}>
      <PriorityExplanation item={current} dueCount={review.items.length} itemOnly />
      {showSource && current.source ? <SourcePreview title={current.source.title} kind="document" onOpen={() => router.push(`/library/${current.source!.documentId}`)} onClose={() => setShowSource(false)} /> : null}
      <Button label={t('review9.pause')} variant="ghost" onPress={() => void pauseAndLeave()} />
    </View>
  );

  return (
    <ScrollView contentContainerStyle={[styles.container, { maxWidth: maxContentWidth }]} keyboardShouldPersistTaps="handled">
      <View style={{ gap: spacing.sm }}>
        <Text accessibilityRole="header" style={[typography.h1, { color: c.textPrimary }]}>{t('review9.sessionTitle')}</Text>
        <ContextBar items={review.session.activeContexts.items} />
      </View>
      {review.unavailableCount > 0 ? <Alert tone="warning" title={t('review9.someUnavailable')} detail={t('review9.unavailableDetail').replace('{count}', String(review.unavailableCount))} /> : null}
      {wide ? <View style={{ flexDirection: 'row', gap: spacing.lg, alignItems: 'flex-start' }}><View style={{ flex: 1.4, minWidth: 0 }}>{work}</View><View style={{ flex: 0.6, minWidth: 280 }}>{context}</View></View> : <View style={{ gap: spacing.md }}>{work}{context}</View>}
    </ScrollView>
  );
}

function first(value?: string | string[]): string | undefined { return Array.isArray(value) ? value[0] : value; }

function parseSize(value?: string): ReviewSessionSize {
  if (value === '5') return 5;
  if (value === 'all') return 'all';
  return 10;
}

function compactParams(values: Record<string, string | undefined>): Record<string, string> {
  return Object.fromEntries(Object.entries(values).filter((entry): entry is [string, string] => !!entry[1]));
}

const styles = StyleSheet.create({ container: { padding: 20, gap: 16, width: '100%', alignSelf: 'center', paddingBottom: 56 } });
