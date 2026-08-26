import { useCallback, useState, useMemo } from 'react';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import type {
  CheckoutResponse,
  InvoiceView,
  PlanView,
  SubscriptionView,
} from '@second-brain/shared';
import { api } from '../lib/client';
import { useTokens } from '../lib/design/theme';
import type { ColorScale } from '../lib/design/tokens';
import { useI18n, type TranslationKey } from '../lib/i18n';
import { useResponsive } from '../lib/responsive';
import { Button, Card, ErrorBanner, Loading } from '../components/ui';
import { Badge } from '../components/ds/core';

/** Humanize a feature key (`voice_shadowing` → `Voice shadowing`) for the plan
 *  comparison list. Feature keys are capability ids, not translated copy. */
function humanize(key: string): string {
  const s = key.replace(/[_-]+/g, ' ').trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Subscription & billing (Sprint 8.1 + 8.2). Choosing a paid plan starts a
 *  hosted checkout; the fake dev provider completes it inline (real providers
 *  open a secure page). The backend is the source of truth — the screen just
 *  reflects it. */
export default function SubscriptionScreen() {
  const { colors: c } = useTokens();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { t } = useI18n();
  const { width } = useResponsive();
  const wide = width >= 900;
  const [plans, setPlans] = useState<PlanView[] | null>(null);
  const [current, setCurrent] = useState<SubscriptionView | null>(null);
  const [invoices, setInvoices] = useState<InvoiceView[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [p, s, inv] = await Promise.all([
        api<PlanView[]>('/plans'),
        api<SubscriptionView>('/subscription'),
        api<InvoiceView[]>('/billing/invoices'),
      ]);
      setPlans(p);
      setCurrent(s);
      setInvoices(inv);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const choose = async (slug: string) => {
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

  if (!plans && !error) return <Loading />;

  const onPaidPlan = current !== null && current.planSlug !== 'free';

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.h1}>{t('sub.title')}</Text>
      <Text style={styles.intro}>{t('sub.intro')}</Text>

      {error ? <ErrorBanner message={error} /> : null}

      {current ? (
        <Card style={styles.currentCard}>
          <Text style={styles.currentLabel}>{t('sub.current')}</Text>
          <Text style={styles.currentPlan}>{current.planName}</Text>
          <Text style={styles.currentStatus}>
            {t(`sub.status.${current.status}` as TranslationKey)}
            {current.cancelAtPeriodEnd ? ` · ${t('sub.willCancel')}` : ''}
          </Text>
          {onPaidPlan && !current.cancelAtPeriodEnd ? (
            <Button
              variant="ghost"
              label={t('sub.cancel')}
              busy={busy === 'cancel'}
              onPress={cancel}
            />
          ) : null}
        </Card>
      ) : null}

      {/* Plan cards (§4): sorted by tier, side-by-side on wide screens, with the
          mid paid tier flagged Popular, real price when set, and a feature list
          for comparison. Prices/quotas come from the backend — nothing frozen. */}
      <View style={wide ? styles.planGrid : { gap: 12 }}>
        {[...(plans ?? [])].filter((p) => p.slug === 'free' || p.slug === 'pro').sort((a, b) => a.tier - b.tier).map((p) => {
          const active = current?.planSlug === p.slug;
          const popular = p.slug === 'pro';
          const feats = Object.entries(p.features).filter(([, on]) => on).map(([k]) => k).slice(0, 6);
          const priceLabel =
            p.priceMonthly === null
              ? p.tier === 0 ? t('sub.free') : t('sub.pricingSoon')
              : `${(p.priceMonthly / 100).toFixed(0)} ${p.currency.toUpperCase()}${t('sub.perMonth')}`;
          return (
            <Card key={p.id} style={StyleSheet.flatten([wide ? styles.planCol : undefined, active ? styles.activeCard : popular ? styles.popularCard : undefined])}>
              <View style={styles.planHead}>
                <Text style={styles.planName}>{p.name}</Text>
                {popular ? <Badge tone="ai" label={t('sub.popular')} /> : (
                  <Text style={styles.audience}>{t(`sub.audience.${p.audience}` as TranslationKey)}</Text>
                )}
              </View>
              <Text style={styles.price}>{priceLabel}</Text>
              {feats.length ? (
                <View style={styles.feats}>
                  {feats.map((f) => (
                    <View key={f} style={styles.featRow}>
                      <Text style={styles.featTick}>✓</Text>
                      <Text style={styles.featText} numberOfLines={1}>{humanize(f)}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
              <Button
                label={active ? t('sub.currentPlan') : t('sub.choose')}
                variant={active ? 'ghost' : 'primary'}
                disabled={active || busy !== null}
                busy={busy === p.slug}
                onPress={() => choose(p.slug)}
              />
            </Card>
          );
        })}
      </View>

      <Text style={styles.section}>{t('sub.invoices')}</Text>
      {invoices.length === 0 ? (
        <Text style={styles.note}>{t('sub.noInvoices')}</Text>
      ) : (
        invoices.map((inv) => (
          <Card key={inv.id} style={styles.invoiceRow}>
            <View style={styles.flex}>
              <Text style={styles.invNumber}>{inv.number}</Text>
              <Text style={styles.invMeta}>
                {new Date(inv.createdAt).toLocaleDateString()} · {inv.provider}
              </Text>
            </View>
            <Text style={styles.invAmount}>
              {(inv.amount / 100).toFixed(2)} {inv.currency.toUpperCase()}
            </Text>
          </Card>
        ))
      )}

      <Text style={styles.note}>{t('sub.note')}</Text>
    </ScrollView>
  );
}

const makeStyles = (c: ColorScale) => StyleSheet.create({
  container: { padding: 20, gap: 12, maxWidth: 1280, width: '100%', alignSelf: 'center' },
  h1: { fontSize: 28, fontWeight: '700', color: c.textPrimary },
  intro: { fontSize: 14, color: c.textSecondary, lineHeight: 20, marginBottom: 4 },
  currentCard: { borderColor: c.primary, gap: 4 },
  currentLabel: { fontSize: 11, fontWeight: '700', color: c.textMuted, textTransform: 'uppercase', letterSpacing: 1 },
  currentPlan: { fontSize: 22, fontWeight: '800', color: c.textPrimary },
  currentStatus: { fontSize: 13, color: c.textSecondary, textTransform: 'capitalize', marginBottom: 4 },
  activeCard: { borderColor: c.primary },
  popularCard: { borderColor: c.aiAccent },
  planGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'stretch' },
  planCol: { flexGrow: 1, flexBasis: '30%', minWidth: 200 },
  feats: { gap: 6, marginBottom: 12 },
  featRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  featTick: { color: c.success, fontSize: 13, fontWeight: '800' },
  featText: { color: c.textSecondary, fontSize: 13, flexShrink: 1 },
  planHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  planName: { fontSize: 17, fontWeight: '700', color: c.textPrimary },
  audience: { fontSize: 11, fontWeight: '700', color: c.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  price: { fontSize: 13, color: c.textSecondary, marginBottom: 10 },
  section: { fontSize: 12, fontWeight: '700', color: c.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginTop: 10 },
  invoiceRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  flex: { flex: 1 },
  invNumber: { fontSize: 14, fontWeight: '600', color: c.textPrimary },
  invMeta: { fontSize: 12, color: c.textSecondary, marginTop: 2 },
  invAmount: { fontSize: 14, fontWeight: '700', color: c.textPrimary, fontVariant: ['tabular-nums'] },
  note: { fontSize: 12, color: c.textMuted, fontStyle: 'italic', marginTop: 4 },
});
