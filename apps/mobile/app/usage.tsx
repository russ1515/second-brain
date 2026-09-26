import { useCallback, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import type { SubscriptionView, UsageView } from '@second-brain/shared';
import { api } from '../lib/client';
import { useTokens } from '../lib/design/theme';
import { useI18n, type TranslationKey } from '../lib/i18n';
import { Page, PageHeader } from '../components/ds/layout';
import { Alert, Badge, Button, Card } from '../components/ds/core';
import { SmartErrorState, SmartLoadingState, SmartState } from '../components/ds/states';
import { UsageMeter } from '../components/ds/usage';
import { formatResetAt, formatUsageValue, usageMetricLabel } from '../lib/usage-display';

/** Usage & Quotas (Sprint 8.3) — how much of each plan limit has been used. */
export default function UsageScreen() {
  const { colors: c, typography } = useTokens();
  const { t, formatLocale } = useI18n();
  const router = useRouter();
  const [usage, setUsage] = useState<UsageView | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [partial, setPartial] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    const [usageResult, subscriptionResult] = await Promise.allSettled([
      api<UsageView>('/usage'),
      api<SubscriptionView>('/subscription'),
    ]);
    if (usageResult.status === 'fulfilled') {
      setUsage(usageResult.value);
    } else {
      setError(usageResult.reason instanceof Error ? usageResult.reason.message : t('state.error'));
    }
    if (subscriptionResult.status === 'fulfilled') setSubscription(subscriptionResult.value);
    setPartial(usageResult.status === 'rejected' || subscriptionResult.status === 'rejected');
  }, [t]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (!usage && !error) return <SmartLoadingState title={t('usage.loading')} />;

  const exhausted = usage?.items.filter((item) => item.limit !== null && item.used >= item.limit) ?? [];
  const firstExhausted = exhausted[0];
  const formattedReset = firstExhausted ? formatResetAt(firstExhausted.resetAt, formatLocale) : null;
  const limitDetail = firstExhausted
    ? `${usageMetricLabel(firstExhausted.key, t)}. ${formattedReset
      ? t('usage.limitResetKnown').replace('{date}', formattedReset)
      : t('usage.limitNoReset')} ${t('usage.nonAiAvailable')}`
    : null;

  return (
    <ScrollView style={{ backgroundColor: c.background }}>
      <Page width="content">
        <PageHeader
          title={t('usage.title')}
          description={t('usage.intro')}
          action={<Button label={t('usage.managePlan')} variant="secondary" onPress={() => router.push('/subscription')} />}
        />

        {error ? <SmartErrorState detail={error} retryable onRetry={() => void load()} /> : null}
        {partial && usage ? <SmartState state="partial" detail={t('usage.partial')} /> : null}

        <Card style={{ gap: 8 }}>
          <Text style={[typography.caption, { color: c.textMuted }]}>{t('usage.currentPlan')}</Text>
          {subscription ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <Text style={[typography.h2, { color: c.textPrimary }]}>{subscription.planName}</Text>
              <Badge
                tone={subscription.status === 'active' || subscription.status === 'trialing' ? 'success' : 'warning'}
                label={t(`sub.status.${subscription.status}` as TranslationKey)}
              />
            </View>
          ) : (
            <Text style={[typography.bodySmall, { color: c.textMuted }]}>{t('usage.planUnavailable')}</Text>
          )}
        </Card>

        {limitDetail ? <Alert tone="warning" title={t('usage.limitReached')} detail={limitDetail} /> : null}

        {usage?.items.map((item) => (
          <UsageMeter
            key={item.key}
            label={usageMetricLabel(item.key, t)}
            used={item.used}
            limit={item.limit}
            unit={item.unit}
            resetAt={formatResetAt(item.resetAt, formatLocale)}
            formatValue={(value, unit) => formatUsageValue(value, unit, formatLocale, t)}
            unlimitedLabel={t('usage.unlimited')}
            remainingLabel={t('usage.remaining')}
            resetLabel={t('usage.reset')}
          />
        ))}

        <Text style={[typography.caption, { color: c.textMuted, fontStyle: 'italic' }]}>{t('usage.note')}</Text>
      </Page>
    </ScrollView>
  );
}
