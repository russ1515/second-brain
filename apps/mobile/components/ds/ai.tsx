import { type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTokens } from '../../lib/design/theme';

/**
 * AI Design Language (UI/UX Sprint 1, tasks UI-1.7 & UI-1.8).
 *
 * The components that make Second Brain recognizably AI-led. The AI Professor is
 * never a tiny "AI" icon — it appears as a present voice: it recommends,
 * explains, warns, acts. The indigo→violet accent + the 🤖 mark signal
 * "intelligence present". The three postures (supportive / challenging /
 * examiner) are a visual LANGUAGE conveyed by icon + label + colour together —
 * never colour alone — so they read without colour perception.
 */

// ── Posture system ───────────────────────────────────────────────────────────
export type Posture = 'supportive' | 'challenging' | 'examiner';

export function usePostureStyle(posture: Posture) {
  const { colors: c } = useTokens();
  const map = {
    supportive: { color: c.success, soft: c.successSoft, icon: '🟢', label: 'Bienveillant' },
    challenging: { color: c.warning, soft: c.warningSoft, icon: '🟡', label: 'Exigeant' },
    examiner: { color: c.error, soft: c.errorSoft, icon: '🔴', label: 'Examinateur' },
  } as const;
  return map[posture];
}

/** Small posture pill — icon + label + colour (accessible without colour). */
export function PostureBadge({ posture }: { posture: Posture }) {
  const { radius } = useTokens();
  const p = usePostureStyle(posture);
  return (
    <View
      accessibilityLabel={`Posture: ${p.label}`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: p.soft, borderRadius: radius.full, paddingHorizontal: 9, paddingVertical: 3 }}
    >
      <Text style={{ fontSize: 11 }}>{p.icon}</Text>
      <Text style={{ color: p.color, fontSize: 11, fontWeight: '700' }}>{p.label}</Text>
    </View>
  );
}

// ── The shared "AI presence" frame ───────────────────────────────────────────
function AIFrame({
  icon,
  kicker,
  accent,
  soft,
  children,
  action,
}: {
  icon: string;
  kicker: string;
  accent: string;
  soft: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  const { colors: c, radius, spacing } = useTokens();
  return (
    <View style={{ backgroundColor: c.surface, borderWidth: 1, borderColor: c.borderSubtle, borderRadius: radius.md, borderLeftWidth: 3, borderLeftColor: accent, padding: spacing.md, gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ width: 26, height: 26, borderRadius: radius.full, backgroundColor: soft, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 14 }}>{icon}</Text>
        </View>
        <Text style={{ color: accent, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8 }}>{kicker}</Text>
      </View>
      {children}
      {action ? <View style={{ marginTop: 2 }}>{action}</View> : null}
    </View>
  );
}

// ── AI Recommendation — "I analysed your progress; here's what we'll do" ──────
export function AIRecommendation({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  const { colors: c } = useTokens();
  return (
    <AIFrame icon="🤖" kicker="Recommandation IA" accent={c.aiAccent} soft={c.aiAccentSoft} action={action}>
      <Text style={{ color: c.textPrimary, fontSize: 16, fontWeight: '700' }}>{title}</Text>
      {body ? <Text style={{ color: c.textSecondary, fontSize: 15, lineHeight: 22 }}>{body}</Text> : null}
    </AIFrame>
  );
}

// ── AI Insight — something the AI detected ───────────────────────────────────
export function AIInsight({ text }: { text: string }) {
  const { colors: c } = useTokens();
  return (
    <AIFrame icon="💡" kicker="Analyse IA" accent={c.info} soft={c.infoSoft}>
      <Text style={{ color: c.textPrimary, fontSize: 15, lineHeight: 22 }}>{text}</Text>
    </AIFrame>
  );
}

// ── AI Explanation — pedagogical explanation ─────────────────────────────────
export function AIExplanation({ text }: { text: string }) {
  const { colors: c } = useTokens();
  return (
    <AIFrame icon="📘" kicker="Explication" accent={c.primary} soft={c.aiAccentSoft}>
      <Text style={{ color: c.textPrimary, fontSize: 15, lineHeight: 23 }}>{text}</Text>
    </AIFrame>
  );
}

// ── AI Warning — a detected difficulty ───────────────────────────────────────
export function AIWarning({ text }: { text: string }) {
  const { colors: c } = useTokens();
  return (
    <AIFrame icon="⚠︎" kicker="Difficulté détectée" accent={c.warning} soft={c.warningSoft}>
      <Text style={{ color: c.textPrimary, fontSize: 15, lineHeight: 22 }}>{text}</Text>
    </AIFrame>
  );
}

// ── AI Progress — an AI-generated read on progress ───────────────────────────
export function AIProgress({ label, value }: { label: string; value: number }) {
  const { colors: c, radius } = useTokens();
  const pct = Math.max(0, Math.min(100, value));
  return (
    <AIFrame icon="📈" kicker="Progression" accent={c.aiAccent} soft={c.aiAccentSoft}>
      <Text style={{ color: c.textPrimary, fontSize: 15, fontWeight: '600' }}>{label}</Text>
      <View style={{ height: 8, borderRadius: radius.full, backgroundColor: c.surfaceSunken, overflow: 'hidden' }}>
        <View style={{ height: 8, width: `${pct}%`, backgroundColor: c.aiAccent, borderRadius: radius.full }} />
      </View>
    </AIFrame>
  );
}

// ── AI Teacher Message — the Professor speaking, in a given posture ───────────
export function AITeacherMessage({ text, posture = 'supportive' }: { text: string; posture?: Posture }) {
  const { colors: c, radius, spacing } = useTokens();
  const p = usePostureStyle(posture);
  return (
    <View style={{ backgroundColor: c.surface, borderWidth: 1, borderColor: c.borderSubtle, borderRadius: radius.md, borderLeftWidth: 3, borderLeftColor: p.color, padding: spacing.md, gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ width: 26, height: 26, borderRadius: radius.full, backgroundColor: c.aiAccentSoft, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 14 }}>👨‍🏫</Text>
          </View>
          <Text style={{ color: c.aiAccent, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8 }}>Professeur IA</Text>
        </View>
        <PostureBadge posture={posture} />
      </View>
      <Text style={{ color: c.textPrimary, fontSize: 16, lineHeight: 24 }}>{text}</Text>
    </View>
  );
}

// ── AI Action — a discrete action the AI proposes ────────────────────────────
export function AIAction({ label, onPress }: { label: string; onPress?: () => void }) {
  const { colors: c, radius } = useTokens();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.action,
        { borderColor: c.aiAccent, borderRadius: radius.sm, opacity: pressed ? 0.8 : 1 },
      ]}
    >
      <Text style={{ color: c.aiAccent, fontWeight: '700', fontSize: 14 }}>🤖  {label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  action: { alignSelf: 'flex-start', borderWidth: 1.5, paddingVertical: 9, paddingHorizontal: 14, minHeight: 40, justifyContent: 'center' },
});
