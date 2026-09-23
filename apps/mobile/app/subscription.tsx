import { useCallback, useState } from 'react';
import { Linking, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import type {
  CheckoutResponse,
  InvoiceView,
  PlanView,
  PlanSlug,
  SubscriptionView,
  UsageUnit,
  UsageView,
} from '@second-brain/shared';
import { api } from '../lib/client';
import { useTokens } from '../lib/design/theme';
import { useI18n, type TranslationKey } from '../lib/i18n';
import { Badge, Button, Card } from '../components/ds/core';
import { Page, PageHeader, ResponsiveGrid, Section } from '../components/ds/layout';
import { SmartErrorState, SmartLoadingState, SmartState } from '../components/ds/states';
import { UsageMeter } from '../components/ds/usage';
import { formatResetAt, formatUsageValue, usageMetricLabel } from '../lib/usage-display';

function usageUnit(key: string): UsageUnit {
  if (key === 'storage') return 'bytes';
  if (key === 'voice_minutes') return 'minutes';
  return 'count';
}

function formatPrice(plan: PlanView, locale: string, fallback: string): string {
  if (plan.priceMonthly === null) return plan.tier === 0 ? fallback : '';
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: plan.currency.toUpperCase(),
      maximumFractionDigits: 2,
    }).format(plan.priceMonthly / 100);
  } catch {
    return `${(plan.priceMonthly / 100).toFixed(2)} ${plan.currency.toUpperCase()}`;
  }
}

/** Subscription & billing (Sprint 8.1 + 8.2). Choosing a paid plan starts a
 *  hosted checkout; the fake dev provider completes it inline (real providers
 *  open a secure page). The backend is the source of truth — the screen just
 *  reflects it. */
