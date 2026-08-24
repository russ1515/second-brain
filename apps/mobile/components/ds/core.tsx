import { useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { useTokens } from '../../lib/design/theme';

/**
 * Core components (UI/UX Sprint 1, task UI-1.5).
 *
 * The foundational primitives, all theme-aware (read tokens, never hard-coded)
 * and accessible by construction: 44pt min touch targets, visible focus rings,
 * accessibilityRole/label, and status conveyed by icon+text — never colour alone.
 */

// ── Button ───────────────────────────────────────────────────────────────────
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'ai';
type ButtonSize = 'sm' | 'md' | 'lg';

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled,
  loading,
  icon,
  fullWidth,
  accessibilityLabel,
}: {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  icon?: string;
  fullWidth?: boolean;
  accessibilityLabel?: string;
}) {
  const { colors: c, radius } = useTokens();
  const [focused, setFocused] = useState(false);
  const off = disabled || loading;

  const pad = size === 'sm' ? { v: 8, h: 14, f: 14 } : size === 'lg' ? { v: 15, h: 24, f: 17 } : { v: 12, h: 18, f: 15 };
  const bg: Record<ButtonVariant, string> = {
    primary: c.primary, secondary: c.surfaceSunken, ghost: 'transparent', danger: c.error, ai: c.aiAccent,
  };
  const fg: Record<ButtonVariant, string> = {
    primary: c.onPrimary, secondary: c.textPrimary, ghost: c.primary, danger: c.onColor, ai: c.onAiAccent,
  };
  const borderCol = variant === 'secondary' ? c.border : 'transparent';

  return (
    <Pressable
      onPress={off ? undefined : onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={({ pressed }) => [
        styles.btn,
        {
          backgroundColor: bg[variant],
          borderColor: focused ? c.focus : borderCol,
          borderWidth: focused ? 2 : variant === 'secondary' ? 1 : 0,
          borderRadius: radius.sm,
          paddingVertical: pad.v,
          paddingHorizontal: pad.h,
          minHeight: 44,
          opacity: off ? 0.5 : pressed ? 0.85 : 1,
          transform: [{ scale: pressed && !off ? 0.985 : 1 }],
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg[variant]} />
      ) : (
        <Text style={{ color: fg[variant], fontWeight: '600', fontSize: pad.f }}>
          {icon ? `${icon}  ` : ''}{label}
        </Text>
      )}
    </Pressable>
  );
}

// ── IconButton ───────────────────────────────────────────────────────────────
export function IconButton({ icon, onPress, label, disabled }: { icon: string; onPress?: () => void; label: string; disabled?: boolean }) {
  const { colors: c, radius } = useTokens();
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={({ pressed }) => [
        styles.iconBtn,
        { borderRadius: radius.sm, borderWidth: focused ? 2 : 0, borderColor: c.focus, backgroundColor: c.surfaceSunken, opacity: disabled ? 0.5 : pressed ? 0.8 : 1 },
      ]}
    >
      <Text style={{ fontSize: 18, color: c.textPrimary }}>{icon}</Text>
    </Pressable>
  );
}

// ── Badge (tone conveyed by text too, not colour alone) ──────────────────────
type Tone = 'neutral' | 'primary' | 'ai' | 'success' | 'warning' | 'error' | 'info';
export function Badge({ label, tone = 'neutral' }: { label: string; tone?: Tone }) {
  const { colors: c, radius } = useTokens();
  const map: Record<Tone, { bg: string; fg: string }> = {
    neutral: { bg: c.surfaceSunken, fg: c.textSecondary },
    primary: { bg: c.primary, fg: c.onPrimary },
    ai: { bg: c.aiAccent, fg: c.onAiAccent },
    success: { bg: c.successSoft, fg: c.success },
    warning: { bg: c.warningSoft, fg: c.warning },
    error: { bg: c.errorSoft, fg: c.error },
    info: { bg: c.infoSoft, fg: c.info },
  };
  return (
    <View style={{ backgroundColor: map[tone].bg, borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 3, alignSelf: 'flex-start' }}>
      <Text style={{ color: map[tone].fg, fontSize: 11, fontWeight: '700', letterSpacing: 0.3 }}>{label}</Text>
    </View>
  );
}

// ── Card (elevation used sparingly) ──────────────────────────────────────────
export function Card({
  children,
  elevated,
  style,
  testID,
}: {
  children: ReactNode;
  elevated?: boolean;
  style?: ViewStyle;
  testID?: string;
}) {
  const { colors: c, radius, spacing, elevation } = useTokens();
  return (
    <View
      testID={testID}
      style={[
        {
          backgroundColor: elevated ? c.surfaceElevated : c.surface,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: c.borderSubtle,
          padding: spacing.md,
        },
        elevated ? elevation.low : null,
        style,
      ]}
    >
      {children}
    </View>
  );
}

