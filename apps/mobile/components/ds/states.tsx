import type { ReactNode } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import type { AIWorkState, UXStateKind } from '@second-brain/shared';
import { useTokens } from '../../lib/design/theme';
import { useI18n } from '../../lib/i18n';
import { Alert, Button, Card, Progress } from './core';

export function AIWorkStateIndicator({
  work,
  message,
  compact = false,
}: {
  work: AIWorkState;
  message: string;
  compact?: boolean;
}) {
  const { colors: c, spacing, typography } = useTokens();
  const progress = work.progress;
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLiveRegion="polite"
      accessibilityLabel={message}
      accessibilityValue={progress.mode === 'determinate' ? { now: progress.percent, min: 0, max: 100 } : undefined}
      style={{ gap: spacing.xs, width: '100%' }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <ActivityIndicator size={compact ? 'small' : 'large'} color={c.aiAccent} />
        <View style={{ flex: 1 }}>
          <Text style={[compact ? typography.bodySmall : typography.title, { color: c.textPrimary }]}>{message}</Text>
          <Text style={[typography.caption, { color: c.textMuted }]}>{work.stage}</Text>
        </View>
        {progress.mode === 'determinate' ? <Text style={[typography.caption, { color: c.textSecondary }]}>{progress.percent}%</Text> : null}
      </View>
      {progress.mode === 'determinate' ? <Progress value={progress.percent} tone="ai" /> : null}
    </View>
  );
}

export function SmartLoadingState({
  title,
  detail,
  work,
  compact = false,
}: {
  title?: string;
  detail?: string;
  work?: AIWorkState;
  compact?: boolean;
}) {
  const { colors: c, spacing, typography } = useTokens();
  const { t } = useI18n();
  const label = title ?? t(work ? 'state.processing' : 'state.loading');
  return (
    <View
      accessibilityLiveRegion="polite"
      style={{ alignItems: compact ? 'flex-start' : 'center', padding: compact ? spacing.sm : spacing.xl, gap: spacing.sm }}
    >
      {work ? (
        <AIWorkStateIndicator work={work} message={label} compact={compact} />
      ) : (
        <>
          <ActivityIndicator size={compact ? 'small' : 'large'} color={c.primary} />
          <Text style={[compact ? typography.bodySmall : typography.title, { color: c.textPrimary, textAlign: compact ? 'left' : 'center' }]}>{label}</Text>
        </>
      )}
      {detail ? <Text style={[typography.bodySmall, { color: c.textSecondary, textAlign: compact ? 'left' : 'center' }]}>{detail}</Text> : null}
    </View>
  );
}

export function SmartEmptyState({
  icon,
  title,
  detail,
  action,
}: {
  icon?: string;
  title: string;
  detail?: string;
  action?: ReactNode;
}) {
  const { colors: c, spacing, typography } = useTokens();
  return (
    <View style={{ alignItems: 'center', padding: spacing.xl, gap: spacing.xs }}>
      {icon ? <Text accessible={false} style={{ fontSize: 34 }}>{icon}</Text> : null}
      <Text accessibilityRole="header" style={[typography.title, { color: c.textPrimary, textAlign: 'center' }]}>{title}</Text>
      {detail ? <Text style={[typography.bodySmall, { color: c.textMuted, textAlign: 'center', maxWidth: 520 }]}>{detail}</Text> : null}
      {action ? <View style={{ marginTop: spacing.sm }}>{action}</View> : null}
    </View>
  );
}

export function SmartErrorState({
  title,
  detail,
  retryable = false,
  onRetry,
  retryLabel,
  compact = false,
}: {
  title?: string;
  detail?: string;
  retryable?: boolean;
  onRetry?: () => void;
  retryLabel?: string;
  compact?: boolean;
}) {
  const { spacing } = useTokens();
  const { t } = useI18n();
  return (
    <View accessibilityLiveRegion="assertive" style={{ gap: spacing.sm }}>
      <Alert tone="error" title={title ?? t('state.error')} detail={detail} />
      {retryable && onRetry ? (
        <Button label={retryLabel ?? t('app.tryAgain')} variant="secondary" size={compact ? 'sm' : 'md'} onPress={onRetry} />
      ) : null}
    </View>
  );
}

const noticeTone: Partial<Record<UXStateKind, 'info' | 'success' | 'warning' | 'error'>> = {
  partial: 'warning',
  success: 'success',
  stale: 'warning',
  offline: 'warning',
  'quota-limited': 'warning',
};

/** Common semantic state boundary. It never synthesizes progress or retries. */
export function SmartState({
  state,
  title,
  detail,
  work,
  retryable,
  onRetry,
  children,
}: {
  state: UXStateKind;
  title?: string;
  detail?: string;
  work?: AIWorkState;
  retryable?: boolean;
  onRetry?: () => void;
  children?: ReactNode;
}) {
  const { spacing } = useTokens();
  const { t } = useI18n();
  if (state === 'loading' || state === 'processing') {
    return <SmartLoadingState title={title} detail={detail} work={work} />;
  }
  if (state === 'error') {
    return <SmartErrorState title={title} detail={detail} retryable={retryable} onRetry={onRetry} />;
  }

  const tone = noticeTone[state];
  if (!tone) return <>{children}</>;
  const fallbackTitle = t(`state.${state}` as Parameters<typeof t>[0]);
  return (
    <View style={{ gap: spacing.sm }}>
      <Alert tone={tone} title={title ?? fallbackTitle} detail={detail} />
      {children}
    </View>
  );
}

/** Legacy-looking state surface for places that expect a card boundary. */
export function SmartEmptyCard(props: Parameters<typeof SmartEmptyState>[0]) {
  return <Card><SmartEmptyState {...props} /></Card>;
}
