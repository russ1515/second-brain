import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useTokens } from '../../lib/design/theme';
import { useResponsive } from '../../lib/responsive';
import { Button } from '../ds/core';
import { AITeacherMessage } from '../ds/ai';
import type { Choice } from '../../lib/onboarding/catalog';

/**
 * Onboarding UI kit (UI/UX Sprint 2), built entirely on the Sprint 1 design
 * system. These are the shared building blocks every step reuses: an organic
 * progress ribbon (never "Étape 1/17"), selectable choice chips, a privacy
 * "why" affordance, and a scaffold that frames each step with the AI Professor's
 * voice + Back / Skip / Continue.
 */

// ── Progress ribbon (2.17) ───────────────────────────────────────────────────
export function ProgressRibbon({ value }: { value: number }) {
  const { colors: c, radius } = useTokens();
  return (
    <View style={{ gap: 6 }}>
      <View
        accessibilityRole="progressbar"
        style={{ height: 6, borderRadius: radius.full, backgroundColor: c.surfaceSunken, overflow: 'hidden' }}
      >
        <View
          style={{
            width: `${Math.round(Math.max(0.04, Math.min(1, value)) * 100)}%`,
            height: '100%',
            backgroundColor: c.aiAccent,
            borderRadius: radius.full,
          }}
        />
      </View>
      <Text style={{ color: c.textMuted, fontSize: 12 }}>
        Ton espace prend forme…
      </Text>
    </View>
  );
}

// ── Privacy "why" note (2.19) ────────────────────────────────────────────────
export function PrivacyNote({ why }: { why: string }) {
  const { colors: c } = useTokens();
  const [open, setOpen] = useState(false);
  return (
    <View style={{ marginTop: 4 }}>
      <Pressable onPress={() => setOpen((o) => !o)} accessibilityRole="button">
        <Text style={{ color: c.textMuted, fontSize: 12 }}>
          {open ? '▾ ' : '▸ '}Pourquoi je te demande ça ?
        </Text>
      </Pressable>
      {open ? (
        <Text style={{ color: c.textSecondary, fontSize: 12, marginTop: 4, lineHeight: 18 }}>
          {why}
        </Text>
      ) : null}
    </View>
  );
}

// ── Choice chip ──────────────────────────────────────────────────────────────
function Chip({
  choice,
  selected,
  onPress,
}: {
  choice: Choice;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors: c, radius } = useTokens();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={choice.label}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 11,
        paddingHorizontal: 14,
        minHeight: 44,
        borderRadius: radius.md,
        borderWidth: 1.5,
        borderColor: selected ? c.aiAccent : c.border,
        backgroundColor: selected ? c.aiAccentSoft : c.surface,
      }}
    >
      {choice.icon ? <Text style={{ fontSize: 18 }}>{choice.icon}</Text> : null}
      <Text style={{ color: selected ? c.aiAccent : c.textPrimary, fontSize: 15, fontWeight: selected ? '700' : '500' }}>
        {choice.label}
      </Text>
    </Pressable>
  );
}

/** Single-select grid of chips. */
export function SingleChoice<T extends string>({
  choices,
  value,
  onChange,
}: {
  choices: Choice<T>[];
  value: T | null | undefined;
  onChange: (v: T) => void;
}) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
      {choices.map((ch) => (
        <Chip key={ch.value} choice={ch} selected={ch.value === value} onPress={() => onChange(ch.value)} />
      ))}
    </View>
  );
}

/** Multi-select grid of chips. Order-preserving toggle. */
export function MultiChoice<T extends string>({
  choices,
  values,
  onChange,
}: {
  choices: Choice<T>[];
  values: T[];
  onChange: (v: T[]) => void;
}) {
  const toggle = (v: T) =>
    onChange(values.includes(v) ? values.filter((x) => x !== v) : [...values, v]);
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
      {choices.map((ch) => (
        <Chip key={ch.value} choice={ch} selected={values.includes(ch.value)} onPress={() => toggle(ch.value)} />
      ))}
    </View>
  );
}

// ── Step scaffold ────────────────────────────────────────────────────────────
export function StepScaffold({
  progress,
  teacherLine,
  title,
  subtitle,
  children,
  onBack,
  onSkip,
  onNext,
  nextLabel = 'Continuer',
  nextDisabled,
  saving,
  showBack = true,
}: {
  progress: number;
  teacherLine?: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
  onBack?: () => void;
  onSkip?: () => void;
  onNext?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  saving?: boolean;
  showBack?: boolean;
}) {
  const { colors: c, spacing } = useTokens();
  const { maxContentWidth } = useResponsive();
  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScrollView
        contentContainerStyle={{
          padding: spacing.lg,
          paddingBottom: spacing.xxl,
          gap: spacing.lg,
          width: '100%',
          maxWidth: maxContentWidth,
          alignSelf: 'center',
        }}
      >
        <ProgressRibbon value={progress} />
        {teacherLine ? <AITeacherMessage text={teacherLine} posture="supportive" /> : null}
        <View style={{ gap: 6 }}>
          <Text style={{ color: c.textPrimary, fontSize: 26, fontWeight: '800' }}>{title}</Text>
          {subtitle ? <Text style={{ color: c.textSecondary, fontSize: 15, lineHeight: 22 }}>{subtitle}</Text> : null}
        </View>
        {children}
      </ScrollView>
      {/* Footer actions */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          padding: spacing.md,
          borderTopWidth: 1,
          borderTopColor: c.borderSubtle,
          backgroundColor: c.surface,
          width: '100%',
          maxWidth: maxContentWidth,
          alignSelf: 'center',
        }}
      >
        {showBack && onBack ? <Button label="Retour" variant="ghost" onPress={onBack} /> : null}
        <View style={{ flex: 1 }} />
        {onSkip ? <Button label="Passer" variant="ghost" onPress={onSkip} /> : null}
        {onNext ? (
          <Button label={saving ? '…' : nextLabel} onPress={onNext} disabled={nextDisabled || saving} />
        ) : null}
      </View>
    </View>
  );
}
