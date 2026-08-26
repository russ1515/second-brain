import { useCallback, useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import type {
  LearningCategory,
  LearningDna,
  LearningPath,
  OnboardingState,
  StrengthsWeaknesses,
  TwinGraph,
  TwinGraphNode,
  TwinOverview,
} from '@second-brain/shared';
import { api } from '../../lib/client';
import { useAuth } from '../../lib/auth-context';
import { useI18n } from '../../lib/i18n';
import { useTokens } from '../../lib/design/theme';
import { useResponsive } from '../../lib/responsive';
import { Skeleton } from '../../components/ds/core';
import { brainPersona } from '../../lib/brain/graph';
import { KnowledgeGraph, MasteryLegend } from '../../components/brain/knowledge-graph';
import {
  BrainOverview,
  BrainRecommendations,
  CognitiveProfile,
  ConceptDetails,
  EmptyBrain,
  LearningDNA,
  MemoryOverview,
  StrengthsPanel,
  WeaknessesPanel,
} from '../../components/brain/panels';

/**
 * 🧠 Mon Cerveau — the visual Digital Twin (UI/UX Sprint 5).
 *
 * The Knowledge Graph is the centrepiece: concepts as mastery-coloured nodes,
 * prerequisites as edges, selectable to open a detail that routes into Learn /
 * Réviser. Around it: the cognitive profile, Learning DNA, memory, strengths and
 * fragilities. Pure visualisation + UX over the existing twin — no new logic,
 * no new main tab. Adapts to the KYC persona; a new learner sees an honest empty
 * state, not a huge empty graph.
 */
export default function BrainScreen() {
  const { user } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const { colors: c } = useTokens();
  const { width, maxContentWidth } = useResponsive();

  const [graph, setGraph] = useState<TwinGraph | null>(null);
  const [twin, setTwin] = useState<TwinOverview | null>(null);
  const [sw, setSw] = useState<StrengthsWeaknesses | null>(null);
  const [dna, setDna] = useState<LearningDna | null>(null);
  const [path, setPath] = useState<LearningPath | null>(null);
  const [category, setCategory] = useState<LearningCategory | undefined>(undefined);
  const [selected, setSelected] = useState<TwinGraphNode | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [g, tw, s, d, p, kyc] = await Promise.allSettled([
      api<TwinGraph>('/twin/graph'),
      api<TwinOverview>('/twin'),
      api<StrengthsWeaknesses>('/twin/strengths'),
      api<LearningDna>('/learning-dna'),
      api<LearningPath>('/twin/next'),
      api<OnboardingState>('/onboarding'),
    ]);
    if (g.status === 'fulfilled') setGraph(g.value);
    if (tw.status === 'fulfilled') setTwin(tw.value);
    if (s.status === 'fulfilled') setSw(s.value);
    if (d.status === 'fulfilled') setDna(d.value);
    if (p.status === 'fulfilled') setPath(p.value);
    if (kyc.status === 'fulfilled') setCategory(kyc.value.answers.education?.category ?? undefined);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (user) void load();
    }, [user, load]),
  );

  const persona = brainPersona(category ?? null);
  const wide = width >= 760;
  // A more immersive, near-fullscreen graph on large desktops.
  const graphHeight = width >= 1440 ? 640 : width >= 1024 ? 560 : 420;
  const due = (path?.items ?? []).reduce((n, i) => n + i.dueCount, 0);

  const openLearn = (node: TwinGraphNode) =>
    router.push({ pathname: '/lesson/new', params: { conceptId: node.id, title: node.name } });
  const explore = (id: string) => {
    const n = graph?.nodes.find((x) => x.id === id);
    if (n) setSelected(n);
  };

  if (loading) return <BrainSkeleton maxWidth={maxContentWidth} />;

  const hasGraph = (graph?.nodes.length ?? 0) > 0;

  if (!hasGraph) {
    return (
      <ScrollView contentContainerStyle={[styles.container, { maxWidth: maxContentWidth }]}>
        <Header intro={persona.intro} />
        <EmptyBrain onStart={() => router.push('/learn')} />
      </ScrollView>
    );
  }

  const detail = selected ? (
    <ConceptDetails
      node={selected}
      graph={graph!}
      childLabels={persona.childLabels}
      onLearn={() => openLearn(selected)}
      onReview={() => router.push('/revision')}
      onExplore={explore}
    />
  ) : (
    <PickHint />
  );

  const Pair = ({ a, b }: { a: ReactNode; b: ReactNode }) =>
    wide ? (
      <View style={{ flexDirection: 'row', gap: 14 }}>
        <View style={{ flex: 1 }}>{a}</View>
        <View style={{ flex: 1 }}>{b}</View>
      </View>
    ) : (
      <>{a}{b}</>
    );

  return (
    <ScrollView contentContainerStyle={[styles.container, { maxWidth: maxContentWidth }]}>
      <Header intro={persona.intro} />

      <BrainOverview summary={twin!.summary} />

      {/* Centrepiece: the graph + the selected concept's detail */}
      <View style={{ gap: 10 }}>
        <SectionLabel>{t('brain.graph')}</SectionLabel>
        {wide ? (
          <View style={{ flexDirection: 'row', gap: 14 }}>
            <View style={{ flex: width >= 1024 ? 1.7 : 1.4 }}>
              <KnowledgeGraph graph={graph!} selectedId={selected?.id ?? null} onSelect={setSelected} height={graphHeight} />
              <View style={{ marginTop: 8 }}><MasteryLegend /></View>
            </View>
            <View style={{ flex: 1 }}>{detail}</View>
          </View>
        ) : (
          <>
            <KnowledgeGraph graph={graph!} selectedId={selected?.id ?? null} onSelect={setSelected} />
            <MasteryLegend />
            {detail}
          </>
        )}
      </View>

      {/* Attention + the teacher's interpretation */}
      {sw ? <WeaknessesPanel weaknesses={sw.weaknesses} onReview={() => router.push('/revision')} /> : null}
      {sw ? <BrainRecommendations weaknesses={sw.weaknesses} onStart={() => router.push('/revision')} /> : null}

      {/* Profile / DNA / Memory / Strengths — depth adapts to the persona */}
      <Pair
        a={sw ? <CognitiveProfile strengths={sw.strengths} /> : <View />}
        b={dna ? <LearningDNA dna={dna} /> : <View />}
      />
      <Pair
        a={<MemoryOverview summary={twin!.summary} due={due} />}
        b={sw ? <StrengthsPanel strengths={sw.strengths} /> : <View />}
      />

      <Text style={{ color: c.textMuted, fontSize: 12, textAlign: 'center', marginTop: 4 }}>
        Chaque cours, conversation ou exercice enrichit ton cerveau numérique.
      </Text>
    </ScrollView>
  );

  function Header({ intro }: { intro: string }) {
    return (
      <View style={{ gap: 4 }}>
        <Text style={{ color: c.textPrimary, fontSize: 30, fontWeight: '800' }}>🧠 Mon Cerveau</Text>
        <Text style={{ color: c.textSecondary, fontSize: 15, lineHeight: 22 }}>{intro}</Text>
      </View>
    );
  }
  function SectionLabel({ children }: { children: ReactNode }) {
    return <Text style={{ color: c.textMuted, fontSize: 12, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' }}>{children}</Text>;
  }
  function PickHint() {
    return (
      <View style={{ borderWidth: 1, borderColor: c.borderSubtle, borderRadius: 14, padding: 16, justifyContent: 'center', alignItems: 'center', minHeight: 100 }}>
        <Text style={{ color: c.textMuted, fontSize: 14, textAlign: 'center' }}>Sélectionne un concept dans le graphe pour voir son détail et agir.</Text>
      </View>
    );
  }
}

function BrainSkeleton({ maxWidth }: { maxWidth: number }) {
  return (
    <ScrollView contentContainerStyle={[styles.container, { maxWidth }]}>
      <Skeleton height={40} width="60%" />
      <Skeleton height={90} />
      <Skeleton height={360} />
      <Skeleton height={110} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 16, width: '100%', alignSelf: 'center', paddingBottom: 48 },
});
