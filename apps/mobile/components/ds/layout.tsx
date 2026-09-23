import { Children, type ReactNode } from 'react';
import { Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTokens } from '../../lib/design/theme';
import { useResponsive } from '../../lib/responsive';

export type PageWidth = 'reading' | 'content' | 'wide' | 'fluid';

/** Theme-aware page canvas. It does not own scrolling or navigation. */
export function Page({
  children,
  width = 'content',
  padded = true,
  style,
  testID,
}: {
  children: ReactNode;
  width?: PageWidth;
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const { spacing } = useTokens();
  const responsive = useResponsive();
  const maxWidth = width === 'reading'
    ? 760
    : width === 'wide'
      ? 1360
      : width === 'fluid'
        ? undefined
        : responsive.maxContentWidth;

  return (
    <View
      testID={testID}
      style={[
        {
          width: '100%',
          maxWidth,
          alignSelf: 'center',
          paddingHorizontal: padded ? responsive.contentPadding : 0,
          paddingVertical: padded ? spacing.lg : 0,
          gap: spacing.md,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function PageHeader({
  title,
  description,
  eyebrow,
  action,
}: {
  title: string;
  description?: string;
  eyebrow?: string;
  action?: ReactNode;
}) {
  const { colors: c, spacing, typography } = useTokens();
  const { mode } = useResponsive();
  return (
    <View
      style={{
        flexDirection: mode === 'compact' ? 'column' : 'row',
        alignItems: mode === 'compact' ? 'stretch' : 'flex-start',
        justifyContent: 'space-between',
        gap: spacing.md,
      }}
    >
      <View style={{ flex: 1, gap: spacing.xs }}>
        {eyebrow ? <Text style={[typography.label, { color: c.aiAccent }]}>{eyebrow}</Text> : null}
        <Text accessibilityRole="header" style={[typography.h1, { color: c.textPrimary }]}>{title}</Text>
        {description ? <Text style={[typography.body, { color: c.textSecondary, maxWidth: 720 }]}>{description}</Text> : null}
      </View>
      {action ? <View style={{ alignSelf: mode === 'compact' ? 'stretch' : 'flex-start' }}>{action}</View> : null}
    </View>
  );
}

export function Section({
  title,
  description,
  action,
  children,
  style,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors: c, spacing, typography } = useTokens();
  return (
    <View style={[{ gap: spacing.sm }, style]}>
      {title || description || action ? (
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.md }}>
          <View style={{ flex: 1, gap: spacing.xxs }}>
            {title ? <Text accessibilityRole="header" style={[typography.h2, { color: c.textPrimary }]}>{title}</Text> : null}
            {description ? <Text style={[typography.bodySmall, { color: c.textSecondary }]}>{description}</Text> : null}
          </View>
          {action}
        </View>
      ) : null}
      {children}
    </View>
  );
}

/** Responsive card grid; compact layouts always remain a readable single column. */
export function ResponsiveGrid({
  children,
  maxColumns = 3,
  style,
}: {
  children: ReactNode;
  maxColumns?: 1 | 2 | 3 | 4;
  style?: StyleProp<ViewStyle>;
}) {
  const { spacing } = useTokens();
  const { mode } = useResponsive();
  const columns = mode === 'compact' ? 1 : mode === 'medium' ? Math.min(2, maxColumns) : maxColumns;
  const basis = `${Math.floor(100 / columns)}%` as `${number}%`;
  return (
    <View style={[{ flexDirection: 'row', flexWrap: 'wrap', margin: -spacing.xs }, style]}>
      {Children.map(children, (child) => (
        <View style={{ flexBasis: basis, flexGrow: 1, minWidth: 0, padding: spacing.xs }}>
          {child}
        </View>
      ))}
    </View>
  );
}

/** Two-pane composition on roomy viewports, stacked content everywhere else. */
export function ResponsiveSplit({
  primary,
  secondary,
  secondaryWidth = 320,
  secondaryFirstOnCompact = false,
}: {
  primary: ReactNode;
  secondary: ReactNode;
  secondaryWidth?: number;
  secondaryFirstOnCompact?: boolean;
}) {
  const { spacing } = useTokens();
  const { mode, isLandscape } = useResponsive();
  const split = mode === 'wide' || (mode === 'medium' && isLandscape);
  if (!split) {
    return (
      <View style={{ gap: spacing.md }}>
        {secondaryFirstOnCompact ? secondary : primary}
        {secondaryFirstOnCompact ? primary : secondary}
      </View>
    );
  }
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.lg }}>
      <View style={{ flex: 1, minWidth: 0 }}>{primary}</View>
      <View style={{ width: secondaryWidth, flexShrink: 0 }}>{secondary}</View>
    </View>
  );
}
