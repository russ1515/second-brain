import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useTokens } from '../../lib/design/theme';

/**
 * Form controls (UI/UX Sprint 1, task UI-1.5 cont.).
 * Checkbox, Radio, Avatar, Tabs, Select — theme-aware, accessible (roles,
 * states, 44pt targets, focus).
 */

// ── Checkbox ─────────────────────────────────────────────────────────────────
export function Checkbox({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  const { colors: c, radius } = useTokens();
  return (
    <Pressable
      onPress={() => onChange(!checked)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 }}
    >
      <View style={{ width: 22, height: 22, borderRadius: radius.xs, borderWidth: 2, borderColor: checked ? c.primary : c.borderStrong, backgroundColor: checked ? c.primary : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
        {checked ? <Text style={{ color: c.onPrimary, fontSize: 13, fontWeight: '800' }}>✓</Text> : null}
      </View>
      <Text style={{ color: c.textPrimary, fontSize: 15 }}>{label}</Text>
    </Pressable>
  );
}

// ── Radio group ──────────────────────────────────────────────────────────────
export function RadioGroup<T extends string>({ options, value, onChange, labelFor }: { options: readonly T[]; value: T; onChange: (v: T) => void; labelFor?: (v: T) => string }) {
  const { colors: c } = useTokens();
  return (
    <View style={{ gap: 4 }} accessibilityRole="radiogroup">
      {options.map((o) => {
        const active = o === value;
        return (
          <Pressable
            key={o}
            onPress={() => onChange(o)}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 }}
          >
            <View style={{ width: 22, height: 22, borderRadius: 999, borderWidth: 2, borderColor: active ? c.primary : c.borderStrong, alignItems: 'center', justifyContent: 'center' }}>
              {active ? <View style={{ width: 10, height: 10, borderRadius: 999, backgroundColor: c.primary }} /> : null}
            </View>
            <Text style={{ color: c.textPrimary, fontSize: 15 }}>{labelFor ? labelFor(o) : o}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ── Avatar ───────────────────────────────────────────────────────────────────
export function Avatar({ name, emoji, size = 40, ai }: { name?: string; emoji?: string; size?: number; ai?: boolean }) {
  const { colors: c } = useTokens();
  const initials = (name ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');
  return (
    <View
      accessibilityLabel={name ? `Avatar ${name}` : 'Avatar'}
      style={{ width: size, height: size, borderRadius: 999, backgroundColor: ai ? c.aiAccentSoft : c.surfaceSunken, alignItems: 'center', justifyContent: 'center' }}
    >
      <Text style={{ fontSize: emoji ? size * 0.5 : size * 0.4, color: ai ? c.aiAccent : c.textSecondary, fontWeight: '700' }}>
        {emoji ?? initials ?? '?'}
      </Text>
    </View>
  );
}

// ── Tabs (underline — distinct from SegmentedControl) ────────────────────────
export function Tabs<T extends string>({ options, value, onChange, labelFor }: { options: readonly T[]; value: T; onChange: (v: T) => void; labelFor?: (v: T) => string }) {
  const { colors: c } = useTokens();
  return (
    <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: c.borderSubtle }}>
      {options.map((o) => {
        const active = o === value;
        return (
          <Pressable
            key={o}
            onPress={() => onChange(o)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={{ paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 2, borderBottomColor: active ? c.primary : 'transparent', marginBottom: -1 }}
          >
            <Text style={{ color: active ? c.primary : c.textSecondary, fontWeight: active ? '700' : '500', fontSize: 15 }}>{labelFor ? labelFor(o) : o}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ── Select (opens a menu) ────────────────────────────────────────────────────
export function Select<T extends string>({ value, options, onChange, labelFor, placeholder }: { value: T | null; options: readonly T[]; onChange: (v: T) => void; labelFor?: (v: T) => string; placeholder?: string }) {
  const { colors: c, radius, spacing } = useTokens();
  const [open, setOpen] = useState(false);
  const label = value ? (labelFor ? labelFor(value) : value) : placeholder ?? 'Select…';
  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: c.border, borderRadius: radius.sm, paddingVertical: 11, paddingHorizontal: 14, minHeight: 44, backgroundColor: c.surface }}
      >
        <Text style={{ color: value ? c.textPrimary : c.textMuted, fontSize: 15 }}>{label}</Text>
        <Text style={{ color: c.textMuted }}>▾</Text>
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={{ flex: 1, backgroundColor: c.overlay, justifyContent: 'center', padding: 24 }} onPress={() => setOpen(false)}>
          <Pressable style={{ backgroundColor: c.surfaceElevated, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, maxHeight: '70%', overflow: 'hidden' }} onPress={() => {}}>
            <ScrollView>
              {options.map((o) => {
                const active = o === value;
                return (
                  <Pressable key={o} onPress={() => { onChange(o); setOpen(false); }} style={{ padding: spacing.md, borderTopWidth: 1, borderTopColor: c.borderSubtle, backgroundColor: active ? c.surfaceSunken : 'transparent' }}>
                    <Text style={{ color: c.textPrimary, fontSize: 15, fontWeight: active ? '700' : '400' }}>{labelFor ? labelFor(o) : o}{active ? '  ✓' : ''}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
