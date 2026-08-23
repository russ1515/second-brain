import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../lib/auth-context';
import { useTokens } from '../lib/design/theme';
import { Loading } from '../components/ui';
import { BrainViz } from '../components/landing/landing-page';
import { useOnboarding } from '../lib/onboarding/use-onboarding';
import type { StepProps } from '../components/onboarding/steps';
import {
  StepAcademic,
  StepAcademicSupport,
  StepAdaptation,
  StepAssessment,
  StepCategory,
  StepGoals,
  StepIdentity,
  StepLanguageLearner,
  StepLanguages,
  StepMobility,
  StepPreferences,
  StepSubjects,
  StepTeacher,
  StepTwin,
  StepWelcome,
} from '../components/onboarding/steps';

/**
 * The onboarding route (UI/UX Sprint 2). One screen drives the whole adaptive
 * KYC: it resumes where the learner stopped, saves progressively, branches by
 * category, and on the final step turns the answers into a real system
 * configuration before entering the app.
 */
export default function OnboardingScreen() {
  const { colors: c } = useTokens();
  const router = useRouter();
  const { refreshOnboarding } = useAuth();
  const ctrl = useOnboarding();
  const [entering, setEntering] = useState(false);

  if (ctrl.loading) return <Loading label="Je prépare ton espace…" />;

  const progress = (ctrl.stepIndex + 1) / ctrl.total;
  const base: StepProps = {
    progress,
    answers: ctrl.answers,
    patch: ctrl.patch,
    patchField: ctrl.patchField,
    onNext: ctrl.next,
    onBack: ctrl.back,
    onSkip: ctrl.next,
    saving: ctrl.saving,
  };

  const enter = async () => {
    setEntering(true);
    try {
      await ctrl.complete();
      await refreshOnboarding?.();
      router.replace('/(tabs)');
    } catch {
      setEntering(false);
    }
  };

  if (entering) return <GeneratingTwin />;

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      {renderStep()}
    </View>
  );

  function renderStep() {
    switch (ctrl.step) {
      case 'welcome':
        return <StepWelcome progress={progress} onNext={ctrl.next} />;
      case 'identity':
        return <StepIdentity {...base} />;
      case 'category':
        return <StepCategory {...base} />;
      case 'academic':
        return <StepAcademic {...base} />;
      case 'goals':
        return <StepGoals {...base} />;
      case 'subjects':
        return <StepSubjects {...base} />;
      case 'languages':
        return <StepLanguages {...base} />;
      case 'mobility':
        return <StepMobility {...base} />;
      case 'language_learner':
        return <StepLanguageLearner {...base} />;
      case 'preferences':
        return <StepPreferences {...base} />;
      case 'teacher':
        return <StepTeacher {...base} />;
      case 'academic_support':
        return <StepAcademicSupport {...base} />;
      case 'assessment':
        return <StepAssessment {...base} />;
      case 'twin':
        return <StepTwin {...base} onEdit={ctrl.goTo} />;
      case 'adaptation':
      case 'done':
        return (
          <StepAdaptation
            progress={progress}
            answers={ctrl.answers}
            onBack={ctrl.back}
            onEnter={enter}
            entering={entering}
          />
        );
      default:
        return <StepWelcome progress={progress} onNext={ctrl.next} />;
    }
  }
}

/** Digital-twin generation animation shown while the KYC is finalised (Sprint 8
 *  — AI Welcome Engine: the twin is being built from the learner's profile). */
const GEN_MESSAGES = [
  'Analyse de ton profil…',
  'Construction de ta carte de connaissances…',
  'Personnalisation de ton Professeur IA…',
  'Ton cerveau numérique prend forme…',
];
function GeneratingTwin() {
  const { colors: c } = useTokens();
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((n) => (n + 1) % GEN_MESSAGES.length), 1400);
    return () => clearInterval(id);
  }, []);
  return (
    <View style={{ flex: 1, backgroundColor: c.background, alignItems: 'center', justifyContent: 'center', gap: 20, padding: 24 }}>
      <BrainViz color={c.aiAccent} nodeColor={c.primary} />
      <Text style={{ color: c.textPrimary, fontSize: 22, fontWeight: '800', textAlign: 'center' }}>Création de votre cerveau numérique…</Text>
      <Text style={{ color: c.textSecondary, fontSize: 15, textAlign: 'center' }}>{GEN_MESSAGES[i]}</Text>
    </View>
  );
}
