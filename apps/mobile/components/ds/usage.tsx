import { Text, View } from 'react-native';
import { resolveUsageMeter, type UsageUnit } from '@second-brain/shared';
import { useTokens } from '../../lib/design/theme';
import { Card, Progress } from './core';

export function UsageMeter({
  label,
  used,
  limit,
  unit,
  resetAt,
  formatValue = (value) => String(value),
  unlimitedLabel = 'Unlimited',
  remainingLabel,
  resetLabel,
  compact = false,
}: {
  label: string;
  used: number;
  limit: number | null;
  unit: UsageUnit;
  resetAt?: string | null;
  formatValue?: (value: number, unit: UsageUnit) => string;
  unlimitedLabel?: string;
  remainingLabel?: string;
  resetLabel?: string;
  compact?: boolean;
}) {
  const { colors: c, spacing, typography } = useTokens();
  const meter = resolveUsageMeter(used, limit);
  const tone = meter.tone === 'critical' ? c.error : meter.tone === 'warning' ? c.warning : c.primary;
  const valueText = meter.unlimited
    ? `${formatValue(used, unit)} / ${unlimitedLabel}`
    : `${formatValue(used, unit)} / ${formatValue(limit as number, unit)}`;

  const content = (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm }}>
        <Text style={[typography.title, { color: c.textPrimary, flex: 1 }]}>{label}</Text>
        <Text style={[typography.bodySmall, { color: tone, fontVariant: ['tabular-nums'], textAlign: 'right' }]}>{valueText}</Text>
      </View>
      {meter.percent !== null ? <Progress value={meter.percent} tone={meter.tone === 'primary' ? 'primary' : undefined} color={tone} /> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: spacing.xs }}>
        {remainingLabel && meter.remaining !== null ? (
          <Text style={[typography.caption, { color: c.textMuted }]}>{remainingLabel}: {formatValue(meter.remaining, unit)}</Text>
        ) : <View />}
        {resetLabel && resetAt && !meter.unlimited ? <Text style={[typography.caption, { color: c.textMuted }]}>{resetLabel}: {resetAt}</Text> : null}
      </View>
    </>
  );

  if (compact) {
    return (
      <View style={{ gap: spacing.xs, paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: c.borderSubtle }}>
        {content}
      </View>
    );
  }
  return <Card style={{ gap: spacing.sm }}>{content}</Card>;
}
