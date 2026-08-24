import {
  ActivityIndicator,
  Pressable,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import type { ReactNode } from 'react';
import { useTokens } from '../lib/design/theme';

/**
 * Legacy shared primitives used by screens migrating to the design system.
 *
 * They keep their exact original APIs (so every consuming screen works
 * unchanged) but read design-system tokens via `useTokens()` — so they are
 * theme-aware (correct in BOTH light and dark) and match the new visual
 * language. As screens move off the static `lib/theme` palette to `useTokens`,
 * these primitives follow the active scheme with them.
 */

export function Card({
  children,
  style,
  testID,
}: {
  children: ReactNode;
  style?: ViewStyle;
  testID?: string;
}) {
  const { colors: c, radius, spacing } = useTokens();
  return (
    <View
      testID={testID}
      style={[
        {
          backgroundColor: c.surface,
          borderRadius: radius.lg,
          padding: spacing.md,
          borderWidth: 1,
          borderColor: c.borderSubtle,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

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
  const { colors: c, radius, spacing } = useTokens();
  const off = disabled || busy;
  const bg = variant === 'primary' ? c.primary : 'transparent';
  const borderCol = variant === 'ghost' ? c.border : variant === 'danger' ? c.error : 'transparent';
  const fg = variant === 'primary' ? c.onPrimary : variant === 'danger' ? c.error : c.textSecondary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off, busy: !!busy }}
      onPress={onPress}
      disabled={off}
      style={({ pressed }) => ({
        backgroundColor: bg,
        borderRadius: radius.md,
        borderWidth: variant === 'primary' ? 0 : 1,
        borderColor: borderCol,
        paddingVertical: 14,
        paddingHorizontal: spacing.md,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 48,
        // Micro-interaction (§42): subtle press feedback for tactile response.
        opacity: off ? 0.5 : pressed ? 0.85 : 1,
        transform: [{ scale: pressed && !off ? 0.985 : 1 }],
      })}
    >
      {busy ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text style={{ color: fg, fontSize: 16, fontWeight: '600' }}>{label}</Text>
      )}
    </Pressable>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  const { colors: c, radius, spacing } = useTokens();
  return (
    <View style={{ backgroundColor: c.errorSoft, borderRadius: radius.md, padding: spacing.sm }}>
      <Text style={{ color: c.error, fontSize: 14 }}>{message}</Text>
    </View>
  );
}

export function Loading({ label }: { label?: string }) {
  const { colors: c, spacing } = useTokens();
  return (
    <View style={{ paddingVertical: spacing.xl, alignItems: 'center', gap: spacing.sm }}>
      <ActivityIndicator size="large" color={c.primary} />
      {label ? <Text style={{ color: c.textSecondary, fontSize: 14 }}>{label}</Text> : null}
    </View>
  );
}

export function Empty({ title, detail }: { title: string; detail?: string }) {
  const { colors: c } = useTokens();
  return (
    <Card>
      <Text style={{ color: c.textPrimary, fontSize: 16, fontWeight: '600' }}>{title}</Text>
      {detail ? (
        <Text style={{ color: c.textSecondary, fontSize: 14, marginTop: 6, lineHeight: 20 }}>
          {detail}
        </Text>
      ) : null}
    </Card>
  );
}
