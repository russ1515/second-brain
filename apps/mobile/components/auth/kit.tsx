import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Modal, Platform, Pressable, Text, TextInput, View, type TextInputProps, type ViewStyle } from 'react-native';
import { SUPPORTED_LANGUAGES } from '@second-brain/shared';
import { useI18n } from '../../lib/i18n';
import { useTheme, useTokens } from '../../lib/design/theme';

/**
 * Auth kit (Premium auth refactor v2). A theme-aware visual language for the
 * authentication experience — light AND dark, driven by the global design
 * tokens (never a hard-coded palette). A subtle glow background, a measured
 * glassmorphism card, a compact language pill, autofill-neutralised inputs with
 * a password visibility toggle, a password-strength meter, and a 6-digit OTP
 * input (paste, auto-advance, backspace). No second theme provider, no second
 * i18n — everything rides the existing infrastructure.
 */

// ── Glow background (premium halo, both themes) ──────────────────────────────
export function GlowBackground({ children }: { children: ReactNode }) {
  const { colors: c } = useTokens();
  const web = Platform.OS === 'web';
  const halo = (style: ViewStyle, color: string, size: number): ViewStyle => ({
    position: 'absolute',
    width: size,
    height: size,
    borderRadius: size / 2,
    backgroundColor: color,
    opacity: web ? 0.18 : 0.12,
    ...(web ? ({ filter: 'blur(100px)' } as unknown as ViewStyle) : {}),
    ...style,
  });
  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <View pointerEvents="none" style={halo({ top: -120, left: -80 }, c.aiAccent, 420)} />
      <View pointerEvents="none" style={halo({ bottom: -160, right: -100 }, c.primary, 460)} />
      {children}
    </View>
  );
}

// ── Glassmorphism card (measured, readable in both themes) ───────────────────
export function GlassCard({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const { colors: c, radius, spacing } = useTokens();
  const web = Platform.OS === 'web';
  return (
    <View
      style={{
        width: '100%',
        maxWidth: 440,
        alignSelf: 'center',
        borderRadius: radius.xl,
        borderWidth: 1,
        borderColor: c.border,
        backgroundColor: c.surface,
        padding: spacing.lg,
        gap: spacing.md,
        ...(web ? ({ backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)' } as unknown as ViewStyle) : {}),
        ...style,
      }}
    >
      {children}
    </View>
  );
}

// ── Credibility badge (§9) ───────────────────────────────────────────────────
export function BrandBadge({ icon, label }: { icon: string; label: string }) {
  const { colors: c, radius } = useTokens();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceElevated, borderRadius: radius.full, paddingVertical: 6, paddingHorizontal: 12 }}>
      <Text style={{ fontSize: 13 }}>{icon}</Text>
      <Text style={{ color: c.textSecondary, fontSize: 12, fontWeight: '700' }}>{label}</Text>
    </View>
  );
}

// ── Theme toggle (§7) — flips the GLOBAL scheme, no auth-only theme ───────────
export function ThemeToggle() {
  const { colors: c, radius } = useTokens();
  const { resolved, setScheme } = useTheme();
  const { t } = useI18n();
  const dark = resolved === 'dark';
  return (
    <Pressable
      onPress={() => setScheme(dark ? 'light' : 'dark')}
      accessibilityRole="button"
      accessibilityLabel={t('auth.themeToggle')}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceElevated, borderRadius: radius.full, paddingVertical: 6, paddingHorizontal: 10, minHeight: 36 }}
    >
      <Text style={{ fontSize: 15 }}>{dark ? '🌙' : '☀️'}</Text>
    </Pressable>
  );
}

