import { useQuery } from '@tanstack/react-query';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import type { LearningHistoryEntry, LearningHistoryView } from '@second-brain/shared';
import { api } from '../lib/client';
import { useAuth } from '../lib/auth-context';
import { useI18n, type TranslationKey } from '../lib/i18n';
import { useTokens } from '../lib/design/theme';
import { Badge, Card } from '../components/ds/core';
import { Page } from '../components/ds/layout';
import { SmartEmptyState, SmartErrorState, SmartLoadingState, SmartState } from '../components/ds/states';

/** Historical learning calendar: only server-verified completions belong here. */
export default function CalendarScreen() {
  const { user } = useAuth();
  const { t, formatLocale } = useI18n();
  const { colors: c, spacing, typography } = useTokens();
  const history = useQuery<LearningHistoryView>({
    queryKey: ['calendar', 'learning-history', user?.id],
    queryFn: ({ signal }) => api<LearningHistoryView>('/calendar/learning-history', { signal }),
    enabled: Boolean(user),
    staleTime: 30_000,
    retry: 1,
    placeholderData: (previous) => previous,
  });

  if (history.isPending || !user) return <SmartLoadingState title={t('globalPath.calendar.title')} />;
  if (!history.data) {
    return <Page width="reading"><SmartErrorState title={t('brain8.error.load')} retryable onRetry={() => { void history.refetch(); }} /></Page>;
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.background }}
      contentContainerStyle={{ flexGrow: 1 }}
      refreshControl={<RefreshControl refreshing={history.isRefetching} onRefresh={() => { void history.refetch(); }} tintColor={c.primary} colors={[c.primary]} />}
    >
      <Page width="reading" style={{ gap: spacing.lg, paddingBottom: spacing.huge }} testID="completed-learning-calendar">
        <View style={{ gap: spacing.xs }}>
          <Text accessibilityRole="header" style={[typography.h1, { color: c.textPrimary }]}>{t('globalPath.calendar.title')}</Text>
          <Text style={[typography.body, { color: c.textSecondary }]}>{t('globalPath.calendar.detail')}</Text>
        </View>
        {history.error ? <SmartState state="stale" detail={t('home4.stale')} /> : null}
        {history.data.items.length === 0 ? (
          <SmartEmptyState title={t('globalPath.calendar.empty')} />
        ) : (
          <View style={{ gap: spacing.sm }}>
            {history.data.items.map((item) => <HistoryCard key={item.completionId} item={item} formatLocale={formatLocale} />)}
          </View>
        )}
      </Page>
    </ScrollView>
  );
}

function HistoryCard({ item, formatLocale }: { item: LearningHistoryEntry; formatLocale: string }) {
  const { t } = useI18n();
  const { colors: c, spacing, typography } = useTokens();
  const fallback = t('priv.learningReport.notAvailable');
  return (
    <Card style={{ gap: spacing.sm }} testID={`calendar-completion-${item.completionId}`}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.xs }}>
        <Badge tone="neutral" label={t(`globalPath.calendar.kind.${item.kind === 'language_unit' ? 'languageUnit' : 'lesson'}` as TranslationKey)} />
        <Text style={[typography.title, { color: c.textPrimary, flex: 1 }]}>{item.title}</Text>
      </View>
      <Text style={[typography.bodySmall, { color: c.textSecondary }]}>{t('globalPath.calendar.started')}: {dateLabel(item.startedAt, formatLocale, fallback)}</Text>
      <Text style={[typography.bodySmall, { color: c.textSecondary }]}>{t('globalPath.calendar.finalized')}: {dateLabel(item.finalizedAt, formatLocale, fallback)}</Text>
      {item.objective ? <Text style={[typography.bodySmall, { color: c.textSecondary }]}>{t('globalPath.calendar.objective')}: {item.objective}</Text> : null}
      <Text style={[typography.label, { color: c.primary }]}>
        {t('globalPath.calendar.result')}: {t(`globalPath.result.${resultKey(item.result.outcome)}` as TranslationKey)}
        {item.result.score === null ? '' : ` · ${Math.round(item.result.score * 100)}%`}
      </Text>
    </Card>
  );
}

function resultKey(outcome: LearningHistoryEntry['result']['outcome']): 'evaluated' | 'demonstrated' | 'notDemonstrated' {
  return outcome === 'not_demonstrated' ? 'notDemonstrated' : outcome;
}

function dateLabel(value: string | null, formatLocale: string, fallback: string): string {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date.toLocaleString(formatLocale, { dateStyle: 'medium', timeStyle: 'short' });
}
