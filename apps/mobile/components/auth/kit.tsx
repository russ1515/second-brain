import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Modal, Platform, Pressable, Text, TextInput, View, type TextInputProps, type ViewStyle } from 'react-native';
import { darkColors as C, radius, spacing } from '../../lib/design/tokens';
import { SUPPORTED_LANGUAGES } from '@second-brain/shared';
import { useI18n } from '../../lib/i18n';

/**
 * Auth kit (UI/UX — premium sign-in). A self-contained, always-dark visual
 * language for the authentication experience: a subtle glow background, a
 * glassmorphism card, a compact language pill, a dark input with the browser's
 * white autofill neutralised, and a 6-digit OTP input. Uses the dark token
 * palette directly so the premium look is independent of the app theme.
 */

// ── Glow background (dark premium + soft halo) ───────────────────────────────
export function GlowBackground({ children }: { children: ReactNode }) {
  const web = Platform.OS === 'web';
  const halo = (style: ViewStyle, color: string, size: number): ViewStyle => ({
    position: 'absolute',
    width: size,
    height: size,
    borderRadius: size / 2,
    backgroundColor: color,
    opacity: 0.22,
    ...(web ? ({ filter: 'blur(90px)' } as unknown as ViewStyle) : { opacity: 0.14 }),
    ...style,
  });
  return (
    <View style={{ flex: 1, backgroundColor: C.background }}>
      <View pointerEvents="none" style={halo({ top: -120, left: -80 }, C.aiAccent, 420)} />
      <View pointerEvents="none" style={halo({ bottom: -160, right: -100 }, C.primary, 460)} />
      <View pointerEvents="none" style={halo({ top: '40%', left: '55%' }, C.primaryHover, 260)} />
      {children}
    </View>
  );
}

// ── Glassmorphism card ───────────────────────────────────────────────────────
export function GlassCard({ children }: { children: ReactNode }) {
  const web = Platform.OS === 'web';
  return (
    <View
      style={{
        width: '100%',
        maxWidth: 420,
        alignSelf: 'center',
        borderRadius: radius.xl,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.10)',
        backgroundColor: 'rgba(28,28,34,0.72)',
        padding: spacing.lg,
        gap: spacing.md,
        ...(web ? ({ backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)' } as unknown as ViewStyle) : {}),
      }}
    >
      {children}
    </View>
  );
}

// ── Language pill (top-right) ────────────────────────────────────────────────
const LANGS = Object.values(SUPPORTED_LANGUAGES);
export function LangPill() {
  const { locale, setLocale } = useI18n();
  const [open, setOpen] = useState(false);
  const current = LANGS.find((l) => l.code === locale) ?? LANGS[0];
  const top = LANGS.slice(0, 8);
  return (
    <>
      <Pressable onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel="Changer de langue"
        style={{ flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12 }}>
        <Text style={{ fontSize: 14 }}>{current.flag}</Text>
        <Text style={{ color: C.textSecondary, fontSize: 13, fontWeight: '700' }}>{current.code.toUpperCase()}</Text>
        <Text style={{ color: C.textMuted, fontSize: 11 }}>▾</Text>
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 }} onPress={() => setOpen(false)}>
          <Pressable style={{ backgroundColor: C.surfaceElevated, borderRadius: radius.lg, borderWidth: 1, borderColor: C.border, overflow: 'hidden' }} onPress={() => {}}>
            {top.map((l) => (
              <Pressable key={l.code} onPress={() => { setLocale(l.code); setOpen(false); }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: spacing.md, borderTopWidth: 1, borderTopColor: C.borderSubtle, backgroundColor: l.code === locale ? C.surfaceSunken : 'transparent' }}>
                <Text style={{ fontSize: 16 }}>{l.flag}</Text>
                <Text style={{ color: C.textPrimary, fontSize: 15, flex: 1 }}>{l.name}</Text>
                {l.code === locale ? <Text style={{ color: C.aiAccent }}>✓</Text> : null}
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

// ── Dark input with autofill neutralised ─────────────────────────────────────
let autofillInjected = false;
function injectAutofillFix() {
  if (autofillInjected || Platform.OS !== 'web' || typeof document === 'undefined') return;
  autofillInjected = true;
  const style = document.createElement('style');
  style.textContent =
    'input:-webkit-autofill,input:-webkit-autofill:hover,input:-webkit-autofill:focus,input:-webkit-autofill:active{' +
    '-webkit-box-shadow:0 0 0 1000px ' + C.surfaceSunken + ' inset !important;' +
    '-webkit-text-fill-color:' + C.textPrimary + ' !important;caret-color:' + C.textPrimary + ';transition:background-color 9999s ease-in-out 0s;}';
  document.head.appendChild(style);
}

export function AuthField({ label, error, ...rest }: { label: string; error?: string } & TextInputProps) {
  const [focused, setFocused] = useState(false);
  useEffect(() => { injectAutofillFix(); }, []);
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: C.textSecondary, fontSize: 13, fontWeight: '600' }}>{label}</Text>
      <TextInput
        placeholderTextColor={C.textMuted}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          borderWidth: 1,
          borderColor: error ? C.error : focused ? C.focus : C.border,
          borderRadius: radius.md,
          paddingVertical: 12,
          paddingHorizontal: 14,
          minHeight: 48,
          color: C.textPrimary,
          backgroundColor: C.surfaceSunken,
          fontSize: 15,
        }}
        {...rest}
      />
      {error ? <Text style={{ color: C.error, fontSize: 12 }}>{error}</Text> : null}
    </View>
  );
}

