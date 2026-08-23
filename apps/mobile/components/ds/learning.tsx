import { useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTokens } from '../../lib/design/theme';

/**
 * Learning components (UI/UX Sprint 1, task UI-1.10).
 *
 * Generic pedagogical building blocks reused across Apprendre, Mon Cerveau and
 * Réviser. All theme-aware; mastery/difficulty/revision states are shown with a
 * shape/label, not colour alone.
 */

// ── MasteryIndicator — 0..1, stars + %, accessible label ─────────────────────
export function MasteryIndicator({ mastery }: { mastery: number | null }) {
  const { colors: c } = useTokens();
  if (mastery === null) {
    return <Text style={{ color: c.textMuted, fontSize: 12 }}>Not tracked</Text>;
  }
  const pct = Math.round(mastery * 100);
  const stars = Math.max(1, Math.round(mastery * 5));
  const tone = mastery >= 0.8 ? c.success : mastery >= 0.5 ? c.warning : c.error;
  return (
    <View accessibilityLabel={`Mastery ${pct}%`} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <Text style={{ color: tone, fontSize: 13, fontWeight: '700' }}>{'★'.repeat(stars)}{'☆'.repeat(5 - stars)}</Text>
      <Text style={{ color: c.textSecondary, fontSize: 12, fontWeight: '600' }}>{pct}%</Text>
    </View>
  );
}

// ── DifficultyIndicator ──────────────────────────────────────────────────────
export function DifficultyIndicator({ level }: { level: 'beginner' | 'intermediate' | 'advanced' }) {
  const { colors: c, radius } = useTokens();
  const map = { beginner: { n: 1, label: 'Beginner' }, intermediate: { n: 2, label: 'Intermediate' }, advanced: { n: 3, label: 'Advanced' } }[level];
  return (
    <View accessibilityLabel={`Difficulty: ${map.label}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ flexDirection: 'row', gap: 3 }}>
        {[1, 2, 3].map((i) => (
          <View key={i} style={{ width: 6, height: 12, borderRadius: 2, backgroundColor: i <= map.n ? c.primary : c.surfaceSunken }} />
        ))}
      </View>
      <Text style={{ color: c.textSecondary, fontSize: 12 }}>{map.label}</Text>
    </View>
  );
}

// ── RevisionIndicator — due state ────────────────────────────────────────────
export function RevisionIndicator({ dueCount }: { dueCount: number }) {
  const { colors: c, radius } = useTokens();
  const due = dueCount > 0;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: due ? c.warningSoft : c.successSoft, borderRadius: radius.full, paddingHorizontal: 9, paddingVertical: 3 }}>
      <Text style={{ fontSize: 11 }}>{due ? '🔁' : '✓'}</Text>
      <Text style={{ color: due ? c.warning : c.success, fontSize: 11, fontWeight: '700' }}>
        {due ? `${dueCount} to review` : 'Up to date'}
      </Text>
    </View>
  );
}

// ── ConceptCard ──────────────────────────────────────────────────────────────
export function ConceptCard({ name, mastery, dueCount, onPress }: { name: string; mastery: number | null; dueCount?: number; onPress?: () => void }) {
  const { colors: c, radius, spacing } = useTokens();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Concept ${name}`}
      style={({ pressed }) => [{ backgroundColor: c.surface, borderWidth: 1, borderColor: c.borderSubtle, borderRadius: radius.md, padding: spacing.md, gap: 8, opacity: pressed ? 0.9 : 1 }]}
    >
      <Text style={{ color: c.textPrimary, fontSize: 16, fontWeight: '700' }}>{name}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <MasteryIndicator mastery={mastery} />
        {dueCount !== undefined ? <RevisionIndicator dueCount={dueCount} /> : null}
      </View>
    </Pressable>
  );
}

