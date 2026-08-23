import { useState } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { OnboardingAnswers, OnboardingStep } from '@second-brain/shared';
import { useTokens } from '../../lib/design/theme';
import { Badge, Button } from '../ds/core';
import { Tabs } from '../ds/controls';
import type { StepProps } from './steps';
import {
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
} from './steps';

/**
 * Onboarding playground (UI/UX Sprint 2, task 2.22). A framed, interactive
 * gallery of every KYC step, driven by LOCAL answers so a reviewer can try each
 * one in light/dark and at any width. No network, no persistence.
 */
const PREVIEWS: { key: OnboardingStep; label: string }[] = [
  { key: 'welcome', label: 'Welcome' },
  { key: 'identity', label: 'Identity' },
  { key: 'category', label: 'Education' },
  { key: 'languages', label: 'Languages' },
  { key: 'language_learner', label: 'Language mode' },
  { key: 'goals', label: 'Goals' },
  { key: 'subjects', label: 'Subjects' },
  { key: 'mobility', label: 'Mobility' },
  { key: 'preferences', label: 'Preferences' },
  { key: 'teacher', label: 'AI Teacher' },
  { key: 'academic_support', label: 'Academic help' },
  { key: 'assessment', label: 'Assessment' },
  { key: 'twin', label: 'Digital Twin' },
  { key: 'adaptation', label: 'Completion' },
];

export function OnboardingPlayground() {
  const { colors: c, radius } = useTokens();
  const router = useRouter();
  const [which, setWhich] = useState<OnboardingStep>('welcome');
  const [answers, setAnswers] = useState<OnboardingAnswers>({
    identity: { firstName: 'Léa' },
    education: { category: 'university', field: 'Informatique' },
    languages: { native: 'fr', interface: 'fr', study: 'en' },
    goals: ['understand', 'exams'],
    subjects: ['Mathématiques', 'Informatique'],
    teacher: { tone: 'balanced', explanations: 'detailed', intervention: 'guide_me' },
  });

  const patch = (section: keyof OnboardingAnswers, value: unknown) =>
    setAnswers((p) => ({ ...p, [section]: value }));
  const patchField = (section: keyof OnboardingAnswers, fields: Record<string, unknown>) =>
    setAnswers((p) => ({ ...p, [section]: { ...((p[section] as object) ?? {}), ...fields } }));

  const base: StepProps = {
    progress: 0.5,
    answers,
    patch,
    patchField,
    onNext: () => {},
    onBack: () => {},
    onSkip: () => {},
  };

  const render = () => {
    switch (which) {
      case 'welcome':
        return <StepWelcome progress={0.06} onNext={() => {}} />;
      case 'identity':
        return <StepIdentity {...base} />;
      case 'category':
        return <StepCategory {...base} />;
      case 'languages':
        return <StepLanguages {...base} />;
      case 'language_learner':
        return <StepLanguageLearner {...base} />;
      case 'goals':
        return <StepGoals {...base} />;
      case 'subjects':
        return <StepSubjects {...base} />;
      case 'mobility':
        return <StepMobility {...base} />;
      case 'preferences':
        return <StepPreferences {...base} />;
      case 'teacher':
        return <StepTeacher {...base} />;
      case 'academic_support':
        return <StepAcademicSupport {...base} />;
      case 'assessment':
        return <StepAssessment {...base} />;
      case 'twin':
        return <StepTwin {...base} onEdit={() => {}} />;
      case 'adaptation':
        return <StepAdaptation progress={1} answers={answers} onBack={() => {}} onEnter={() => {}} />;
      default:
        return null;
    }
  };

  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {PREVIEWS.map((p) => (
          <Badge key={p.key} label={p.label} tone={p.key === which ? 'ai' : 'neutral'} />
        ))}
      </View>
      <Tabs options={PREVIEWS.map((p) => p.key)} value={which} onChange={setWhich} labelFor={(k) => PREVIEWS.find((p) => p.key === k)?.label ?? k} />
      {/* Framed viewport: a full-screen step confined to a fixed preview area. */}
      <View style={{ height: 560, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border, overflow: 'hidden', backgroundColor: c.background }}>
        {render()}
      </View>
      <Button label="Ouvrir le parcours complet →" variant="secondary" onPress={() => router.push('/onboarding')} />
      <Text style={{ color: c.textMuted, fontSize: 12 }}>
        Parcours adaptatif : la catégorie choisie change les étapes (un apprenant de langue saute le cursus universitaire).
      </Text>
    </View>
  );
}
