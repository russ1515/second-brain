import { useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { ReviewRating } from '@second-brain/shared';
import { useTokens } from '../../lib/design/theme';
import { Badge, Button, Card, SegmentedControl } from '../ds/core';
import { AITeacherMessage, PostureBadge, type Posture } from '../ds/ai';
import { PronunciationIndicator, TranslationHint } from '../ds/language';
import {
  CARD_TYPES,
  GRADES,
  PRIORITIES,
  RETENTION_STATES,
  type CardType,
  type DueKind,
  type Priority,
  type RetentionState,
} from '../../lib/review/catalog';

/**
 * Réviser — advanced components (UI/UX Sprint 6, full spec). Reusable views over
 * the existing FSRS + twin: the "Aujourd'hui" briefing, concepts-to-consolidate,
 * the teacher explanation / session dual-pane, the retention map, the watch
 * list, the temporal planner, the vocabulary card, and the empty state. No new
 * scheduling logic. Copy is French (product voice).
 */

function toneColor(c: ReturnType<typeof useTokens>['colors'], t: string): string {
  switch (t) {
    case 'error': return c.error;
    case 'warning': return c.warning;
    case 'success': return c.success;
    case 'info': return c.info;
    default: return c.primary;
  }
}
function SectionLabel({ children }: { children: ReactNode }) {
  const { colors: c } = useTokens();
  return <Text style={{ color: c.textMuted, fontSize: 12, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' }}>{children}</Text>;
}

// ── Zone Aujourd'hui — personalised briefing + why (tasks 1,2) ───────────────
export function TodayBriefing({
  name,
  counts,
  minutes,
  why,
  onStart,
}: {
  name: string;
  counts: Record<DueKind, number>;
  minutes: number;
  why: string;
  onStart: () => void;
}) {
  const { colors: c } = useTokens();
  const total = counts.critical + counts.regular + counts.fresh;
  const stat = (icon: string, n: number, col: string) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Text style={{ fontSize: 13 }}>{icon}</Text>
      <Text style={{ color: col, fontSize: 15, fontWeight: '800' }}>{n}</Text>
    </View>
  );
  return (
    <Card elevated style={{ borderColor: c.aiAccent, gap: 10 }}>
      <Text style={{ color: c.textPrimary, fontSize: 20, fontWeight: '800' }}>👋 {name ? `${name}, ` : ''}ta séance du jour</Text>
      <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
        {stat('🔴', counts.critical, c.error)}
        {stat('🟡', counts.regular, c.warning)}
        {stat('🟢', counts.fresh, c.success)}
        <View style={{ flex: 1 }} />
        <Badge label={`~${minutes} min`} tone="ai" />
      </View>
      <View style={{ backgroundColor: c.aiAccentSoft, borderRadius: 12, padding: 12, gap: 6 }}>
        <Text style={{ color: c.aiAccent, fontSize: 11, fontWeight: '800' }}>👨‍🏫 POURQUOI AUJOURD’HUI</Text>
        <Text style={{ color: c.textSecondary, fontSize: 13, lineHeight: 19 }}>{why}</Text>
      </View>
      <Button label={total > 0 ? '▶ Commencer' : 'Tout est à jour'} variant="ai" onPress={onStart} disabled={total === 0} />
    </Card>
  );
}

// ── Concepts à consolider (task 3) ───────────────────────────────────────────
export function ConceptsToConsolidate({
  concepts,
  onReview,
}: {
  concepts: { id: string; name: string; priority: Priority; type?: CardType }[];
  onReview: (id: string) => void;
}) {
  const { colors: c } = useTokens();
  if (concepts.length === 0) return null;
  return (
    <Card style={{ gap: 8 }}>
      <SectionLabel>Concepts à consolider</SectionLabel>
      {concepts.slice(0, 5).map((k) => {
        const p = PRIORITIES[k.priority];
        return (
          <Pressable key={k.id} onPress={() => onReview(k.id)} accessibilityRole="button"
            style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 }}>
            <Text style={{ fontSize: 12 }}>{p.icon}</Text>
            <Text style={{ color: c.textPrimary, fontSize: 15, flex: 1 }} numberOfLines={1}>{k.name}</Text>
            {k.type ? <Badge label={CARD_TYPES[k.type].label} tone="neutral" /> : null}
            <Text style={{ color: c.aiAccent, fontSize: 18 }}>›</Text>
          </Pressable>
        );
      })}
    </Card>
  );
}

