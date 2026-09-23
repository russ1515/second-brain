import { Text, View } from 'react-native';
import type { SubscriptionView, UsageItem, UsageView } from '@second-brain/shared';
import { useI18n, type TranslationKey } from '../../lib/i18n';
import { useTokens } from '../../lib/design/theme';
import { formatResetAt, formatUsageValue, usageMetricLabel } from '../../lib/usage-display';
import { Badge, Button, Card, SegmentedControl } from '../ds/core';
import { UsageMeter } from '../ds/usage';

export function AccountUsageCard({
  subscription,
  usage,
  onSubscription,
  onUsage,
}: {
  subscription: SubscriptionView | null;
  usage: UsageView | null;
  onSubscription: () => void;
  onUsage: () => void;
}) {
  const { t, locale } = useI18n();
  const { colors: c, spacing, typography } = useTokens();
  const items = usage ? prioritizedUsage(usage.items).slice(0, 3) : [];

  return (
    <Card style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm }}>
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text style={[typography.caption, { color: c.textMuted }]}>{t('profile.billing.current')}</Text>
          <Text style={[typography.h3, { color: c.textPrimary }]} numberOfLines={1}>
            {subscription?.planName ?? t('profile.billing.unavailable')}
          </Text>
        </View>
        {subscription ? (
          <Badge
            tone={subscription.status === 'active' || subscription.status === 'trialing' ? 'success' : 'warning'}
            label={t(`sub.status.${subscription.status}` as TranslationKey)}
          />
        ) : null}
      </View>

      {items.length > 0 ? items.map((item) => (
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
      )) : (
        <Text style={[typography.bodySmall, { color: c.textMuted }]}>{t('profile.billing.usageUnavailable')}</Text>
      )}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        <Button label={t('profile.manageSubscription')} variant="primary" onPress={onSubscription} />
        <Button label={t('profile.billing.viewUsage')} variant="secondary" onPress={onUsage} />
      </View>
    </Card>
  );
}

export function BrainProfilePreview({
  totalConcepts,
  strengths,
  onOpen,
}: {
  totalConcepts: number | null;
  strengths: string[];
  onOpen: () => void;
}) {
  const { t } = useI18n();
  const { colors: c, spacing, typography } = useTokens();
  return (
    <Card style={{ gap: spacing.sm }}>
      <Text style={[typography.title, { color: c.textPrimary }]}>{t('profile.brainPreview.title')}</Text>
      <Text style={[typography.bodySmall, { color: c.textSecondary }]}>{t('profile.brainPreview.detail')}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, alignItems: 'center' }}>
        {totalConcepts !== null ? <Badge tone="ai" label={`${totalConcepts} ${t('profile.card.concepts')}`} /> : null}
        {strengths.slice(0, 2).map((strength) => <Badge key={strength} tone="success" label={strength} />)}
        {totalConcepts === null && strengths.length === 0 ? (
          <Text style={[typography.bodySmall, { color: c.textMuted }]}>{t('profile.brainPreview.empty')}</Text>
        ) : null}
      </View>
      <Button label={t('profile.brainPreview.open')} variant="secondary" onPress={onOpen} />
    </Card>
  );
}

export function LanguageExperienceCard({
  nativeLanguage,
  learningLanguage,
  onOpen,
}: {
  nativeLanguage?: string;
  learningLanguage?: string;
  onOpen: () => void;
}) {
  const { t } = useI18n();
  const { colors: c, spacing, typography } = useTokens();
  return (
    <Card style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg }}>
        <View style={{ gap: 3 }}>
          <Text style={[typography.caption, { color: c.textMuted }]}>{t('profile.card.nativeLanguage')}</Text>
          <Text style={[typography.title, { color: c.textPrimary }]}>{nativeLanguage || '—'}</Text>
        </View>
        <View style={{ gap: 3 }}>
          <Text style={[typography.caption, { color: c.textMuted }]}>{t('languageSelector.learningLabel')}</Text>
          <Text style={[typography.title, { color: c.textPrimary }]}>{learningLanguage || '—'}</Text>
        </View>
      </View>
      <Text style={[typography.bodySmall, { color: c.textSecondary }]}>{t('profile.languages.specialized')}</Text>
      <Button label={t('profile.languages.open')} variant="secondary" onPress={onOpen} />
    </Card>
  );
}

export function DataPrivacyCard({
  scheme,
  onScheme,
  onPrivacy,
  onMemory,
  onDocuments,
}: {
  scheme: 'light' | 'dark' | 'system';
  onScheme: (scheme: 'light' | 'dark' | 'system') => void;
  onPrivacy: () => void;
  onMemory: () => void;
  onDocuments: () => void;
}) {
  const { t } = useI18n();
  const { colors: c, spacing, typography } = useTokens();
  return (
    <Card style={{ gap: spacing.md }}>
      <View style={{ gap: spacing.xs }}>
        <Text style={[typography.caption, { color: c.textMuted }]}>{t('profile.card.theme')}</Text>
        <SegmentedControl
          options={['light', 'dark', 'system'] as const}
          value={scheme}
          onChange={onScheme}
          labelFor={(value) => t(value === 'light' ? 'profile.card.light' : value === 'dark' ? 'profile.card.dark' : 'profile.card.system')}
        />
      </View>
      <Text style={[typography.bodySmall, { color: c.textSecondary }]}>{t('profile.privacy.detail')}</Text>
      <View style={{ gap: spacing.xs }}>
        <Button label={t('profile.card.privacyData')} variant="secondary" onPress={onPrivacy} />
        <Button label={t('profile.privacy.memory')} variant="secondary" onPress={onMemory} />
        <Button label={t('profile.privacy.documents')} variant="secondary" onPress={onDocuments} />
      </View>
    </Card>
  );
}

function prioritizedUsage(items: UsageItem[]): UsageItem[] {
  return [...items].sort((a, b) => usageRatio(b) - usageRatio(a));
}

function usageRatio(item: UsageItem): number {
  if (item.limit === null) return -1;
  if (item.limit === 0) return 1;
  return item.used / item.limit;
}
