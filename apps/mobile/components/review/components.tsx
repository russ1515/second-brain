import { useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { ReviewRating, RiskPrediction } from '@second-brain/shared';
import { useTokens } from '../../lib/design/theme';
import { Badge, Button, Card, Progress, SegmentedControl } from '../ds/core';
import { AITeacherMessage, PostureBadge, type Posture } from '../ds/ai';
import { PronunciationIndicator, TranslationHint } from '../ds/language';
import {
  CARD_TYPES,
  DUE_CATEGORIES,
  GRADES,
  LAUNCH_OPTIONS,
  PRIORITIES,
  RETENTION_STATES,
  forgettingCurve,
  type CardType,
  type DueKind,
  type LaunchOption,
  type Priority,
  type RetentionState,
} from '../../lib/review/catalog';

/**
 * Réviser component library (UI/UX Sprint 6). Reusable, prop-driven views over
 * the existing FSRS engine: the due counter, quick launchers, the Smart Card
 * reader with FSRS grading + 1-click teacher convergence on failure, and the
 * prediction widgets (forgetting curve, exam forgetting-risk). No scheduling
 * logic lives here.
 */

function tone(c: ReturnType<typeof useTokens>['colors'], t: string): string {
  switch (t) {
    case 'error': return c.error;
    case 'warning': return c.warning;
    case 'success': return c.success;
    case 'info': return c.info;
    default: return c.primary;
  }
}

// ── Due counter — 🔴 Critique / 🟡 Régulier / 🔵 Nouveauté (task 1) ───────────
export function DueCounter({ counts, onPick }: { counts: Record<DueKind, number>; onPick?: (k: DueKind) => void }) {
  const { colors: c, radius } = useTokens();
  return (
    <View style={{ flexDirection: 'row', gap: 10 }}>
      {(Object.keys(DUE_CATEGORIES) as DueKind[]).map((k) => {
        const cat = DUE_CATEGORIES[k];
        const col = tone(c, cat.tone);
        return (
          <Pressable key={k} onPress={() => onPick?.(k)} accessibilityRole="button" accessibilityLabel={`${cat.label}: ${counts[k]}`}
            style={{ flex: 1, borderWidth: 1, borderColor: col, borderRadius: radius.md, padding: 12, gap: 2, backgroundColor: c.surface }}>
            <Text style={{ fontSize: 14 }}>{cat.icon}</Text>
            <Text style={{ color: c.textPrimary, fontSize: 26, fontWeight: '800' }}>{counts[k]}</Text>
            <Text style={{ color: col, fontSize: 12, fontWeight: '700' }}>{cat.label}</Text>
            <Text style={{ color: c.textMuted, fontSize: 11 }} numberOfLines={2}>{cat.hint}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ── Quick launch — Flash 5 min / Complète (task 1) ───────────────────────────
export function QuickLaunch({ due, onLaunch }: { due: number; onLaunch: (o: LaunchOption) => void }) {
  const { colors: c } = useTokens();
  return (
    <Card elevated style={{ borderColor: c.aiAccent, gap: 10 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ color: c.textPrimary, fontSize: 18, fontWeight: '800' }}>À réviser maintenant</Text>
        <Badge label={`${due} dues`} tone={due > 0 ? 'warning' : 'success'} />
      </View>
      <View style={{ gap: 8 }}>
        {LAUNCH_OPTIONS.map((o) => (
          <Pressable key={o.key} onPress={() => onLaunch(o)} accessibilityRole="button" accessibilityLabel={o.label}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: c.border, borderRadius: 12, padding: 12 }}>
            <Text style={{ fontSize: 22 }}>{o.icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: c.textPrimary, fontSize: 15, fontWeight: '700' }}>{o.label}</Text>
              <Text style={{ color: c.textSecondary, fontSize: 12 }}>{o.detail}</Text>
            </View>
            <Text style={{ color: c.aiAccent, fontSize: 20 }}>›</Text>
          </Pressable>
        ))}
      </View>
    </Card>
  );
}

// ── Smart Card reader — recto/verso + FSRS grading + convergence (tasks 2,4) ─
export function SmartCard({
  front,
  back,
  index,
  total,
  cardType,
  onRate,
  onAskTeacher,
}: {
  front: string;
  back: string;
  index?: number;
  total?: number;
  cardType?: CardType;
  onRate: (rating: ReviewRating) => void;
  onAskTeacher?: () => void;
}) {
  const { colors: c, radius } = useTokens();
  const [flipped, setFlipped] = useState(false);
  return (
    <Card style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        {cardType ? <Badge label={`${CARD_TYPES[cardType].icon} ${CARD_TYPES[cardType].label}`} tone="ai" /> : <View />}
        {index != null && total != null ? (
          <Text style={{ color: c.textMuted, fontSize: 12 }}>Carte {index + 1} / {total}</Text>
        ) : null}
      </View>
      <Pressable
        onPress={() => setFlipped((f) => !f)}
        accessibilityRole="button"
        accessibilityLabel={flipped ? 'Réponse — appuie pour cacher' : 'Question — appuie pour révéler'}
        style={{ minHeight: 160, borderRadius: radius.lg, borderWidth: 1, borderColor: flipped ? c.aiAccent : c.border, backgroundColor: flipped ? c.aiAccentSoft : c.surfaceElevated, alignItems: 'center', justifyContent: 'center', padding: 20, gap: 8 }}
      >
        <Text style={{ color: c.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' }}>{flipped ? 'Réponse' : 'Question'}</Text>
        <Text style={{ color: c.textPrimary, fontSize: 19, fontWeight: '600', textAlign: 'center', lineHeight: 26 }}>{flipped ? back : front}</Text>
        {!flipped ? <Text style={{ color: c.textMuted, fontSize: 12, marginTop: 8 }}>Appuie pour révéler la réponse</Text> : null}
      </Pressable>

      {flipped ? (
        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {GRADES.map((g) => (
              <Pressable key={g.rating} onPress={() => onRate(g.rating)} accessibilityRole="button" accessibilityLabel={g.label}
                testID={`grade-${g.rating}`}
                style={{ flex: 1, borderRadius: radius.sm, paddingVertical: 12, alignItems: 'center', backgroundColor: tone(c, g.tone) }}>
                <Text style={{ color: c.onColor, fontSize: 13, fontWeight: '800' }}>{g.label}</Text>
              </Pressable>
            ))}
          </View>
          {onAskTeacher ? (
            <Pressable onPress={onAskTeacher} accessibilityRole="button" style={{ alignSelf: 'center', paddingVertical: 6 }}>
              <Text style={{ color: c.aiAccent, fontSize: 13, fontWeight: '700' }}>🤖 Bloqué ? Comprendre avec le professeur</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </Card>
  );
}

// ── Forgetting curve — 7 days, anchored on real retention (task 3) ───────────
export function ForgettingCurve({ retention }: { retention: number | null }) {
  const { colors: c, radius } = useTokens();
  const pts = forgettingCurve(retention);
  const barColor = (r: number) => (r >= 0.7 ? c.success : r >= 0.5 ? c.warning : c.error);
  return (
    <Card style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ color: c.textPrimary, fontSize: 16, fontWeight: '700' }}>📉 Courbe d’oubli — 7 jours</Text>
        {retention != null ? <Badge label={`rétention ${Math.round(retention * 100)}%`} tone="ai" /> : null}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 90 }}>
        {pts.map((r, i) => (
          <View key={i} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
            <View style={{ width: '70%', height: Math.max(8, r * 80), backgroundColor: barColor(r), borderRadius: radius.xs }} />
            <Text style={{ color: c.textMuted, fontSize: 10 }}>{i === 0 ? 'Auj' : `J+${i}`}</Text>
          </View>
        ))}
      </View>
      <Text style={{ color: c.textMuted, fontSize: 12 }}>Sans révision, ta mémoire décline. Une révision au bon moment remet la courbe au sommet.</Text>
    </Card>
  );
}

// ── Exam forgetting-risk alert (task 3) ──────────────────────────────────────
export function ExamRiskAlert({ risk, onReview }: { risk: RiskPrediction; onReview: () => void }) {
  const { colors: c } = useTokens();
  const col = risk.level === 'high' ? c.error : risk.level === 'moderate' ? c.warning : c.info;
  return (
    <Card style={{ borderColor: col, gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={{ fontSize: 16 }}>⚠️</Text>
        <Text style={{ color: col, fontSize: 13, fontWeight: '800' }}>Risque d’oubli</Text>
        <Badge label={`${Math.round(risk.probability)}%`} tone={risk.level === 'high' ? 'error' : risk.level === 'moderate' ? 'warning' : 'info'} />
      </View>
      <Text style={{ color: c.textPrimary, fontSize: 14, lineHeight: 20 }}>{risk.cause}</Text>
      <Text style={{ color: c.textSecondary, fontSize: 13 }}>{risk.action}</Text>
      <View style={{ alignSelf: 'flex-start', marginTop: 4 }}>
        <Button label="Réviser maintenant" onPress={onReview} />
      </View>
    </Card>
  );
}

// ── Review stats strip (task 1) ──────────────────────────────────────────────
export function ReviewStatsStrip({ reviewsToday, retention }: { reviewsToday: number; retention: number | null }) {
  const { colors: c } = useTokens();
  const cell = (v: string, l: string) => (
    <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
      <Text style={{ color: c.textPrimary, fontSize: 20, fontWeight: '800' }}>{v}</Text>
      <Text style={{ color: c.textMuted, fontSize: 12 }}>{l}</Text>
    </View>
  );
  return (
    <Card>
      <View style={{ flexDirection: 'row' }}>
        {cell(`${reviewsToday}`, 'révisions aujourd’hui')}
        {cell(retention == null ? '—' : `${Math.round(retention * 100)}%`, 'rétention')}
      </View>
    </Card>
  );
}

// ── FSRS auto-extraction entry (task 4) ──────────────────────────────────────
export function AutoExtractCard({ onExtract }: { onExtract: () => void }) {
  const { colors: c } = useTokens();
  return (
    <Card style={{ borderColor: c.aiAccent, gap: 8 }}>
      <Text style={{ color: c.aiAccent, fontSize: 12, fontWeight: '800' }}>🤖 CARTES AUTOMATIQUES</Text>
      <AITeacherMessage text="Tes cours et conversations deviennent des cartes de révision. Choisis une source et je crée les cartes pour toi." posture="supportive" />
      <View style={{ alignSelf: 'flex-start' }}>
        <Button label="Générer des cartes" variant="ai" onPress={onExtract} />
      </View>
    </Card>
  );
}

// ── Session complete (task 2) ────────────────────────────────────────────────
export function SessionComplete({ reviewed, onDone }: { reviewed: number; onDone: () => void }) {
  const { colors: c } = useTokens();
  return (
    <Card style={{ alignItems: 'center', gap: 12, paddingVertical: 32 }}>
      <Text style={{ fontSize: 40 }}>✅</Text>
      <Text style={{ color: c.textPrimary, fontSize: 20, fontWeight: '800' }}>{reviewed > 0 ? 'Session terminée !' : 'Rien à réviser'}</Text>
      <Text style={{ color: c.textSecondary, fontSize: 14, textAlign: 'center' }}>
        {reviewed > 0 ? `${reviewed} carte${reviewed > 1 ? 's' : ''} revue${reviewed > 1 ? 's' : ''}. Ta mémoire est consolidée.` : 'Tu es à jour — reviens plus tard.'}
      </Text>
      <Button label="Retour" variant="secondary" onPress={onDone} />
    </Card>
  );
}
