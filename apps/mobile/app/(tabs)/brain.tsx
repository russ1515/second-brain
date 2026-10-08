import { useQuery } from '@tanstack/react-query';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import type {
  BrainOverview,
  LearningEvidenceDimension,
  LearningHistoryEntry,
} from '@second-brain/shared';
import { api } from '../../lib/client';
import { useAuth } from '../../lib/auth-context';
import { useI18n, type TranslationKey } from '../../lib/i18n';
import { useTokens } from '../../lib/design/theme';
import { Badge, Card } from '../../components/ds/core';
import { Page, Section } from '../../components/ds/layout';
import { SmartEmptyState, SmartErrorState, SmartLoadingState, SmartState } from '../../components/ds/states';
import { EvidenceProgressPanel } from '../../components/learning/evidence-progress';

const DIMENSION_KEYS: Record<LearningEvidenceDimension, TranslationKey> = {
  knowledge: 'globalPath.evidence.knowledge',
  understanding: 'globalPath.evidence.understanding',
  application: 'globalPath.evidence.application',
  reasoning: 'globalPath.evidence.reasoning',
  critical_reflection: 'globalPath.evidence.criticalReflection',
  perspective: 'globalPath.evidence.perspective',
};

/** Evidence-backed assessment view. The legacy graph, prediction, generic ask
 * and recommendation panels intentionally remain outside this screen. */
export default function BrainScreen() {
  const { user } = useAuth();
  const { t } = useI18n();
  const { colors: c, spacing } = useTokens();
  const overview = useQuery<BrainOverview>({
    queryKey: ['brain', 'evidence-overview', user?.id],
    queryFn: ({ signal }) => api<BrainOverview>('/brain/overview', { signal }),
    enabled: Boolean(user),
    staleTime: 30_000,
    retry: 1,
    placeholderData: (previous) => previous,
  });

  if (overview.isPending || !user) {
    return <SmartLoadingState title={t('state.loading')} detail={t('globalPath.evidence.detail')} />;
  }
  if (!overview.data) {
    return (
      <Page width="wide">
        <SmartErrorState title={t('brain8.error.load')} retryable onRetry={() => { void overview.refetch(); }} />
      </Page>
    );
  }

  const data = overview.data;
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
      <Page width="wide" style={{ gap: spacing.xl, paddingBottom: spacing.huge }} testID="brain-evidence-view">
        {overview.error ? <SmartState state="stale" detail={t('home4.stale')} /> : data.partial ? <SmartState state="partial" detail={t('home4.partial')} /> : null}
        <EvidenceProgressPanel progress={data.evidenceProgress} />
        <CompletionEvidenceHistory items={data.completionHistory.items} />
      </Page>
    </ScrollView>
  );
}

function CompletionEvidenceHistory({ items }: { items: LearningHistoryEntry[] }) {
  const { t, formatLocale } = useI18n();
  const { colors: c, spacing, typography } = useTokens();
  return (
    <Section title={t('globalPath.calendar.title')} description={t('globalPath.calendar.detail')}>
      {items.length === 0 ? (
        <SmartEmptyState title={t('globalPath.calendar.empty')} />
      ) : (
        <View style={{ gap: spacing.sm }}>
          {items.map((item) => {
            const evaluatedDimensions = Object.values(item.dimensions).filter((dimension) => dimension.score !== null);
            return (
              <Card key={item.completionId} style={{ gap: spacing.sm }} testID={`brain-completion-${item.completionId}`}>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.xs }}>
                  <Badge tone="neutral" label={t(`globalPath.calendar.kind.${item.kind === 'language_unit' ? 'languageUnit' : 'lesson'}` as TranslationKey)} />
                  <Text style={[typography.title, { color: c.textPrimary, flex: 1 }]}>{item.title}</Text>
                </View>
                <Text style={[typography.bodySmall, { color: c.textSecondary }]}>
                  {t('globalPath.calendar.started')}: {formatDate(item.startedAt, formatLocale, t('globalPath.evidence.notEvaluated'))}
                </Text>
                <Text style={[typography.bodySmall, { color: c.textSecondary }]}>
                  {t('globalPath.calendar.finalized')}: {formatDate(item.finalizedAt, formatLocale, t('globalPath.evidence.notEvaluated'))}
                </Text>
                {item.objective ? <Text style={[typography.bodySmall, { color: c.textSecondary }]}>{t('globalPath.calendar.objective')}: {item.objective}</Text> : null}
                <Text style={[typography.label, { color: c.primary }]}>
                  {t('globalPath.calendar.result')}: {t(`globalPath.result.${resultKey(item.result.outcome)}` as TranslationKey)}
                  {item.result.score === null ? '' : ` · ${Math.round(item.result.score * 100)}%`}
                </Text>
                {evaluatedDimensions.length ? (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
                    {evaluatedDimensions.map((dimension) => (
                      <Badge
                        key={dimension.dimension}
                        tone="primary"
                        label={`${t(DIMENSION_KEYS[dimension.dimension])} · ${Math.round((dimension.score ?? 0) * 100)}%`}
                      />
                    ))}
                  </View>
                ) : (
                  <Text style={[typography.caption, { color: c.textMuted }]}>{t('globalPath.evidence.notEvaluated')}</Text>
                )}
              </Card>
            );
          })}
        </View>
      )}
    </Section>
  );
}

function resultKey(outcome: LearningHistoryEntry['result']['outcome']): 'evaluated' | 'demonstrated' | 'notDemonstrated' {
  return outcome === 'not_demonstrated' ? 'notDemonstrated' : outcome;
}

function formatDate(value: string | null, formatLocale: string, fallback: string): string {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date.toLocaleString(formatLocale, { dateStyle: 'medium', timeStyle: 'short' });
}