// ── Primary button (high contrast) ───────────────────────────────────────────
export function AuthButton({ label, onPress, busy, disabled, variant = 'primary' }: { label: string; onPress: () => void; busy?: boolean; disabled?: boolean; variant?: 'primary' | 'ghost' }) {
  const off = busy || disabled;
  const primary = variant === 'primary';
  return (
    <Pressable onPress={off ? undefined : onPress} disabled={off} accessibilityRole="button" accessibilityLabel={label}
      style={{ minHeight: 50, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18,
        backgroundColor: primary ? C.primary : 'transparent', borderWidth: primary ? 0 : 1, borderColor: C.border, opacity: off ? 0.6 : 1 }}>
      <Text style={{ color: primary ? C.onPrimary : C.textSecondary, fontSize: 16, fontWeight: '800' }}>{busy ? '…' : label}</Text>
    </Pressable>
  );
}

// ── 6-digit OTP input ────────────────────────────────────────────────────────
export function OtpInput({ value, onChange, length = 6 }: { value: string; onChange: (v: string) => void; length?: number }) {
  const refs = useRef<(TextInput | null)[]>([]);
  const chars = Array.from({ length }, (_, i) => value[i] ?? '');
  const setAt = (i: number, ch: string) => {
    const digits = ch.replace(/\D/g, '');
    // Paste of a whole code into one box → distribute across all boxes.
    if (digits.length > 1) {
      const next = digits.slice(0, length);
      onChange(next);
      refs.current[Math.min(next.length, length - 1)]?.focus();
      return;
    }
    const next = (value.slice(0, i) + digits + value.slice(i + 1)).slice(0, length);
    onChange(next);
    if (digits && i < length - 1) refs.current[i + 1]?.focus();
  };
  return (
    <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'center' }}>
      {chars.map((ch, i) => (
        <TextInput
          key={i}
          ref={(r) => { refs.current[i] = r; }}
          value={ch}
          onChangeText={(txt) => setAt(i, txt)}
          onKeyPress={(e) => { if (e.nativeEvent.key === 'Backspace' && !ch && i > 0) refs.current[i - 1]?.focus(); }}
          keyboardType="number-pad"
          maxLength={1}
          accessibilityLabel={`Chiffre ${i + 1}`}
          style={{ width: 46, height: 56, borderRadius: radius.md, borderWidth: 1, borderColor: ch ? C.aiAccent : C.border, backgroundColor: C.surfaceSunken, color: C.textPrimary, fontSize: 22, fontWeight: '800', textAlign: 'center' }}
        />
      ))}
    </View>
  );
}
