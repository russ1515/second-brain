import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import type {
  ConceptScore,
  LearningDna,
  StrengthsWeaknesses,
  TwinGraph,
  TwinGraphNode,
  TwinOverview,
} from '@second-brain/shared';
import { useTokens } from '../../lib/design/theme';
import { Badge, Button, Card, Progress } from '../ds/core';
import { AITeacherMessage } from '../ds/ai';
import { STATUS_VISUAL, childLabel } from '../../lib/brain/graph';

/**
 * Mon Cerveau panels (UI/UX Sprint 5). Presentational views over the existing
 * Digital Twin / ConceptMastery / Learning DNA / Learning Memory data. Every
 * discovery routes to an action (Apprendre / Réviser / Explorer) — the graph is
 * an access point to learning, never decoration (task 17).
 */

function SectionTitle({ children }: { children: ReactNode }) {
  const { colors: c } = useTokens();
  return <Text style={{ color: c.textMuted, fontSize: 12, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>{children}</Text>;
}

// ── BrainOverview (2) ────────────────────────────────────────────────────────
export function BrainOverview({ summary }: { summary: TwinOverview['summary'] }) {
  const { colors: c } = useTokens();
  const cell = (v: string, l: string) => (
    <View style={{ flex: 1, minWidth: 74, alignItems: 'center', gap: 2 }}>
      <Text style={{ color: c.textPrimary, fontSize: 22, fontWeight: '800' }}>{v}</Text>
      <Text style={{ color: c.textMuted, fontSize: 12, textAlign: 'center' }}>{l}</Text>
    </View>
  );
  return (
    <Card>
      <SectionTitle>Vue globale</SectionTitle>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {cell(`${summary.totalConcepts}`, 'concepts')}
        {cell(`${summary.strongConcepts}`, 'maîtrisés')}
        {cell(`${summary.weakConcepts}`, 'fragiles')}
        {cell(summary.averageMastery == null ? '—' : `${Math.round(summary.averageMastery * 100)}%`, 'maîtrise moy.')}
      </View>
    </Card>
  );
}

// ── ConceptDetails (4) — everything derived from the graph, no extra fetch ───
export function ConceptDetails({
  node,
  graph,
  childLabels,
  onLearn,
  onReview,
  onExplore,
}: {
  node: TwinGraphNode;
  graph: TwinGraph;
  childLabels: boolean;
  onLearn: () => void;
  onReview: () => void;
  onExplore: (conceptId: string) => void;
}) {
  const { colors: c } = useTokens();
  const v = STATUS_VISUAL[node.status];
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const prereqs = graph.edges
    .filter((e) => e.relation === 'prerequisite' && e.targetId === node.id)
    .map((e) => byId.get(e.sourceId))
    .filter((n): n is TwinGraphNode => !!n);
  const related = graph.edges
    .filter((e) => e.relation === 'related' && (e.sourceId === node.id || e.targetId === node.id))
    .map((e) => byId.get(e.sourceId === node.id ? e.targetId : e.sourceId))
    .filter((n): n is TwinGraphNode => !!n);

  const fragility =
    node.status === 'blocked' ? 'Prérequis insuffisamment maîtrisés.'
    : node.status === 'at_risk' ? 'Ta maîtrise diminue — des cartes sont à revoir.'
    : node.status === 'ready' ? 'Pas encore étudié — les prérequis sont prêts.'
    : node.status === 'in_progress' ? 'En cours d’apprentissage.'
    : 'Concept solidement maîtrisé.';

  return (
    <Card style={{ borderColor: c.aiAccent, gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={{ fontSize: 18 }}>{v.icon}</Text>
        <Text style={{ color: c.textPrimary, fontSize: 20, fontWeight: '800', flex: 1 }}>{node.name}</Text>
        <Badge label={childLabels ? childLabel(node.status) : v.label} tone={v.tone === 'muted' ? 'neutral' : (v.tone as 'success' | 'primary' | 'warning' | 'error')} />
      </View>

      <View style={{ gap: 4 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ color: c.textSecondary, fontSize: 13 }}>Maîtrise</Text>
          <Text style={{ color: c.textMuted, fontSize: 13, fontWeight: '700' }}>{node.mastery == null ? '—' : `${Math.round(node.mastery * 100)} %`}</Text>
        </View>
        <Progress value={node.mastery ?? 0} tone={node.status === 'mastered' ? 'success' : node.status === 'at_risk' || node.status === 'blocked' ? 'ai' : 'primary'} />
      </View>

      <Text style={{ color: c.textSecondary, fontSize: 13 }}>{fragility}</Text>

      {prereqs.length > 0 ? (
        <View style={{ gap: 4 }}>
          <Text style={{ color: c.textMuted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' }}>Prérequis</Text>
          {prereqs.map((p) => (
            <Pressable key={p.id} onPress={() => onExplore(p.id)}>
              <Text style={{ color: c.aiAccent, fontSize: 14 }}>→ {p.name}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {related.length > 0 ? (
        <View style={{ gap: 4 }}>
          <Text style={{ color: c.textMuted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' }}>Concepts liés</Text>
          {related.map((p) => (
            <Pressable key={p.id} onPress={() => onExplore(p.id)}>
              <Text style={{ color: c.textSecondary, fontSize: 14 }}>→ {p.name}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <Button label="Apprendre" variant="ai" size="sm" onPress={onLearn} />
        <Button label="Réviser" variant="secondary" size="sm" onPress={onReview} />
      </View>
    </Card>
  );
}

// ── CognitiveProfile (5) — internal mastery indicators, not grades ───────────
export function CognitiveProfile({ strengths }: { strengths: ConceptScore[] }) {
  const { colors: c } = useTokens();
  const shown = strengths.slice(0, 6);
  return (
    <Card>
      <SectionTitle>Profil cognitif</SectionTitle>
      {shown.length === 0 ? (
        <Text style={{ color: c.textMuted, fontSize: 14 }}>Pas encore assez de données pour dessiner ton profil.</Text>
      ) : (
        <View style={{ gap: 10 }}>
          {shown.map((s) => (
            <View key={s.conceptId} style={{ gap: 4 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: c.textPrimary, fontSize: 14 }} numberOfLines={1}>{s.name}</Text>
                <Text style={{ color: c.textMuted, fontSize: 13, fontWeight: '700' }}>{Math.round(s.mastery * 100)} %</Text>
              </View>
              <Progress value={s.mastery} tone={s.mastery >= 0.8 ? 'success' : 'primary'} />
            </View>
          ))}
          <Text style={{ color: c.textMuted, fontSize: 12 }}>Des indicateurs internes de maîtrise, pas des notes scolaires.</Text>
        </View>
      )}
    </Card>
  );
}

// ── LearningDNA (6) ──────────────────────────────────────────────────────────
export function LearningDNA({ dna }: { dna: LearningDna }) {
  const { colors: c } = useTokens();
  return (
    <Card style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <SectionTitle>🧬 Learning DNA</SectionTitle>
        <Badge label={`maturité ${Math.round(dna.maturity)}%`} tone="ai" />
      </View>
      {dna.traits.length === 0 ? (
        <Text style={{ color: c.textMuted, fontSize: 14 }}>Ton ADN d’apprentissage se dessine au fil de tes sessions.</Text>
      ) : (
        <View style={{ gap: 10 }}>
          {dna.traits.slice(0, 5).map((tr) => (
            <View key={tr.key} style={{ gap: 3 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: c.textPrimary, fontSize: 14, fontWeight: '600' }}>{tr.label}</Text>
                <Text style={{ color: c.textMuted, fontSize: 12 }}>{Math.round(tr.confidence)}%</Text>
              </View>
              <Text style={{ color: c.textSecondary, fontSize: 12, lineHeight: 17 }}>{tr.summary}</Text>
            </View>
          ))}
          <Text style={{ color: c.textMuted, fontSize: 12 }}>Des observations qui évoluent, pas un diagnostic.</Text>
        </View>
      )}
    </Card>
  );
}

// ── MemoryOverview (7) ───────────────────────────────────────────────────────
export function MemoryOverview({ summary, due }: { summary: TwinOverview['summary']; due: number }) {
  const { colors: c } = useTokens();
  const cell = (v: number, l: string) => (
    <View style={{ flex: 1, minWidth: 74, alignItems: 'center', gap: 2 }}>
      <Text style={{ color: c.textPrimary, fontSize: 20, fontWeight: '800' }}>{v}</Text>
      <Text style={{ color: c.textMuted, fontSize: 12, textAlign: 'center' }}>{l}</Text>
    </View>
  );
  return (
    <Card>
      <SectionTitle>🧠 Mémoire</SectionTitle>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {cell(summary.totalConcepts, 'étudiés')}
        {cell(summary.strongConcepts, 'maîtrisés')}
        {cell(summary.weakConcepts, 'fragiles')}
        {cell(due, 'à réviser')}
      </View>
      <Text style={{ color: c.textMuted, fontSize: 12, marginTop: 8 }}>Second Brain surveille automatiquement l’évolution de tes connaissances.</Text>
    </Card>
  );
}

// ── Weaknesses (8) + Strengths (9) ───────────────────────────────────────────
export function WeaknessesPanel({ weaknesses, onReview }: { weaknesses: ConceptScore[]; onReview: () => void }) {
  const { colors: c } = useTokens();
  const shown = weaknesses.slice(0, 4);
  if (shown.length === 0) return null;
  return (
    <Card style={{ borderColor: c.warning, gap: 8 }}>
      <Text style={{ color: c.warning, fontSize: 13, fontWeight: '800' }}>⚠️ Ce qui nécessite ton attention</Text>
      {shown.map((w) => (
        <Text key={w.conceptId} style={{ color: c.textPrimary, fontSize: 15 }}>→ {w.name}</Text>
      ))}
      <View style={{ alignSelf: 'flex-start', marginTop: 4 }}>
        <Button label="Réviser maintenant" onPress={onReview} />
      </View>
    </Card>
  );
}

export function StrengthsPanel({ strengths }: { strengths: ConceptScore[] }) {
  const { colors: c } = useTokens();
  const shown = strengths.slice(0, 6);
  if (shown.length === 0) return null;
  return (
    <Card style={{ gap: 8 }}>
      <Text style={{ color: c.success, fontSize: 13, fontWeight: '800' }}>⭐ Tes forces</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {shown.map((s) => (
          <Badge key={s.conceptId} label={s.name} tone="success" />
        ))}
      </View>
    </Card>
  );
}

// ── BrainRecommendations (12) — the AI teacher interprets the brain ──────────
export function BrainRecommendations({ weaknesses, onStart }: { weaknesses: ConceptScore[]; onStart: () => void }) {
  const { colors: c } = useTokens();
  if (weaknesses.length === 0) return null;
  const names = weaknesses.slice(0, 2).map((w) => w.name).join(' et ');
  return (
    <Card style={{ borderColor: c.aiAccent, gap: 10 }}>
      <Text style={{ color: c.aiAccent, fontSize: 12, fontWeight: '800' }}>👨‍🏫 TON PROFESSEUR</Text>
      <AITeacherMessage
        text={`J’ai remarqué que ${names} restent fragiles. Je te propose de les consolider avant de poursuivre.`}
        posture="supportive"
      />
      <View style={{ alignSelf: 'flex-start' }}>
        <Button label="Commencer" variant="ai" onPress={onStart} />
      </View>
    </Card>
  );
}

// ── Empty state (13) ─────────────────────────────────────────────────────────
export function EmptyBrain({ onStart }: { onStart: () => void }) {
  const { colors: c } = useTokens();
  return (
    <Card style={{ alignItems: 'center', gap: 12, paddingVertical: 40 }}>
      <Text style={{ fontSize: 44 }}>🧠</Text>
      <Text style={{ color: c.textPrimary, fontSize: 20, fontWeight: '800', textAlign: 'center' }}>Ton cerveau numérique commence ici.</Text>
      <Text style={{ color: c.textSecondary, fontSize: 15, textAlign: 'center', lineHeight: 22, maxWidth: 360 }}>
        Au fur et à mesure que tu apprends, Second Brain construira automatiquement ta carte de connaissances.
      </Text>
      <Button label="Commencer à apprendre" variant="ai" onPress={onStart} />
    </Card>
  );
}
