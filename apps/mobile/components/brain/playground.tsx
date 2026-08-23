import { useState } from 'react';
import { Text, View } from 'react-native';
import type { ConceptScore, LearningDna, TwinGraph, TwinGraphNode } from '@second-brain/shared';
import { useTokens } from '../../lib/design/theme';
import { KnowledgeGraph, MasteryLegend } from './knowledge-graph';
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
} from './panels';

/**
 * Mon Cerveau playground (UI/UX Sprint 5). Interactive gallery of the brain
 * components on a small sample graph, for verifying them in light/dark and at
 * any width. No network.
 */
const NODES: TwinGraphNode[] = [
  { id: 'cellule', name: 'Cellule', mastery: 0.9, level: 'strong', status: 'mastered' },
  { id: 'adn', name: 'ADN', mastery: 0.82, level: 'strong', status: 'mastered' },
  { id: 'mitose', name: 'Mitose', mastery: 0.54, level: 'developing', status: 'in_progress' },
  { id: 'genetique', name: 'Génétique', mastery: 0.31, level: 'weak', status: 'at_risk' },
  { id: 'mutation', name: 'Mutation', mastery: null, level: 'unknown', status: 'ready' },
  { id: 'heredite', name: 'Hérédité', mastery: null, level: 'unknown', status: 'blocked' },
  { id: 'chromosome', name: 'Chromosomes', mastery: 0.68, level: 'developing', status: 'in_progress' },
];
const GRAPH: TwinGraph = {
  nodes: NODES,
  edges: [
    { id: 'e1', sourceId: 'cellule', targetId: 'adn', relation: 'prerequisite' },
    { id: 'e2', sourceId: 'cellule', targetId: 'mitose', relation: 'prerequisite' },
    { id: 'e3', sourceId: 'adn', targetId: 'genetique', relation: 'prerequisite' },
    { id: 'e4', sourceId: 'mitose', targetId: 'genetique', relation: 'prerequisite' },
    { id: 'e5', sourceId: 'genetique', targetId: 'mutation', relation: 'prerequisite' },
    { id: 'e6', sourceId: 'genetique', targetId: 'heredite', relation: 'prerequisite' },
    { id: 'e7', sourceId: 'adn', targetId: 'chromosome', relation: 'related' },
  ],
};
const SUMMARY = { totalConcepts: 7, trackedConcepts: 5, strongConcepts: 2, weakConcepts: 2, unlearnedConcepts: 2, averageMastery: 0.65 };
const STRENGTHS: ConceptScore[] = [
  { conceptId: 'cellule', name: 'Cellule', mastery: 0.9, stars: 5 },
  { conceptId: 'adn', name: 'ADN', mastery: 0.82, stars: 4 },
  { conceptId: 'chromosome', name: 'Chromosomes', mastery: 0.68, stars: 3 },
];
const WEAKNESSES: ConceptScore[] = [
  { conceptId: 'genetique', name: 'Génétique', mastery: 0.31, stars: 2 },
  { conceptId: 'mitose', name: 'Mitose', mastery: 0.54, stars: 3 },
];
const DNA: LearningDna = {
  maturity: 64,
  interactions: 128,
  updatedAt: new Date().toISOString(),
  traits: [
    { key: 'modality', label: 'Explications visuelles', summary: 'Tu progresses plus vite avec des schémas et des exemples.', confidence: 78, band: 'high', evidence: 24 },
    { key: 'explanation', label: 'Exercices progressifs', summary: 'Tes réussites augmentent quand la difficulté monte par paliers.', confidence: 61, band: 'medium', evidence: 15 },
    { key: 'retentionFormat', label: 'Répétition espacée', summary: 'Ta rétention est meilleure sur les concepts revus régulièrement.', confidence: 55, band: 'medium', evidence: 12 },
  ] as unknown as LearningDna['traits'],
};

export function BrainPlayground() {
  const { colors: c } = useTokens();
  const [selected, setSelected] = useState<TwinGraphNode | null>(NODES[3]); // Génétique
  const [empty, setEmpty] = useState(false);
  const label = (t: string) => (
    <Text style={{ color: c.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', marginTop: 4 }}>{t}</Text>
  );

  if (empty) {
    return (
      <View style={{ gap: 10 }}>
        {label('Empty state (new learner)')}
        <EmptyBrain onStart={() => setEmpty(false)} />
      </View>
    );
  }

  return (
    <View style={{ gap: 12 }}>
      {label('Brain overview')}
      <BrainOverview summary={SUMMARY} />

      {label('Knowledge graph (drag to pan · ＋／－ to zoom · tap a node)')}
      <KnowledgeGraph graph={GRAPH} selectedId={selected?.id ?? null} onSelect={setSelected} height={340} />
      <MasteryLegend />

      {label('Concept details (select a node)')}
      {selected ? (
        <ConceptDetails node={selected} graph={GRAPH} childLabels={false} onLearn={() => {}} onReview={() => {}} onExplore={(id) => setSelected(NODES.find((n) => n.id === id) ?? selected)} />
      ) : null}

      {label('Weaknesses + teacher interpretation')}
      <WeaknessesPanel weaknesses={WEAKNESSES} onReview={() => {}} />
      <BrainRecommendations weaknesses={WEAKNESSES} onStart={() => {}} />

      {label('Cognitive profile + Learning DNA')}
      <CognitiveProfile strengths={STRENGTHS} />
      <LearningDNA dna={DNA} />

      {label('Memory + strengths')}
      <MemoryOverview summary={SUMMARY} due={7} />
      <StrengthsPanel strengths={STRENGTHS} />
    </View>
  );
}