// ── Language pill (§10) — only really-available i18n locales ──────────────────
const LANGS = Object.values(SUPPORTED_LANGUAGES);
export function LangPill() {
  const { colors: c, radius, spacing } = useTokens();
  const { locale, setLocale } = useI18n();
  const [open, setOpen] = useState(false);
  const current = LANGS.find((l) => l.code === locale) ?? LANGS[0];
  return (
    <>
      <Pressable onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel={current.name}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceElevated, borderRadius: radius.full, paddingVertical: 6, paddingHorizontal: 12, minHeight: 36 }}>
        <Text style={{ fontSize: 14 }}>{current.flag}</Text>
        <Text style={{ color: c.textSecondary, fontSize: 13, fontWeight: '700' }}>{current.code.toUpperCase()}</Text>
        <Text style={{ color: c.textMuted, fontSize: 11 }}>▾</Text>
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={{ flex: 1, backgroundColor: c.overlay, justifyContent: 'center', padding: 24 }} onPress={() => setOpen(false)}>
          <Pressable style={{ backgroundColor: c.surfaceElevated, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border, overflow: 'hidden', maxHeight: 420, alignSelf: 'center', width: '100%', maxWidth: 360 }} onPress={() => {}}>
            {LANGS.map((l) => (
              <Pressable key={l.code} onPress={() => { setLocale(l.code); setOpen(false); }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: spacing.md, borderTopWidth: 1, borderTopColor: c.borderSubtle, backgroundColor: l.code === locale ? c.surfaceSunken : 'transparent' }}>
                <Text style={{ fontSize: 16 }}>{l.flag}</Text>
                <Text style={{ color: c.textPrimary, fontSize: 15, flex: 1 }}>{l.name}</Text>
                {l.code === locale ? <Text style={{ color: c.primary }}>✓</Text> : null}
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

// ── Autofill neutraliser — repainted with the active theme's tokens ──────────
let autofillEl: HTMLStyleElement | null = null;
function syncAutofill(bg: string, fg: string) {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  if (!autofillEl) {
    autofillEl = document.createElement('style');
    document.head.appendChild(autofillEl);
  }
  autofillEl.textContent =
    'input:-webkit-autofill,input:-webkit-autofill:hover,input:-webkit-autofill:focus,input:-webkit-autofill:active{' +
    '-webkit-box-shadow:0 0 0 1000px ' + bg + ' inset !important;' +
    '-webkit-text-fill-color:' + fg + ' !important;caret-color:' + fg + ';transition:background-color 9999s ease-in-out 0s;}';
}

export function AuthField({ label, error, secureTextEntry, ...rest }: { label: string; error?: string } & TextInputProps) {
  const { colors: c, radius } = useTokens();
  const { t } = useI18n();
  const [focused, setFocused] = useState(false);
  const [reveal, setReveal] = useState(false);
  const isPassword = !!secureTextEntry;
  useEffect(() => { syncAutofill(c.surfaceSunken, c.textPrimary); }, [c.surfaceSunken, c.textPrimary]);
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: c.textSecondary, fontSize: 13, fontWeight: '600' }}>{label}</Text>
      <View style={{ justifyContent: 'center' }}>
        <TextInput
          placeholderTextColor={c.textMuted}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          secureTextEntry={isPassword && !reveal}
          style={{
            borderWidth: 1,
            borderColor: error ? c.error : focused ? c.focus : c.border,
            borderRadius: radius.md,
            paddingVertical: 12,
            paddingLeft: 14,
            paddingRight: isPassword ? 48 : 14,
            minHeight: 48,
            color: c.textPrimary,
            backgroundColor: c.surfaceSunken,
            fontSize: 15,
          }}
          {...rest}
        />
        {isPassword ? (
          <Pressable
            onPress={() => setReveal((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel={reveal ? t('auth.hidePassword') : t('auth.showPassword')}
            hitSlop={10}
            // Keep the field's value + focus intact — this only toggles masking.
            style={{ position: 'absolute', right: 6, height: 40, width: 40, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ fontSize: 17, color: c.textMuted }}>{reveal ? '🙈' : '👁'}</Text>
          </Pressable>
        ) : null}
      </View>
      {error ? <Text style={{ color: c.error, fontSize: 12 }}>{error}</Text> : null}
    </View>
  );
}

// ── Password strength (§14) — reflects the backend rule (min 8) + variety ─────
export function PasswordStrength({ password }: { password: string }) {
  const { colors: c, radius } = useTokens();
  const { t } = useI18n();
  const { level, label, color, ratio } = useMemo(() => {
    const len = password.length;
    if (len === 0) return { level: 0, label: '', color: c.border, ratio: 0 };
    const variety =
      (/[a-z]/.test(password) ? 1 : 0) +
      (/[A-Z]/.test(password) ? 1 : 0) +
      (/\d/.test(password) ? 1 : 0) +
      (/[^A-Za-z0-9]/.test(password) ? 1 : 0);
    // The backend requires ≥ 8 chars; below that it can never be more than weak.
    if (len < 8) return { level: 1, label: t('auth.strengthWeak'), color: c.error, ratio: 0.33 };
    if (len >= 12 && variety >= 3) return { level: 3, label: t('auth.strengthStrong'), color: c.success, ratio: 1 };
    if (variety >= 2) return { level: 2, label: t('auth.strengthMedium'), color: c.warning, ratio: 0.66 };
    return { level: 1, label: t('auth.strengthWeak'), color: c.error, ratio: 0.4 };
  }, [password, c, t]);
  if (level === 0) return null;
  return (
    <View style={{ gap: 4 }} accessibilityLabel={`${t('auth.strengthLabel')}: ${label}`}>
      <View style={{ height: 5, borderRadius: radius.full, backgroundColor: c.surfaceSunken, overflow: 'hidden' }}>
        <View style={{ width: `${Math.round(ratio * 100)}%`, height: '100%', backgroundColor: color, borderRadius: radius.full }} />
      </View>
      <Text style={{ color: c.textMuted, fontSize: 11 }}>{t('auth.strengthLabel')} · {label}</Text>
    </View>
  );
}

// ── Primary button (states §11: normal/pressed/loading/disabled) ─────────────
export function AuthButton({ label, onPress, busy, disabled, variant = 'primary' }: { label: string; onPress: () => void; busy?: boolean; disabled?: boolean; variant?: 'primary' | 'ghost' }) {
  const { colors: c, radius } = useTokens();
  const off = busy || disabled;
  const primary = variant === 'primary';
  return (
    <Pressable onPress={off ? undefined : onPress} disabled={off} accessibilityRole="button" accessibilityLabel={label}
      accessibilityState={{ disabled: !!off, busy: !!busy }}
      style={({ pressed }) => ({
        minHeight: 50, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18,
        backgroundColor: primary ? c.primary : 'transparent', borderWidth: primary ? 0 : 1, borderColor: c.border,
        opacity: off ? 0.55 : pressed ? 0.9 : 1,
        transform: [{ scale: pressed && !off ? 0.99 : 1 }],
      })}>
      <Text style={{ color: primary ? c.onPrimary : c.textSecondary, fontSize: 16, fontWeight: '800' }}>{busy ? '…' : label}</Text>
    </Pressable>
  );
}

// ── 6-digit OTP input (paste, auto-advance, backspace) ───────────────────────
export function OtpInput({ value, onChange, length = 6 }: { value: string; onChange: (v: string) => void; length?: number }) {
  const { colors: c, radius } = useTokens();
  const { t } = useI18n();
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
          textContentType="oneTimeCode"
          autoComplete="sms-otp"
          maxLength={1}
          accessibilityLabel={`${t('auth.otpTitle')} — ${i + 1}`}
          style={{ width: 46, height: 56, borderRadius: radius.md, borderWidth: 1, borderColor: ch ? c.primary : c.border, backgroundColor: c.surfaceSunken, color: c.textPrimary, fontSize: 22, fontWeight: '800', textAlign: 'center' }}
        />
      ))}
    </View>
  );
}
