import { useState } from 'react';
import { Text, View } from 'react-native';
import type { ReviewRating, RiskPrediction } from '@second-brain/shared';
import { useTokens } from '../../lib/design/theme';
import { useResponsive } from '../../lib/responsive';
import { dueBreakdown } from '../../lib/review/catalog';
import {
  AutoExtractCard,
  DueCounter,
  ExamRiskAlert,
  ForgettingCurve,
  QuickLaunch,
  ReviewStatsStrip,
  SessionComplete,
  SmartCard,
} from './components';
import {
  ConceptsToConsolidate,
  EmptyReview,
  RetentionMap,
  RevisionPlanner,
  ReviewSessionPane,
  TeacherExplanation,
  TodayBriefing,
  VocabCard,
  WatchList,
  feedbackFor,
} from './advanced';

/**
 * Réviser playground (UI/UX Sprint 6, full spec). Interactive gallery of the
 * FSRS revision components + the 5-zone architecture, on sample data. No network.
 */
const RISK: RiskPrediction = {
  kind: 'forgetting',
  probability: 68,
  level: 'high',
  cause: 'Plusieurs concepts liés à ton examen de physique n’ont pas été revus depuis 9 jours.',
  action: 'Une révision de 10 minutes aujourd’hui remettrait ta mémoire au niveau.',
  reasons: ['3 concepts due', 'examen dans 6 jours', 'rétention en baisse'],
};

export function ReviewPlayground() {
  const { colors: c } = useTokens();
  const { width } = useResponsive();
  const wide = width >= 760;
  const [last, setLast] = useState<ReviewRating | null>(null);
  const [feedback, setFeedback] = useState(feedbackFor(3, 'Dérivées'));
  const [empty, setEmpty] = useState(false);
  const stats = { due: 14, new: 5, learning: 3, review: 4, relearning: 2, reviewsToday: 12, retention: 0.78 };
  const label = (t: string) => (
    <Text style={{ color: c.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', marginTop: 4 }}>{t}</Text>
  );

  if (empty) {
    return (
      <View style={{ gap: 10 }}>
        {label('First-use empty build')}
        <EmptyReview onStart={() => setEmpty(false)} />
      </View>
    );
  }

  return (
    <View style={{ gap: 12 }}>
      {label('Zone 1 — Aujourd’hui (bilan nominatif + pourquoi)')}
      <TodayBriefing name="Amina" counts={dueBreakdown(stats)} minutes={6} why="2 concepts risquent de se perdre aujourd’hui — les revoir maintenant a le plus d’impact." onStart={() => {}} />

      {label('Zone 2 — Concepts à consolider')}
      <ConceptsToConsolidate
        concepts={[
          { id: '1', name: 'Dérivées', priority: 'critical', type: 'application' },
          { id: '2', name: 'Fractions', priority: 'reinforce', type: 'qr' },
          { id: '3', name: 'Vocabulaire — anglais', priority: 'reinforce', type: 'recognition' },
        ]}
        onReview={() => {}}
      />

      {label('Zone 3 — Smart Cards (launch + breakdown)')}
      <QuickLaunch due={stats.due} onLaunch={() => {}} />
      <DueCounter counts={dueBreakdown(stats)} onPick={() => {}} />
      <ReviewStatsStrip reviewsToday={stats.reviewsToday} retention={stats.retention} />

      {label('Session flow — dual-pane desktop (carte + Professeur IA)')}
      <ReviewSessionPane
        wide={wide}
        card={
          <SmartCard
            front="Quelle est la dérivée de sin(x) ?"
            back="cos(x)"
            index={2}
            total={14}
            cardType="application"
            onRate={(r) => { setLast(r); setFeedback(feedbackFor(r, 'Dérivées')); }}
            onAskTeacher={() => {}}
          />
        }
        teacher={<TeacherExplanation posture={feedback.posture} message={feedback.message} />}
      />
      {last != null ? <Text style={{ color: c.textMuted, fontSize: 12 }}>Dernière évaluation FSRS : {last} → Digital Twin mis à jour</Text> : null}

      {label('Module langues — carte de vocabulaire')}
      <VocabCard term="powerhouse" translation="centrale (énergétique)" ipa="/ˈpaʊərˌhaʊs/" example="The mitochondria is the powerhouse of the cell." onRate={() => {}} />

      {label('Zone 4 — Progression de rétention')}
      <RetentionMap counts={{ solid: 12, progressing: 5, fragile: 3, urgent: 2 }} />
      <WatchList
        items={[
          { id: '1', name: 'Dérivées — règle de chaîne', when: 'Réviser demain', minutes: 8 },
          { id: '2', name: 'ADN', when: 'Réviser dans 2 j', minutes: 5 },
        ]}
        onReview={() => {}}
      />
      <ForgettingCurve retention={stats.retention} />
      <ExamRiskAlert risk={RISK} onReview={() => {}} />

      {label('Zone 5 — Planning (Aujourd’hui / Demain / Dates clés)')}
      <RevisionPlanner
        today={[{ id: '1', name: 'Fractions', priority: 'critical' }, { id: '2', name: 'Mitose', priority: 'reinforce' }]}
        tomorrow={[{ id: '3', name: 'Génétique', priority: 'reinforce' }, { id: '4', name: 'Cellule', priority: 'stable' }]}
        keyDates={[{ id: 'e1', label: 'Examen de Physique', when: 'dans 6 j' }]}
      />

      {label('FSRS auto-extraction')}
      <AutoExtractCard onExtract={() => {}} />

      {label('État — Tout est à jour (sans culpabilisation)')}
      <SessionComplete reviewed={12} onDone={() => {}} />
    </View>
  );
}