// ── SegmentedControl ─────────────────────────────────────────────────────────
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  labelFor,
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  labelFor?: (v: T) => string;
}) {
  const { colors: c, radius } = useTokens();
  return (
    <View style={{ flexDirection: 'row', backgroundColor: c.surfaceSunken, borderRadius: radius.sm, padding: 3, alignSelf: 'flex-start' }}>
      {options.map((o) => {
        const active = o === value;
        return (
          <Pressable
            key={o}
            onPress={() => onChange(o)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={{ paddingVertical: 8, paddingHorizontal: 16, borderRadius: radius.xs, backgroundColor: active ? c.surface : 'transparent', minHeight: 40, justifyContent: 'center' }}
          >
            <Text style={{ color: active ? c.textPrimary : c.textSecondary, fontWeight: active ? '700' : '500', fontSize: 14 }}>
              {labelFor ? labelFor(o) : o}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ── Switch ───────────────────────────────────────────────────────────────────
export function Switch({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  const { colors: c } = useTokens();
  return (
    <Pressable
      onPress={() => onChange(!value)}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value }}
      style={{ width: 48, height: 28, borderRadius: 999, padding: 3, backgroundColor: value ? c.primary : c.borderStrong, justifyContent: 'center' }}
    >
      <View style={{ width: 22, height: 22, borderRadius: 999, backgroundColor: c.onColor, alignSelf: value ? 'flex-end' : 'flex-start' }} />
    </Pressable>
  );
}

// ── Progress ─────────────────────────────────────────────────────────────────
export function Progress({ value, tone = 'primary' }: { value: number; tone?: 'primary' | 'ai' | 'success' }) {
  const { colors: c, radius } = useTokens();
  const pct = Math.max(0, Math.min(100, value));
  const col = tone === 'ai' ? c.aiAccent : tone === 'success' ? c.success : c.primary;
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ now: pct, min: 0, max: 100 }}
      style={{ height: 8, borderRadius: radius.full, backgroundColor: c.surfaceSunken, overflow: 'hidden' }}
    >
      <View style={{ height: 8, width: `${pct}%`, backgroundColor: col, borderRadius: radius.full }} />
    </View>
  );
}

// ── Skeleton (respects reduced motion) ───────────────────────────────────────
export function Skeleton({ height = 16, width = '100%' as number | `${number}%` }: { height?: number; width?: number | `${number}%` }) {
  const { colors: c, radius, reducedMotion } = useTokens();
  const anim = useRef(new Animated.Value(0.5)).current;
  if (!reducedMotion) {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.5, duration: 700, useNativeDriver: true }),
      ]),
    ).start();
  }
  return <Animated.View style={{ height, width, borderRadius: radius.xs, backgroundColor: c.surfaceSunken, opacity: reducedMotion ? 0.7 : anim }} />;
}

// ── Alert (icon + text, not colour alone) ────────────────────────────────────
export function Alert({ tone, title, detail }: { tone: 'info' | 'success' | 'warning' | 'error'; title: string; detail?: string }) {
  const { colors: c, radius, spacing } = useTokens();
  const map = {
    info: { bg: c.infoSoft, fg: c.info, icon: 'ℹ︎' },
    success: { bg: c.successSoft, fg: c.success, icon: '✓' },
    warning: { bg: c.warningSoft, fg: c.warning, icon: '⚠︎' },
    error: { bg: c.errorSoft, fg: c.error, icon: '✕' },
  }[tone];
  return (
    <View style={{ flexDirection: 'row', gap: spacing.sm, backgroundColor: map.bg, borderRadius: radius.md, padding: spacing.md, borderLeftWidth: 3, borderLeftColor: map.fg }}>
      <Text style={{ color: map.fg, fontSize: 16, fontWeight: '700' }}>{map.icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={{ color: c.textPrimary, fontWeight: '600', fontSize: 15 }}>{title}</Text>
        {detail ? <Text style={{ color: c.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 2 }}>{detail}</Text> : null}
      </View>
    </View>
  );
}

// ── Input (label + focus ring + error) ───────────────────────────────────────
export function Input({
  label,
  error,
  value,
  onChangeText,
  ...rest
}: { label?: string; error?: string } & TextInputProps) {
  const { colors: c, radius, spacing } = useTokens();
  const [focused, setFocused] = useState(false);
  const borderCol = error ? c.error : focused ? c.focus : c.border;
  return (
    <View style={{ gap: 6 }}>
      {label ? <Text style={{ color: c.textSecondary, fontSize: 13, fontWeight: '600' }}>{label}</Text> : null}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholderTextColor={c.textMuted}
        accessibilityLabel={label}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          borderWidth: focused ? 2 : 1,
          borderColor: borderCol,
          borderRadius: radius.sm,
          paddingVertical: 11,
          paddingHorizontal: 14,
          minHeight: 44,
          color: c.textPrimary,
          backgroundColor: c.surface,
          fontSize: 15,
        }}
        {...rest}
      />
      {error ? <Text style={{ color: c.error, fontSize: 12 }}>{error}</Text> : null}
    </View>
  );
}

// ── EmptyState ───────────────────────────────────────────────────────────────
export function EmptyState({ icon, title, detail }: { icon?: string; title: string; detail?: string }) {
  const { colors: c, spacing } = useTokens();
  return (
    <View style={{ alignItems: 'center', padding: spacing.xl, gap: 6 }}>
      {icon ? <Text style={{ fontSize: 34 }}>{icon}</Text> : null}
      <Text style={{ color: c.textPrimary, fontWeight: '700', fontSize: 16 }}>{title}</Text>
      {detail ? <Text style={{ color: c.textMuted, fontSize: 14, textAlign: 'center', lineHeight: 20 }}>{detail}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  btn: { alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
