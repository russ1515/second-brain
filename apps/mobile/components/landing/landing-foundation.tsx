import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  Platform,
  Pressable,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { useTokens } from '../../lib/design/theme';
import { useResponsive } from '../../lib/responsive';

export const LANDING_CONTENT_MAX = 1280;

export const webOnly = (style: Record<string, unknown>): ViewStyle =>
  (Platform.OS === 'web' ? style : {}) as unknown as ViewStyle;

export function useLandingGutter(): number {
  const { width } = useResponsive();
  return width >= 1024 ? 32 : width >= 640 ? 24 : 16;
}

export function LandingSection({
  children,
  tone = 'plain',
  compact = false,
}: {
  children: ReactNode;
  tone?: 'plain' | 'soft' | 'accent' | 'dark';
  compact?: boolean;
}) {
  const { colors: c } = useTokens();
  const { width } = useResponsive();
  const gutter = useLandingGutter();
  const backgrounds = {
    plain: 'transparent',
    soft: c.surfaceSunken,
    accent: c.aiAccentSoft,
    dark: c.textPrimary,
  } as const;
  return (
    <View style={{ width: '100%', backgroundColor: backgrounds[tone] }}>
      <View
        style={{
          width: '100%',
          maxWidth: LANDING_CONTENT_MAX,
          alignSelf: 'center',
          paddingHorizontal: gutter,
          paddingVertical: compact ? (width >= 900 ? 46 : 34) : (width >= 900 ? 88 : 56),
        }}
      >
        {children}
      </View>
    </View>
  );
}

export function LandingKicker({ children, inverse = false }: { children: ReactNode; inverse?: boolean }) {
  const { colors: c } = useTokens();
  return (
    <Text
      style={{
        color: inverse ? c.aiAccentSoft : c.aiAccent,
        fontSize: 11,
        lineHeight: 15,
        fontWeight: '800',
        letterSpacing: 1.7,
        textTransform: 'uppercase',
      }}
    >
      {children}
    </Text>
  );
}

export function LandingTitle({
  children,
  align = 'left',
  inverse = false,
}: {
  children: ReactNode;
  align?: 'left' | 'center' | 'right';
  inverse?: boolean;
}) {
  const { colors: c } = useTokens();
  const { width } = useResponsive();
  return (
    <Text
      accessibilityRole="header"
      style={{
        color: inverse ? c.background : c.textPrimary,
        fontSize: width >= 1024 ? 40 : width >= 600 ? 34 : 28,
        lineHeight: width >= 1024 ? 47 : width >= 600 ? 41 : 35,
        letterSpacing: -0.45,
        fontWeight: '800',
        textAlign: align,
      }}
    >
      {children}
    </Text>
  );
}

export function LandingLead({
  children,
  align = 'left',
  inverse = false,
  maxWidth = 720,
}: {
  children: ReactNode;
  align?: 'left' | 'center' | 'right';
  inverse?: boolean;
  maxWidth?: number;
}) {
  const { colors: c } = useTokens();
  return (
    <Text
      style={{
        color: inverse ? c.border : c.textSecondary,
        fontSize: 16,
        lineHeight: 25,
        maxWidth,
        textAlign: align,
      }}
    >
      {children}
    </Text>
  );
}

export function SectionHeading({
  kicker,
  title,
  lead,
  align = 'left',
  inverse = false,
}: {
  kicker: string;
  title: string;
  lead?: string;
  align?: 'left' | 'center' | 'right';
  inverse?: boolean;
}) {
  return (
    <View style={{ gap: 10, alignItems: align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start' }}>
      <LandingKicker inverse={inverse}>{kicker}</LandingKicker>
      <LandingTitle align={align} inverse={inverse}>{title}</LandingTitle>
      {lead ? <LandingLead align={align} inverse={inverse}>{lead}</LandingLead> : null}
    </View>
  );
}

export function LandingPill({
  label,
  tone = 'neutral',
  icon,
}: {
  label: string;
  tone?: 'neutral' | 'accent' | 'success' | 'warning';
  icon?: string;
}) {
  const { colors: c, radius } = useTokens();
  const color = tone === 'accent' ? c.aiAccent : tone === 'success' ? c.success : tone === 'warning' ? c.warning : c.textSecondary;
  const background = tone === 'accent' ? c.aiAccentSoft : tone === 'success' ? c.successSoft : tone === 'warning' ? c.warningSoft : c.surface;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 34, borderWidth: 1, borderColor: color, backgroundColor: background, borderRadius: radius.full, paddingVertical: 6, paddingHorizontal: 11 }}>
      {icon ? <Text accessible={false} style={{ color, fontSize: 12, fontWeight: '800' }}>{icon}</Text> : null}
      <Text style={{ color, fontSize: 12, lineHeight: 17, fontWeight: '700' }}>{label}</Text>
    </View>
  );
}