// ── Teacher explanation — benevolent intervention (task 4) ───────────────────
export function TeacherExplanation({
  posture = 'supportive',
  message,
  children,
}: {
  posture?: Posture;
  message: string;
  children?: ReactNode;
}) {
  const { colors: c } = useTokens();
  return (
    <Card style={{ borderColor: c.aiAccent, gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={{ fontSize: 18 }}>👨‍🏫</Text>
        <Text style={{ color: c.aiAccent, fontSize: 12, fontWeight: '800' }}>PROFESSEUR IA</Text>
        <PostureBadge posture={posture} />
      </View>
      <AITeacherMessage text={message} posture={posture} />
      {children}
    </Card>
  );
}

/** After a grade, the teacher reacts benevolently — especially on a partial/fail. */
export function feedbackFor(rating: ReviewRating, concept: string): { posture: Posture; message: string } {
  if (rating <= 1) return { posture: 'supportive', message: `Pas de souci — « ${concept} » demande un peu plus de pratique. Reprenons-le ensemble, tu vas y arriver.` };
  if (rating === 2) return { posture: 'supportive', message: `Presque ! Tu tiens l’essentiel de « ${concept} ». On le reverra bientôt pour l’ancrer.` };
  if (rating === 3) return { posture: 'supportive', message: `Bien joué — « ${concept} » est en bonne voie.` };
  return { posture: 'challenging', message: `Excellent, « ${concept} » est solide. On peut viser plus loin.` };
}

// ── Session dual-pane on desktop, stacked on mobile (task 8) ─────────────────
export function ReviewSessionPane({ card, teacher, wide }: { card: ReactNode; teacher: ReactNode; wide: boolean }) {
  if (wide) {
    return (
      <View style={{ flexDirection: 'row', gap: 14, alignItems: 'flex-start' }}>
        <View style={{ flex: 1.2 }}>{card}</View>
        <View style={{ flex: 1 }}>{teacher}</View>
      </View>
    );
  }
  return <View style={{ gap: 12 }}>{card}{teacher}</View>;
}

// ── Retention map — solide / progresse / fragile / urgent (task 5) ───────────
export function RetentionMap({ counts }: { counts: Record<RetentionState, number> }) {
  const { colors: c, radius } = useTokens();
  return (
    <Card style={{ gap: 10 }}>
      <SectionLabel>Progression de rétention</SectionLabel>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {(Object.keys(RETENTION_STATES) as RetentionState[]).map((k) => {
          const v = RETENTION_STATES[k];
          const col = toneColor(c, v.tone);
          return (
            <View key={k} style={{ width: '47%', flexGrow: 1, borderWidth: 1, borderColor: col, borderRadius: radius.md, padding: 12, gap: 2 }}>
              <Text style={{ fontSize: 13 }}>{v.icon}</Text>
              <Text style={{ color: c.textPrimary, fontSize: 22, fontWeight: '800' }}>{counts[k]}</Text>
              <Text style={{ color: col, fontSize: 12, fontWeight: '700' }}>{v.label}</Text>
            </View>
          );
        })}
      </View>
    </Card>
  );
}

// ── Watch list — "À surveiller" with a temporal reco (task 5) ────────────────
export function WatchList({
  items,
  onReview,
}: {
  items: { id: string; name: string; when: string; minutes: number }[];
  onReview: (id: string) => void;
}) {
  const { colors: c } = useTokens();
  if (items.length === 0) return null;
  return (
    <Card style={{ borderColor: c.warning, gap: 8 }}>
      <Text style={{ color: c.warning, fontSize: 13, fontWeight: '800' }}>👀 À surveiller</Text>
      {items.slice(0, 4).map((it) => (
        <Pressable key={it.id} onPress={() => onReview(it.id)} accessibilityRole="button"
          style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 }}>
          <Text style={{ color: c.textPrimary, fontSize: 15, flex: 1 }} numberOfLines={1}>{it.name}</Text>
          <Badge label={`${it.when} · ${it.minutes} min`} tone="warning" />
        </Pressable>
      ))}
    </Card>
  );
}

