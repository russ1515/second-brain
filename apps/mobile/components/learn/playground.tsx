import { useState } from 'react';
import { Text, View } from 'react-native';
import { useTokens } from '../../lib/design/theme';
import { CAPABILITIES, MODES, SOURCES, START_ENTRIES, type TeachingMode } from '../../lib/learn/catalog';
import {
  AITeacherPanel,
  CapabilityCard,
  ConceptExplanation,
  DeepSearchScope,
  DocumentContextForm,
  DocumentDropZone,
  ExamCard,
  LanguagePracticeCard,
  LearningModeSelector,
  MultiPageScanner,
  PedagogyLevelSelector,
  ProgressFeedback,
  SourceCitation,
  TaskStepper,
  TranslationPanel,
  UniversalStartBar,
  VoiceShadowing,
  type PedagogyLevel,
} from './components';

/**
 * Apprendre playground (UI/UX Sprint 4). An interactive gallery of the reusable
 * Learn components, for verifying them in light/dark and at any width. No
 * network — everything is local sample data.
 */
export function LearnPlayground() {
  const { colors: c } = useTokens();
  const [mode, setMode] = useState<TeachingMode['key'] | null>('explain');
  const [level, setLevel] = useState<PedagogyLevel>('assist');
  const [pages, setPages] = useState(3);
  const [scope, setScope] = useState<'docs' | 'web'>('docs');

  const label = (t: string) => (
    <Text style={{ color: c.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', marginTop: 4 }}>{t}</Text>
  );

  return (
    <View style={{ gap: 12 }}>
      {label('Convergence — Universal start')}
      <UniversalStartBar entries={START_ENTRIES} onText={() => {}} onPick={() => {}} />

      {label('Learning mode selector')}
      <LearningModeSelector modes={MODES} value={mode} onSelect={(m) => setMode(m.key)} />

      {label('Capability cards')}
      <CapabilityCard capability={CAPABILITIES[0]} onOpen={() => {}} />
      <CapabilityCard capability={CAPABILITIES[4]} onOpen={() => {}} />

      {label('AI Teacher panel')}
      <AITeacherPanel posture="supportive" message="Que veux-tu comprendre aujourd’hui ? On peut partir d’un document ou d’une question." onWrite={() => {}} onSpeak={() => {}} />

      {label('Document drop zone + sources')}
      <DocumentDropZone sources={SOURCES} onPick={() => {}} />

      {label('Multi-page scanner')}
      <MultiPageScanner pages={pages} onAddPage={() => setPages((p) => p + 1)} onAnalyze={() => {}} />

      {label('Document context + AI suggestion')}
      <DocumentContextForm suggestion="J’ai identifié ce document comme un cours de mathématiques de niveau Licence 1." onConfirm={() => {}} />

      {label('Academic Workspace — pedagogy level + task stepper')}
      <PedagogyLevelSelector value={level} onChange={setLevel} />
      <TaskStepper steps={['Sujet', 'Analyse', 'Compréhension', 'Plan', 'Résolution', 'Vérification', 'Explication', 'Apprentissage']} current={3} />

      {label('Exam card')}
      <ExamCard title="Examen blanc — Chapitre 3" detail="Généré à partir de ce que tu as étudié." count={8} onStart={() => {}} />

      {label('Language practice + Voice Shadowing')}
      <LanguagePracticeCard skills={['Vocabulaire', 'Grammaire', 'Conversation', 'Compréhension', 'Prononciation']} onPractice={() => {}} />
      <VoiceShadowing phrase="Artificial intelligence is changing the world." scores={{ pronunciation: 0.82, accent: 0.74, fluency: 0.86 }} />

      {label('International mobility — translation panel')}
      <TranslationPanel
        concept="Pointer (informatique)"
        nativeExplanation="Un pointeur est une variable qui contient l’adresse mémoire d’une autre variable."
        term="pointer"
        translation="pointeur"
        example="A pointer stores a memory address."
      />

      {label('Deep search — in-docs vs external')}
      <DeepSearchScope value={scope} onChange={setScope} />
      <SourceCitation title="Algèbre linéaire — page 12" />
      <SourceCitation title="Wikipedia — Linear map" external />

      {label('Concept explanation + progress feedback')}
      <ConceptExplanation concept="La règle de chaîne" text="Elle permet de dériver une fonction composée : (f∘g)' = (f'∘g) · g'." />
      <ProgressFeedback concept="Dérivées" mastery={0.62} note="Je vois que la règle de chaîne reste fragile. Faisons une courte leçon avant de continuer." />
    </View>
  );
}