export type LandingButtonVariant = 'primary' | 'secondary' | 'quiet' | 'inverse';

export function LandingButton({
  label,
  onPress,
  variant = 'primary',
  compact = false,
  disabled = false,
  icon,
  accessibilityHint,
}: {
  label: string;
  onPress?: () => void;
  variant?: LandingButtonVariant;
  compact?: boolean;
  disabled?: boolean;
  icon?: string;
  accessibilityHint?: string;
}) {
  const { colors: c, radius } = useTokens();
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const primary = variant === 'primary';
  const inverse = variant === 'inverse';
  const quiet = variant === 'quiet';
  const backgroundColor = primary
    ? hovered ? c.primaryHover : c.primary
    : inverse
      ? c.background
      : hovered ? c.surfaceSunken : quiet ? 'transparent' : c.surface;
  const textColor = primary ? c.onPrimary : inverse ? c.textPrimary : quiet ? c.aiAccent : c.textPrimary;
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={({ pressed }) => [
        {
          minHeight: compact ? 42 : 50,
          minWidth: compact ? undefined : 148,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          borderRadius: radius.md,
          borderWidth: focused ? 2 : primary || quiet || inverse ? 0 : 1,
          borderColor: focused ? c.focus : c.borderStrong,
          backgroundColor,
          paddingVertical: compact ? 9 : 13,
          paddingHorizontal: compact ? 13 : 21,
          opacity: disabled ? 0.5 : pressed ? 0.82 : 1,
        },
        webOnly({ cursor: disabled ? 'not-allowed' : 'pointer', transition: 'background-color 140ms ease, opacity 140ms ease, border-color 140ms ease' }),
      ]}
    >
      {icon ? <Text accessible={false} style={{ color: textColor, fontSize: 14, fontWeight: '800' }}>{icon}</Text> : null}
      <Text style={{ color: textColor, fontSize: compact ? 13 : 15, lineHeight: compact ? 18 : 21, fontWeight: '800', textAlign: 'center' }}>{label}</Text>
    </Pressable>
  );
}

/** A short, action-triggered transition. It never loops or implies AI progress. */
export function StageTransition({ revision, children }: { revision: string | number; children: ReactNode }) {
  const { reducedMotion, motion } = useTokens();
  const opacity = useRef(new Animated.Value(1)).current;
  const translate = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reducedMotion) {
      opacity.setValue(1);
      translate.setValue(0);
      return;
    }
    opacity.setValue(0.35);
    translate.setValue(8);
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: motion.duration.normal, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(translate, { toValue: 0, duration: motion.duration.normal, useNativeDriver: Platform.OS !== 'web' }),
    ]).start();
  }, [motion.duration.normal, opacity, reducedMotion, revision, translate]);
  return <Animated.View style={{ opacity, transform: [{ translateY: translate }] }}>{children}</Animated.View>;
}

export function DemoLabel({ label }: { label: string }) {
  const { colors: c, radius } = useTokens();
  return (
    <View style={{ alignSelf: 'flex-start', borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceElevated, borderRadius: radius.full, paddingVertical: 5, paddingHorizontal: 10 }}>
      <Text style={{ color: c.textMuted, fontSize: 10, lineHeight: 14, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' }}>{label}</Text>
    </View>
  );
}

export function Surface({
  children,
  accent = false,
  style,
}: {
  children: ReactNode;
  accent?: boolean;
  style?: ViewStyle | ViewStyle[];
}) {
  const { colors: c, radius, elevation } = useTokens();
  return (
    <View
      style={[
        {
          borderWidth: accent ? 1.5 : 1,
          borderColor: accent ? c.aiAccent : c.border,
          backgroundColor: accent ? c.aiAccentSoft : c.surfaceElevated,
          borderRadius: radius.xl,
          padding: 20,
        },
        webOnly({ boxShadow: accent ? elevation.medium.boxShadow : elevation.low.boxShadow }),
        style,
      ]}
    >
      {children}
    </View>
  );
}