// ── Revision planner — temporal views + priorities (task 6) ──────────────────
export function RevisionPlanner({
  today,
  tomorrow,
  keyDates,
}: {
  today: { id: string; name: string; priority: Priority }[];
  tomorrow: { id: string; name: string; priority: Priority }[];
  keyDates: { id: string; label: string; when: string }[];
}) {
  const { colors: c } = useTokens();
  const [view, setView] = useState<'today' | 'tomorrow' | 'key'>('today');
  const rows = view === 'today' ? today : view === 'tomorrow' ? tomorrow : [];
  return (
    <Card style={{ gap: 10 }}>
      <SectionLabel>Planning des prochaines révisions</SectionLabel>
      <SegmentedControl
        options={['today', 'tomorrow', 'key'] as const}
        value={view}
        onChange={setView}
        labelFor={(v) => (v === 'today' ? 'Aujourd’hui' : v === 'tomorrow' ? 'Demain' : 'Dates clés')}
      />
      {view === 'key' ? (
        keyDates.length === 0 ? (
          <Text style={{ color: c.textMuted, fontSize: 13 }}>Aucune date clé enregistrée.</Text>
        ) : (
          keyDates.map((k) => (
            <View key={k.id} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
              <Text style={{ color: c.textPrimary, fontSize: 15 }}>📌 {k.label}</Text>
              <Text style={{ color: c.textMuted, fontSize: 13 }}>{k.when}</Text>
            </View>
          ))
        )
      ) : rows.length === 0 ? (
        <Text style={{ color: c.textMuted, fontSize: 13 }}>Rien de prévu.</Text>
      ) : (
        rows.map((r) => (
          <View key={r.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 }}>
            <Text style={{ fontSize: 12 }}>{PRIORITIES[r.priority].icon}</Text>
            <Text style={{ color: c.textPrimary, fontSize: 15, flex: 1 }} numberOfLines={1}>{r.name}</Text>
            <Text style={{ color: c.textMuted, fontSize: 12 }}>{PRIORITIES[r.priority].label}</Text>
          </View>
        ))
      )}
    </Card>
  );
}

// ── Vocab card — language FSRS (task 7) ──────────────────────────────────────
export function VocabCard({
  term,
  translation,
  ipa,
  example,
  onRate,
}: {
  term: string;
  translation: string;
  ipa?: string;
  example?: string;
  onRate: (rating: ReviewRating) => void;
}) {
  const { colors: c, radius } = useTokens();
  const [flipped, setFlipped] = useState(false);
  return (
    <Card style={{ gap: 12 }}>
      <Badge label="🌍 Vocabulaire" tone="ai" />
      <Pressable onPress={() => setFlipped((f) => !f)} accessibilityRole="button"
        style={{ minHeight: 130, borderRadius: radius.lg, borderWidth: 1, borderColor: flipped ? c.aiAccent : c.border, backgroundColor: flipped ? c.aiAccentSoft : c.surfaceElevated, alignItems: 'center', justifyContent: 'center', padding: 20, gap: 8 }}>
        <Text style={{ color: c.textPrimary, fontSize: 22, fontWeight: '700' }}>{term}</Text>
        {ipa ? <PronunciationIndicator ipa={ipa} /> : null}
        {flipped ? <TranslationHint term={term} translation={translation} /> : <Text style={{ color: c.textMuted, fontSize: 12 }}>Appuie pour la traduction</Text>}
        {flipped && example ? <Text style={{ color: c.textSecondary, fontSize: 14, fontStyle: 'italic', textAlign: 'center' }}>{example}</Text> : null}
      </Pressable>
      {flipped ? (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {GRADES.map((g) => (
            <Pressable key={g.rating} onPress={() => onRate(g.rating)} accessibilityRole="button" accessibilityLabel={g.label}
              style={{ flex: 1, borderRadius: radius.sm, paddingVertical: 12, alignItems: 'center', backgroundColor: toneColor(c, g.tone) }}>
              <Text style={{ color: c.onColor, fontSize: 13, fontWeight: '800' }}>{g.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </Card>
  );
}

// ── Empty state — first use (task 9) ─────────────────────────────────────────
export function EmptyReview({ onStart }: { onStart: () => void }) {
  const { colors: c } = useTokens();
  return (
    <Card style={{ alignItems: 'center', gap: 12, paddingVertical: 40 }}>
      <Text style={{ fontSize: 44 }}>🃏</Text>
      <Text style={{ color: c.textPrimary, fontSize: 20, fontWeight: '800', textAlign: 'center' }}>Tes cartes de révision arrivent.</Text>
      <Text style={{ color: c.textSecondary, fontSize: 15, textAlign: 'center', lineHeight: 22, maxWidth: 360 }}>
        Dès que tu apprends un cours ou parles avec ton professeur, Second Brain crée automatiquement les cartes à réviser ici.
      </Text>
      <Button label="Commencer à apprendre" variant="ai" onPress={onStart} />
    </Card>
  );
}