export default function SubscriptionScreen() {
  const { colors: c, spacing, typography } = useTokens();
  const { t, locale } = useI18n();
  const router = useRouter();
  const [plans, setPlans] = useState<PlanView[] | null>(null);
  const [current, setCurrent] = useState<SubscriptionView | null>(null);
  const [usage, setUsage] = useState<UsageView | null>(null);
  const [invoices, setInvoices] = useState<InvoiceView[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [partial, setPartial] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    const results = await Promise.allSettled([
      api<PlanView[]>('/plans'),
      api<SubscriptionView>('/subscription'),
      api<InvoiceView[]>('/billing/invoices'),
      api<UsageView>('/usage'),
    ]);
    const [plansResult, subscriptionResult, invoiceResult, usageResult] = results;
    if (plansResult.status === 'fulfilled') setPlans(plansResult.value);
    if (subscriptionResult.status === 'fulfilled') setCurrent(subscriptionResult.value);
    if (invoiceResult.status === 'fulfilled') setInvoices(invoiceResult.value);
    if (usageResult.status === 'fulfilled') setUsage(usageResult.value);
    if (plansResult.status === 'rejected') {
      setError(plansResult.reason instanceof Error ? plansResult.reason.message : t('state.error'));
    }
    setPartial(results.some((result) => result.status === 'rejected'));
    setLoading(false);
  }, [t]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const choose = async (slug: PlanSlug) => {
    setBusy(slug);
    setError(null);
    try {
      if (slug === 'free') {
        await api('/billing/cancel', { method: 'POST', body: { atPeriodEnd: false } });
      } else {
        const co = await api<CheckoutResponse>('/billing/checkout', {
          method: 'POST',
          body: { slug, interval: 'month' },
        });
        if (co.provider === 'fake' && co.sessionId) {
          // Dev provider: complete the "hosted" checkout inline.
          await api('/billing/dev/confirm', {
            method: 'POST',
            body: { sessionId: co.sessionId },
          });
        } else {
          // Real provider: open the secure hosted checkout page.
          await Linking.openURL(co.url);
        }
      }
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const cancel = async () => {
    setBusy('cancel');
    setError(null);
    try {
      await api('/billing/cancel', { method: 'POST', body: { atPeriodEnd: true } });
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  if (loading && !plans && !current) return <SmartLoadingState title={t('state.loading')} />;

  const onPaidPlan = current !== null && current.planSlug !== 'free';
  const individualPlans = [...(plans ?? [])]
    .filter((plan) => plan.audience === 'individual')
    .sort((a, b) => a.tier - b.tier);
  const currentTier = individualPlans.find((plan) => plan.slug === current?.planSlug)?.tier ?? -1;
  const nextPlan = individualPlans.find((plan) => plan.tier > currentTier && plan.priceMonthly !== null);
  const priorityUsage = [...(usage?.items ?? [])]
    .sort((a, b) => {
      const ratio = (item: UsageView['items'][number]) => item.limit === null ? -1 : item.limit === 0 ? 1 : item.used / item.limit;
      return ratio(b) - ratio(a);
    })
    .slice(0, 2);
  const formatDate = (value: string) => new Date(value).toLocaleDateString(locale, { dateStyle: 'medium' });

  return (
    <ScrollView style={{ backgroundColor: c.background }}>
      <Page width="wide" style={{ paddingBottom: 48 }}>
        <PageHeader
          title={t('sub.title')}
          description={t('sub.intro')}
          action={<Button label={t('sub.usageAction')} variant="secondary" onPress={() => router.push('/usage')} />}
        />

        {error ? <SmartErrorState detail={error} retryable onRetry={() => void load()} /> : null}
        {partial && (plans || current) ? <SmartState state="partial" detail={t('sub.partial')} /> : null}

        {current ? (
          <Card style={{ borderColor: c.primary, gap: spacing.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: spacing.sm }}>
              <View style={{ flex: 1, minWidth: 200, gap: 3 }}>
                <Text style={[typography.caption, { color: c.textMuted }]}>{t('sub.current')}</Text>
                <Text style={[typography.h2, { color: c.textPrimary }]}>{current.planName}</Text>
                <Text style={[typography.bodySmall, { color: c.textSecondary }]}>
                  {t(`sub.status.${current.status}` as TranslationKey)}
                  {current.cancelAtPeriodEnd ? ` · ${t('sub.willCancel')}` : ''}
                </Text>
                {current.trialEndsAt ? <Text style={[typography.caption, { color: c.textMuted }]}>{t('sub.trialEnds')}: {formatDate(current.trialEndsAt)}</Text> : null}
                {current.currentPeriodEnd ? <Text style={[typography.caption, { color: c.textMuted }]}>{t('sub.periodEnd')}: {formatDate(current.currentPeriodEnd)}</Text> : null}
              </View>
              <Badge
                tone={current.status === 'active' || current.status === 'trialing' ? 'success' : 'warning'}
                label={t(`sub.status.${current.status}` as TranslationKey)}
              />
            </View>

            {priorityUsage.map((item) => (
              <UsageMeter
                key={item.key}
                compact
                label={usageMetricLabel(item.key, t)}
                used={item.used}
                limit={item.limit}
                unit={item.unit}
                resetAt={formatResetAt(item.resetAt, locale)}
                formatValue={(value, unit) => formatUsageValue(value, unit, locale, t)}
                unlimitedLabel={t('usage.unlimited')}
                remainingLabel={t('usage.remaining')}
                resetLabel={t('usage.reset')}
              />
            ))}

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {nextPlan ? (
                <Button
                  label={`${t('sub.upgrade')} ${nextPlan.name}`}
                  loading={busy === nextPlan.slug}
                  disabled={busy !== null}
                  onPress={() => void choose(nextPlan.slug)}
                />
              ) : null}
              {onPaidPlan && !current.cancelAtPeriodEnd ? (
                <Button variant="ghost" label={t('sub.cancel')} loading={busy === 'cancel'} disabled={busy !== null} onPress={() => void cancel()} />
              ) : null}
            </View>
          </Card>
        ) : null}

        <Section title={t('sub.availablePlans')} description={t('sub.availablePlansDetail')}>
          <ResponsiveGrid maxColumns={3}>
            {individualPlans.map((plan) => {
              const active = current?.planSlug === plan.slug;
              const selectable = plan.tier === 0 || plan.priceMonthly !== null;
              const price = formatPrice(plan, locale, t('sub.free'));
              const priceLabel = plan.priceMonthly === null ? (plan.tier === 0 ? price : t('sub.notAvailable')) : `${price}${t('sub.perMonth')}`;
              return (
                <Card key={plan.id} style={{ gap: spacing.sm, borderColor: active ? c.primary : c.borderSubtle, height: '100%' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm }}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={[typography.h3, { color: c.textPrimary }]}>{plan.name}</Text>
                      <Text style={[typography.caption, { color: c.textMuted }]}>{t(`sub.audience.${plan.audience}` as TranslationKey)}</Text>
                    </View>
                    {active ? <Badge tone="primary" label={t('sub.currentPlan')} /> : null}
                  </View>

                  <Text style={[typography.title, { color: selectable ? c.textPrimary : c.textMuted }]}>
                    {priceLabel}
                  </Text>

                  <View style={{ flex: 1, gap: spacing.xs }}>
                    {Object.entries(plan.quotas).map(([key, rawLimit]) => {
                      const unit = usageUnit(key);
                      const limit = rawLimit < 0 ? null : rawLimit;
                      return (
                        <View key={key} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.sm, paddingVertical: 5, borderTopWidth: 1, borderTopColor: c.borderSubtle }}>
                          <Text style={[typography.bodySmall, { color: c.textSecondary, flex: 1 }]}>{usageMetricLabel(key, t)}</Text>
                          <Text style={[typography.bodySmall, { color: c.textPrimary, fontWeight: '700', textAlign: 'right' }]}>
                            {limit === null ? t('usage.unlimited') : formatUsageValue(limit, unit, locale, t)}
                          </Text>
                        </View>
                      );
                    })}
                  </View>

                  <Button
                    fullWidth
                    label={active ? t('sub.currentPlan') : selectable ? t('sub.choose') : t('sub.notAvailable')}
                    variant={active || !selectable ? 'secondary' : 'primary'}
                    disabled={active || !selectable || busy !== null}
                    loading={busy === plan.slug}
                    onPress={() => void choose(plan.slug)}
                  />
                </Card>
              );
            })}
          </ResponsiveGrid>
        </Section>

        <Section title={t('sub.invoices')}>
          {invoices.length === 0 ? (
            <Text style={[typography.bodySmall, { color: c.textMuted }]}>{t('sub.noInvoices')}</Text>
          ) : (
            <View style={{ gap: spacing.sm }}>
              {invoices.map((invoice) => (
                <Card key={invoice.id} style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm }}>
                  <View style={{ flex: 1, minWidth: 180 }}>
                    <Text style={[typography.title, { color: c.textPrimary }]}>{invoice.number}</Text>
                    <Text style={[typography.caption, { color: c.textMuted }]}>{new Date(invoice.createdAt).toLocaleDateString(locale)} · {invoice.status}</Text>
                  </View>
                  <Text style={[typography.title, { color: c.textPrimary, fontVariant: ['tabular-nums'] }]}>
                    {(invoice.amount / 100).toFixed(2)} {invoice.currency.toUpperCase()}
                  </Text>
                  {invoice.url ? <Button label={t('sub.openInvoice')} variant="secondary" size="sm" onPress={() => void Linking.openURL(invoice.url as string)} /> : null}
                </Card>
              ))}
            </View>
          )}
        </Section>

        <Text style={[typography.caption, { color: c.textMuted, fontStyle: 'italic' }]}>{t('sub.note')}</Text>
      </Page>
    </ScrollView>
  );
}