// ── LessonStep — one numbered step in a guided session ───────────────────────
export function LessonStep({ index, title, active, done }: { index: number; title: string; active?: boolean; done?: boolean }) {
  const { colors: c, radius } = useTokens();
  const ring = done ? c.success : active ? c.primary : c.borderStrong;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <View style={{ width: 26, height: 26, borderRadius: radius.full, borderWidth: 2, borderColor: ring, backgroundColor: done ? c.success : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: done ? c.onColor : active ? c.primary : c.textMuted, fontWeight: '700', fontSize: 12 }}>{done ? '✓' : index}</Text>
      </View>
      <Text style={{ color: active || done ? c.textPrimary : c.textMuted, fontSize: 15, fontWeight: active ? '700' : '400' }}>{title}</Text>
    </View>
  );
}

// ── Flashcard — tap to flip ──────────────────────────────────────────────────
export function Flashcard({ front, back }: { front: string; back: string }) {
  const { colors: c, radius, spacing } = useTokens();
  const [flipped, setFlipped] = useState(false);
  return (
    <Pressable
      onPress={() => setFlipped((f) => !f)}
      accessibilityRole="button"
      accessibilityLabel={flipped ? 'Card back — tap to flip' : 'Card front — tap to reveal'}
      style={{ backgroundColor: flipped ? c.aiAccentSoft : c.surface, borderWidth: 1, borderColor: c.border, borderRadius: radius.lg, padding: spacing.lg, minHeight: 120, alignItems: 'center', justifyContent: 'center', gap: 6 }}
    >
      <Text style={{ color: c.textMuted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 }}>{flipped ? 'Answer' : 'Question'}</Text>
      <Text style={{ color: c.textPrimary, fontSize: 18, fontWeight: '600', textAlign: 'center' }}>{flipped ? back : front}</Text>
    </Pressable>
  );
}

// ── QuizCard / ExerciseCard — a prompt with a call to action ─────────────────
export function ExerciseCard({ kind, prompt, action }: { kind: string; prompt: string; action?: ReactNode }) {
  const { colors: c, radius, spacing } = useTokens();
  return (
    <View style={{ backgroundColor: c.surface, borderWidth: 1, borderColor: c.borderSubtle, borderRadius: radius.md, padding: spacing.md, gap: 8 }}>
      <Text style={{ color: c.aiAccent, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8 }}>{kind}</Text>
      <Text style={{ color: c.textPrimary, fontSize: 16, lineHeight: 23 }}>{prompt}</Text>
      {action}
    </View>
  );
}

// ── AnswerFeedback — correct / incorrect with correction ─────────────────────
export function AnswerFeedback({ correct, score, correction }: { correct: boolean; score?: number; correction?: string }) {
  const { colors: c, radius, spacing } = useTokens();
  const tone = correct ? c.success : c.error;
  const soft = correct ? c.successSoft : c.errorSoft;
  return (
    <View style={{ backgroundColor: soft, borderRadius: radius.md, padding: spacing.md, gap: 6, borderLeftWidth: 3, borderLeftColor: tone }}>
      <Text style={{ color: tone, fontWeight: '700', fontSize: 15 }}>
        {correct ? '✓ Correct' : '✕ Not quite'}{score !== undefined ? ` · ${Math.round(score * 100)}%` : ''}
      </Text>
      {correction ? <Text style={{ color: c.textSecondary, fontSize: 14, lineHeight: 20 }}>{correction}</Text> : null}
    </View>
  );
}

// ── KnowledgeRelation — a link between two concepts ──────────────────────────
export function KnowledgeRelation({ from, to, relation }: { from: string; to: string; relation: 'prerequisite' | 'related' }) {
  const { colors: c } = useTokens();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <Text style={{ color: c.textPrimary, fontWeight: '600', fontSize: 14 }}>{from}</Text>
      <Text style={{ color: c.aiAccent, fontSize: 13 }}>{relation === 'prerequisite' ? '→ prerequisite of →' : '↔ related to ↔'}</Text>
      <Text style={{ color: c.textPrimary, fontWeight: '600', fontSize: 14 }}>{to}</Text>
    </View>
  );
}
