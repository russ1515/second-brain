import { useEffect, useState, type ReactNode } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { useTokens } from '../../lib/design/theme';

/**
 * Overlays (UI/UX Sprint 1, task UI-1.5 cont.).
 * Modal, Sheet, Drawer, Toast, Tooltip — all theme-aware, dismissable, with a
 * scrim; animations respect the OS reduce-motion preference.
 */

function useAnim(): 'slide' | 'fade' | 'none' {
  const { reducedMotion } = useTokens();
  return reducedMotion ? 'none' : 'slide';
}

// ── Modal (centered dialog) ──────────────────────────────────────────────────
export function Dialog({ visible, onClose, title, children, footer }: { visible: boolean; onClose: () => void; title: string; children?: ReactNode; footer?: ReactNode }) {
  const { colors: c, radius, spacing, reducedMotion } = useTokens();
  return (
    <Modal visible={visible} transparent animationType={reducedMotion ? 'none' : 'fade'} onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: c.overlay, alignItems: 'center', justifyContent: 'center', padding: 24 }} onPress={onClose}>
        <Pressable style={{ width: '100%', maxWidth: 420, backgroundColor: c.surfaceElevated, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border, padding: spacing.lg, gap: spacing.sm }} onPress={() => {}}>
          <Text style={{ color: c.textPrimary, fontSize: 19, fontWeight: '700' }}>{title}</Text>
          {children}
          {footer ? <View style={{ flexDirection: 'row', gap: 10, justifyContent: 'flex-end', marginTop: spacing.xs }}>{footer}</View> : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── Sheet (bottom) ───────────────────────────────────────────────────────────
export function Sheet({ visible, onClose, title, children }: { visible: boolean; onClose: () => void; title?: string; children?: ReactNode }) {
  const { colors: c, radius, spacing } = useTokens();
  const anim = useAnim();
  return (
    <Modal visible={visible} transparent animationType={anim} onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: c.overlay, justifyContent: 'flex-end' }} onPress={onClose}>
        <Pressable style={{ backgroundColor: c.surfaceElevated, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, gap: spacing.sm, borderTopWidth: 1, borderColor: c.border }} onPress={() => {}}>
          <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 999, backgroundColor: c.borderStrong, marginBottom: spacing.xs }} />
          {title ? <Text style={{ color: c.textPrimary, fontSize: 18, fontWeight: '700' }}>{title}</Text> : null}
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── Drawer (side panel, from left) ───────────────────────────────────────────
export function Drawer({ visible, onClose, children }: { visible: boolean; onClose: () => void; children?: ReactNode }) {
  const { colors: c, spacing, reducedMotion } = useTokens();
  return (
    <Modal visible={visible} transparent animationType={reducedMotion ? 'none' : 'slide'} onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: c.overlay, flexDirection: 'row' }} onPress={onClose}>
        <Pressable style={{ width: 300, maxWidth: '80%', height: '100%', backgroundColor: c.surfaceElevated, borderRightWidth: 1, borderColor: c.border, padding: spacing.lg, gap: spacing.sm }} onPress={() => {}}>
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── Toast (transient, auto-dismiss) ──────────────────────────────────────────
type ToastTone = 'neutral' | 'success' | 'error' | 'info';
export function Toast({ visible, onHide, message, tone = 'neutral', duration = 2600 }: { visible: boolean; onHide: () => void; message: string; tone?: ToastTone; duration?: number }) {
  const { colors: c, radius, spacing, elevation } = useTokens();
  useEffect(() => {
    if (!visible) return;
    const id = setTimeout(onHide, duration);
    return () => clearTimeout(id);
  }, [visible, duration, onHide]);
  if (!visible) return null;
  const toneColor = tone === 'success' ? c.success : tone === 'error' ? c.error : tone === 'info' ? c.info : c.textPrimary;
  const icon = tone === 'success' ? '✓' : tone === 'error' ? '✕' : tone === 'info' ? 'ℹ︎' : '';
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: 32, alignItems: 'center' }}>
      <View style={[{ flexDirection: 'row', gap: 8, backgroundColor: c.surfaceElevated, borderWidth: 1, borderColor: c.border, borderRadius: radius.md, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, maxWidth: 420 }, elevation.medium]}>
        {icon ? <Text style={{ color: toneColor, fontWeight: '700' }}>{icon}</Text> : null}
        <Text style={{ color: c.textPrimary, fontSize: 14 }}>{message}</Text>
      </View>
    </View>
  );
}

// ── Tooltip (press to reveal) ────────────────────────────────────────────────
export function Tooltip({ text, children }: { text: string; children: ReactNode }) {
  const { colors: c, radius, elevation } = useTokens();
  const [open, setOpen] = useState(false);
  return (
    <View style={{ alignSelf: 'flex-start' }}>
      <Pressable onPress={() => setOpen((o) => !o)} accessibilityLabel={text} accessibilityRole="button">
        {children}
      </Pressable>
      {open ? (
        <View style={[{ position: 'absolute', bottom: '100%', marginBottom: 6, backgroundColor: c.textPrimary, borderRadius: radius.sm, paddingVertical: 6, paddingHorizontal: 10, maxWidth: 240 }, elevation.low]}>
          <Text style={{ color: c.background, fontSize: 12 }}>{text}</Text>
        </View>
      ) : null}
    </View>
  );
}
