import { type ViewStyle } from 'react-native';
import type { ReactNode } from 'react';
import { Alert, Button as DesignSystemButton, Card as DesignSystemCard } from './ds/core';
import { SmartEmptyState, SmartLoadingState } from './ds/states';

/**
 * Legacy shared primitives used by screens migrating to the design system.
 *
 * They keep their exact original APIs (so every consuming screen works
 * unchanged) but read design-system tokens via `useTokens()` — so they are
 * theme-aware (correct in BOTH light and dark) and match the new visual
 * language. As screens move off the static `lib/theme` palette to `useTokens`,
 * these primitives follow the active scheme with them.
 */

/** @deprecated Import `Card` from `components/ds` or `components/ds/core`. */
export function Card({
  children,
  style,
  testID,
}: {
  children: ReactNode;
  style?: ViewStyle;
  testID?: string;
}) {
  return <DesignSystemCard testID={testID} style={style}>{children}</DesignSystemCard>;
}

/** @deprecated Import `Button` from `components/ds` or `components/ds/core`. */
export function Button({
  label,
  onPress,
  disabled,
  busy,
  variant = 'primary',
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  variant?: 'primary' | 'ghost' | 'danger';
}) {
  return (
    <DesignSystemButton
      label={label}
      onPress={onPress}
      disabled={disabled}
      loading={busy}
      variant={variant}
      fullWidth
    />
  );
}

/** @deprecated Use `SmartErrorState` or `Alert` from `components/ds`. */
export function ErrorBanner({ message }: { message: string }) {
  return <Alert tone="error" title={message} />;
}

/** @deprecated Use `SmartLoadingState` from `components/ds/states`. */
export function Loading({ label }: { label?: string }) {
  return <SmartLoadingState title={label} />;
}

/** @deprecated Use `SmartEmptyState` from `components/ds/states`. */
export function Empty({ title, detail }: { title: string; detail?: string }) {
  return (
    <DesignSystemCard>
      <SmartEmptyState title={title} detail={detail} />
    </DesignSystemCard>
  );
}
