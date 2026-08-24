import { useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import type {
  GenerateAssessmentResponse,
  KycAssessmentItem,
  KycMasteryLevel,
  OnboardingAnswers,
  OnboardingStep,
  SystemConfiguration,
} from '@second-brain/shared';
import { api } from '../../lib/client';
import { useTokens } from '../../lib/design/theme';
import { useI18n, type TranslationKey } from '../../lib/i18n';
import { Alert, Button, Card, Input } from '../ds/core';
import { AIRecommendation, AITeacherMessage } from '../ds/ai';
import {
  ACADEMIC_SUPPORT_CHOICES,
  AGE_BANDS,
  CATEGORY_CHOICES,
  CEFR_LEVELS,
  categoryLabel,
  CORRECTION_CHOICES,
  EXPLANATION_CHOICES,
  GOAL_CHOICES,
  INTERVENTION_CHOICES,
  LANGUAGE_SKILL_CHOICES,
  PREFERENCE_CHOICES,
  QUICK_LANGUAGES,
  SELF_RATING,
  SUBJECT_CHOICES,
  TONE_CHOICES,
  type Choice,
} from '../../lib/onboarding/catalog';
import { MultiChoice, PrivacyNote, SingleChoice, StepScaffold } from './kit';

/**
 * The KYC steps (UI/UX Sprint 2). Each step is a self-contained body rendered by
 * `StepView`; the same bodies power the design-playground gallery (2.22). Copy is
 * French — Second Brain's product voice.
 */

const AVATARS: Choice[] = [
  { value: '🧑‍🎓', label: '🧑‍🎓' },
  { value: '👩‍🎓', label: '👩‍🎓' },
  { value: '🧑‍💻', label: '🧑‍💻' },
  { value: '👨‍🔬', label: '👨‍🔬' },
  { value: '🧑‍🏫', label: '🧑‍🏫' },
  { value: '🚀', label: '🚀' },
  { value: '🧠', label: '🧠' },
  { value: '⭐', label: '⭐' },
];

export interface StepProps {
  progress: number;
  answers: OnboardingAnswers;
  patch: (section: keyof OnboardingAnswers, value: unknown) => void;
  patchField: (section: keyof OnboardingAnswers, fields: Record<string, unknown>) => void;
  onNext: () => void;
  onBack: () => void;
  onSkip?: () => void;
  saving?: boolean;
}

// ── Welcome (2.1) ────────────────────────────────────────────────────────────
export function StepWelcome({ progress, onNext }: { progress: number; onNext: () => void }) {
  const { colors: c } = useTokens();
  const { t } = useI18n();
  return (
    <StepScaffold
      progress={progress}
      title={t('onb.welcome.title')}
      showBack={false}
      onNext={onNext}
      nextLabel={t('onb.welcome.start')}
    >
      <Text style={{ color: c.textSecondary, fontSize: 18, lineHeight: 28 }}>
        {t('onb.welcome.body')}
      </Text>
      <AITeacherMessage
        text={t('onb.welcome.teacher')}
        posture="supportive"
      />
    </StepScaffold>
  );
}

// ── Identity (2.2) ───────────────────────────────────────────────────────────
export function StepIdentity({ progress, answers, patchField, onNext, onBack, onSkip }: StepProps) {
  const { t } = useI18n();
  const id = answers.identity ?? {};
  return (
    <StepScaffold
      progress={progress}
      teacherLine={t('onb.identity.teacher')}
      title={t('onb.identity.title')}
      onBack={onBack}
      onSkip={onSkip}
      onNext={onNext}
    >
      <View style={{ gap: 14 }}>
        <Input label={t('onb.identity.firstName')} placeholder={t('onb.identity.firstNamePh')} value={id.firstName ?? ''} onChangeText={(v) => patchField('identity', { firstName: v })} />
        <Input label={t('onb.identity.lastName')} placeholder={t('onb.identity.lastNamePh')} value={id.lastName ?? ''} onChangeText={(v) => patchField('identity', { lastName: v })} />
        <View style={{ gap: 8 }}>
          <Label text={t('onb.identity.avatar')} />
          <SingleChoice choices={AVATARS} value={id.avatarEmoji} onChange={(v) => patchField('identity', { avatarEmoji: v })} />
        </View>
        <View style={{ gap: 8 }}>
          <Label text={t('onb.identity.age')} />
          <SingleChoice choices={AGE_BANDS} value={id.ageBand} onChange={(v) => patchField('identity', { ageBand: v, isMinor: v === 'under12' || v === '12to15' || v === '16to18' })} />
          <PrivacyNote why={t('onb.identity.ageWhy')} />
        </View>
        <Input label={t('onb.identity.country')} placeholder={t('onb.identity.countryPh')} value={id.country ?? ''} onChangeText={(v) => patchField('identity', { country: v })} />
      </View>
    </StepScaffold>
  );
}

// ── Category (2.3) ───────────────────────────────────────────────────────────
export function StepCategory({ progress, answers, patchField, onNext, onBack }: StepProps) {
  const { t } = useI18n();
  const category = answers.education?.category;
  return (
    <StepScaffold
      progress={progress}
      teacherLine={t('onb.category.teacher')}
      title={t('onb.category.title')}
      subtitle={t('onb.category.subtitle')}
      onBack={onBack}
      onNext={onNext}
      nextDisabled={!category}
    >
      <SingleChoice choices={CATEGORY_CHOICES} value={category} onChange={(v) => patchField('education', { category: v })} />
    </StepScaffold>
  );
}

// ── Academic path (2.4) ──────────────────────────────────────────────────────
export function StepAcademic({ progress, answers, patchField, onNext, onBack, onSkip }: StepProps) {
  const { t } = useI18n();
  const e = answers.education ?? {};
  return (
    <StepScaffold
      progress={progress}
      teacherLine={t('onb.academic.teacher')}
      title={t('onb.academic.title')}
      subtitle={t('onb.academic.subtitle')}
      onBack={onBack}
      onSkip={onSkip}
      onNext={onNext}
    >
      <View style={{ gap: 14 }}>
        <Input label={t('onb.academic.level')} placeholder={t('onb.academic.levelPh')} value={e.level ?? ''} onChangeText={(v) => patchField('education', { level: v })} />
        <Input label={t('onb.academic.system')} placeholder={t('onb.academic.systemPh')} value={e.system ?? ''} onChangeText={(v) => patchField('education', { system: v })} />
        <Input label={t('onb.academic.field')} placeholder={t('onb.academic.fieldPh')} value={e.field ?? ''} onChangeText={(v) => patchField('education', { field: v })} />
        <Input label={t('onb.academic.domain')} placeholder={t('onb.academic.domainPh')} value={e.domain ?? ''} onChangeText={(v) => patchField('education', { domain: v })} />
        <Input label={t('onb.academic.specialty')} placeholder={t('onb.academic.specialtyPh')} value={e.specialty ?? ''} onChangeText={(v) => patchField('education', { specialty: v })} />
        <Input label={t('onb.academic.year')} placeholder={t('onb.academic.yearPh')} value={e.year ?? ''} onChangeText={(v) => patchField('education', { year: v })} />
      </View>
    </StepScaffold>
  );
}

// ── Goals (2.5) ──────────────────────────────────────────────────────────────
export function StepGoals({ progress, answers, patch, onNext, onBack, onSkip }: StepProps) {
  const { t } = useI18n();
  const goals = (answers.goals ?? []) as string[];
  return (
    <StepScaffold
      progress={progress}
      teacherLine={t('onb.goals.teacher')}
      title={t('onb.goals.title')}
      onBack={onBack}
      onSkip={onSkip}
      onNext={onNext}
    >
      <MultiChoice choices={GOAL_CHOICES} values={goals} onChange={(v) => patch('goals', v)} />
    </StepScaffold>
  );
}

// ── Subjects (2.6) ───────────────────────────────────────────────────────────
export function StepSubjects({ progress, answers, patch, onNext, onBack, onSkip }: StepProps) {
  const { t } = useI18n();
  const subjects = (answers.subjects ?? []) as string[];
  const [custom, setCustom] = useState('');
  const preset = SUBJECT_CHOICES.map((s) => s.value);
  const extra = subjects.filter((s) => !preset.includes(s)).map((s) => ({ value: s, label: s, icon: '➕' }));
  const add = () => {
    const v = custom.trim();
    if (v && !subjects.includes(v)) patch('subjects', [...subjects, v]);
    setCustom('');
  };
  return (
    <StepScaffold
      progress={progress}
      teacherLine={t('onb.subjects.teacher')}
      title={t('onb.subjects.title')}
      onBack={onBack}
      onSkip={onSkip}
      onNext={onNext}
    >
      <MultiChoice choices={[...SUBJECT_CHOICES, ...extra]} values={subjects} onChange={(v) => patch('subjects', v)} />
      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-end', marginTop: 8 }}>
        <View style={{ flex: 1 }}>
          <Input label={t('onb.subjects.add')} placeholder={t('onb.subjects.addPh')} value={custom} onChangeText={setCustom} />
        </View>
        <Button label={t('onb.subjects.addBtn')} variant="secondary" onPress={add} />
      </View>
    </StepScaffold>
  );
}

// ── Languages (2.7) ──────────────────────────────────────────────────────────
export function StepLanguages({ progress, answers, patchField, onNext, onBack, onSkip }: StepProps) {
  const { t } = useI18n();
  const l = answers.languages ?? {};
  return (
    <StepScaffold
      progress={progress}
      teacherLine={t('onb.languages.teacher')}
      title={t('onb.languages.title')}
      onBack={onBack}
      onSkip={onSkip}
      onNext={onNext}
    >
      <View style={{ gap: 16 }}>
        <View style={{ gap: 8 }}>
          <Label text={t('onb.languages.native')} />
          <SingleChoice choices={QUICK_LANGUAGES} value={l.native} onChange={(v) => patchField('languages', { native: v })} />
        </View>
        <View style={{ gap: 8 }}>
          <Label text={t('onb.languages.interface')} />
          <SingleChoice choices={QUICK_LANGUAGES} value={l.interface} onChange={(v) => patchField('languages', { interface: v })} />
          <PrivacyNote why={t('onb.languages.interfaceWhy')} />
        </View>
        <View style={{ gap: 8 }}>
          <Label text={t('onb.languages.study')} />
          <SingleChoice choices={QUICK_LANGUAGES} value={l.study} onChange={(v) => patchField('languages', { study: v })} />
          <PrivacyNote why={t('onb.languages.studyWhy')} />
        </View>
      </View>
    </StepScaffold>
  );
}

// ── International mobility (2.7) ──────────────────────────────────────────────
export function StepMobility({ progress, answers, patchField, onNext, onBack, onSkip }: StepProps) {
  const { t } = useI18n();
  const l = answers.languages ?? {};
  const yes = l.studyingInForeignLanguage === true;
  const no = l.studyingInForeignLanguage === false;
  return (
    <StepScaffold
      progress={progress}
      title={t('onb.mobility.title')}
      subtitle={t('onb.mobility.subtitle')}
      onBack={onBack}
      onSkip={onSkip}
      onNext={onNext}
    >
      <SingleChoice
        choices={[
          { value: 'yes', label: 'onb.mobility.yes', icon: '🌍' },
          { value: 'no', label: 'onb.mobility.no', icon: '🏠' },
        ]}
        value={yes ? 'yes' : no ? 'no' : undefined}
        onChange={(v) => patchField('languages', { studyingInForeignLanguage: v === 'yes' })}
      />
      {yes ? (
        <Alert tone="info" title={t('onb.mobility.alertTitle')} detail={t('onb.mobility.alertDetail')} />
      ) : null}
    </StepScaffold>
  );
}

// ── Language-learner branch (2.8) ────────────────────────────────────────────
export function StepLanguageLearner({ progress, answers, patchField, onNext, onBack }: StepProps) {
  const { t } = useI18n();
  const ll = answers.languageLearner ?? {};
  const skills = (ll.skills ?? []) as string[];
  return (
    <StepScaffold
      progress={progress}
      teacherLine={t('onb.ll.teacher')}
      title={t('onb.ll.title')}
      onBack={onBack}
      onNext={onNext}
      nextDisabled={!ll.targetLanguage}
    >
      <View style={{ gap: 16 }}>
        <View style={{ gap: 8 }}>
          <Label text={t('onb.ll.target')} />
          <SingleChoice choices={QUICK_LANGUAGES} value={ll.targetLanguage} onChange={(v) => patchField('languageLearner', { targetLanguage: v })} />
        </View>
        <View style={{ gap: 8 }}>
          <Label text={t('onb.ll.currentLevel')} />
          <SingleChoice choices={CEFR_LEVELS} value={ll.currentLevel} onChange={(v) => patchField('languageLearner', { currentLevel: v })} />
        </View>
        <View style={{ gap: 8 }}>
          <Label text={t('onb.ll.goalLevel')} />
          <SingleChoice choices={CEFR_LEVELS} value={ll.targetLevel} onChange={(v) => patchField('languageLearner', { targetLevel: v })} />
        </View>
        <Input label={t('onb.ll.mainGoal')} placeholder={t('onb.ll.mainGoalPh')} value={ll.mainGoal ?? ''} onChangeText={(v) => patchField('languageLearner', { mainGoal: v })} />
        <View style={{ gap: 8 }}>
          <Label text={t('onb.ll.skills')} />
          <MultiChoice choices={LANGUAGE_SKILL_CHOICES} values={skills} onChange={(v) => patchField('languageLearner', { skills: v })} />
        </View>
      </View>
    </StepScaffold>
  );
}

// ── Learning preferences (2.9) ───────────────────────────────────────────────
export function StepPreferences({ progress, answers, patch, onNext, onBack, onSkip }: StepProps) {
  const { t } = useI18n();
  const prefs = (answers.preferences ?? []) as string[];
  return (
    <StepScaffold
      progress={progress}
      teacherLine={t('onb.prefs.teacher')}
      title={t('onb.prefs.title')}
      onBack={onBack}
      onSkip={onSkip}
      onNext={onNext}
    >
      <MultiChoice choices={PREFERENCE_CHOICES} values={prefs} onChange={(v) => patch('preferences', v)} />
    </StepScaffold>
  );
}

// ── AI teacher configuration (2.10) ──────────────────────────────────────────
export function StepTeacher({ progress, answers, patchField, onNext, onBack, onSkip }: StepProps) {
  const { t: tr } = useI18n();
  const t = answers.teacher ?? {};
  return (
    <StepScaffold
      progress={progress}
      teacherLine={tr('onb.teacher.teacher')}
      title={tr('onb.teacher.title')}
      onBack={onBack}
      onSkip={onSkip}
      onNext={onNext}
    >
      <View style={{ gap: 18 }}>
        <Field label={tr('onb.teacher.tone')}>
          <SingleChoice choices={TONE_CHOICES} value={t.tone} onChange={(v) => patchField('teacher', { tone: v })} />
        </Field>
        <Field label={tr('onb.teacher.explanations')}>
          <SingleChoice choices={EXPLANATION_CHOICES} value={t.explanations} onChange={(v) => patchField('teacher', { explanations: v })} />
        </Field>
        <Field label={tr('onb.teacher.intervention')}>
          <SingleChoice choices={INTERVENTION_CHOICES} value={t.intervention} onChange={(v) => patchField('teacher', { intervention: v })} />
        </Field>
        <Field label={tr('onb.teacher.correction')}>
          <SingleChoice choices={CORRECTION_CHOICES} value={t.correction} onChange={(v) => patchField('teacher', { correction: v })} />
        </Field>
      </View>
    </StepScaffold>
  );
}

// ── Academic assistance (2.11) ───────────────────────────────────────────────
export function StepAcademicSupport({ progress, answers, patch, onNext, onBack, onSkip }: StepProps) {
  const { t } = useI18n();
  const sup = (answers.academicSupport ?? []) as string[];
  return (
    <StepScaffold
      progress={progress}
      teacherLine={t('onb.support.teacher')}
      title={t('onb.support.title')}
      onBack={onBack}
      onSkip={onSkip}
      onNext={onNext}
    >
      <MultiChoice choices={ACADEMIC_SUPPORT_CHOICES} values={sup} onChange={(v) => patch('academicSupport', v)} />
    </StepScaffold>
  );
}

// ── Initial assessment (2.12) ────────────────────────────────────────────────
export function StepAssessment({ progress, answers, patch, onNext, onBack, onSkip }: StepProps) {
  const { colors: c } = useTokens();
  const { t } = useI18n();
  const subjects = (answers.subjects ?? []) as string[];
  const stored = answers.assessment ?? {};
  const [subject, setSubject] = useState<string>(stored.subject ?? subjects[0] ?? '');
  const [items, setItems] = useState<KycAssessmentItem[]>(stored.items ?? []);
  const [aiGenerated, setAiGenerated] = useState<boolean | null>(stored.items?.length ? true : null);
  const [running, setRunning] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const run = async () => {
    if (!subject) return;
    setRunning(true);
    setErr(null);
    try {
      const res = await api<GenerateAssessmentResponse>('/onboarding/assessment', {
        method: 'POST',
        body: { subject, count: 3 },
      });
      setAiGenerated(res.aiGenerated);
      const next: KycAssessmentItem[] = res.aiGenerated
        ? res.items.map((it) => ({ concept: it.concept, question: it.question }))
        : [{ concept: subject }];
      setItems(next);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setRunning(false);
    }
  };

  const rate = (i: number, level: KycMasteryLevel) => {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, level } : it)));
  };
  const answer = (i: number, text: string) => {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, answer: text } : it)));
  };

  const save = () => {
    patch('assessment', { subject, items, taken: true });
    onNext();
  };

  return (
    <StepScaffold
      progress={progress}
      teacherLine={t('onb.assess.teacher')}
      title={t('onb.assess.title')}
      onBack={onBack}
      onSkip={onSkip}
      onNext={items.length ? save : undefined}
      nextLabel={t('onb.assess.save')}
    >
      {subjects.length === 0 ? (
        <Alert tone="info" title={t('onb.assess.noSubjectTitle')} detail={t('onb.assess.noSubjectDetail')} />
      ) : (
        <View style={{ gap: 14 }}>
          <View style={{ gap: 8 }}>
            <Label text={t('onb.assess.whichSubject')} />
            <SingleChoice choices={subjects.map((s) => ({ value: s, label: s }))} value={subject} onChange={setSubject} />
          </View>
          {items.length === 0 ? (
            <Button label={running ? t('onb.assess.preparing') : t('onb.assess.run')} onPress={run} disabled={running || !subject} />
          ) : null}
          {err ? <Alert tone="warning" title={t('onb.assess.unavailableTitle')} detail={t('onb.assess.unavailableDetail')} /> : null}
          {aiGenerated === false && items.length ? (
            <Text style={{ color: c.textSecondary, fontSize: 14 }}>{t('onb.assess.selfRate')} « {subject} » :</Text>
          ) : null}
          {items.map((it, i) => (
            <Card key={`${it.concept}-${i}`}>
              <Text style={{ color: c.textPrimary, fontSize: 15, fontWeight: '700', marginBottom: 6 }}>{it.concept}</Text>
              {it.question ? (
                <>
                  <Text style={{ color: c.textSecondary, fontSize: 14, marginBottom: 8 }}>{it.question}</Text>
                  <Input placeholder={t('onb.assess.answerPh')} value={it.answer ?? ''} onChangeText={(v) => answer(i, v)} />
                  <View style={{ height: 10 }} />
                </>
              ) : null}
              <SingleChoice choices={SELF_RATING} value={it.level} onChange={(v) => rate(i, v)} />
            </Card>
          ))}
        </View>
      )}
    </StepScaffold>
  );
}

// ── Digital Twin summary (2.13) ──────────────────────────────────────────────
export function StepTwin({
  progress,
  answers,
  onNext,
  onBack,
  onEdit,
}: StepProps & { onEdit: (step: OnboardingStep) => void }) {
  const { colors: c } = useTokens();
  const { t: tr } = useI18n();
  const id = answers.identity ?? {};
  const l = answers.languages ?? {};
  const ll = answers.languageLearner ?? {};
  const name = [id.firstName, id.lastName].filter(Boolean).join(' ') || 'toi';
  // Catalog labels are i18n keys; tr() resolves them (and passes raw values through).
  const goalsLabels = (answers.goals ?? []).map((g) =>
    tr((GOAL_CHOICES.find((x) => x.value === g)?.label ?? g) as TranslationKey),
  );
  const subjects = (answers.subjects ?? []) as string[];
  const t = answers.teacher ?? {};
  const teacherBits = [
    TONE_CHOICES.find((x) => x.value === t.tone)?.label,
    EXPLANATION_CHOICES.find((x) => x.value === t.explanations)?.label,
    INTERVENTION_CHOICES.find((x) => x.value === t.intervention)?.label,
  ]
    .filter((k): k is string => Boolean(k))
    .map((k) => tr(k as TranslationKey));

  return (
    <StepScaffold
      progress={progress}
      title={tr('onb.twin.title')}
      subtitle={tr('onb.twin.subtitle')}
      onBack={onBack}
      onNext={onNext}
      nextLabel={tr('onb.twin.confirm')}
    >
      <View style={{ gap: 12 }}>
        <TwinRow icon="🎓" title={tr('onb.twin.profile')} value={`${tr(categoryLabel(answers.education?.category) as TranslationKey)}${answers.education?.field ? ' — ' + answers.education.field : ''}`} onEdit={() => onEdit('category')} />
        <TwinRow
          icon="🌍"
          title={tr('onb.twin.langs')}
          value={
            answers.education?.category === 'language'
              ? `${tr('onb.twin.target')} : ${ll.targetLanguage ?? '—'}${ll.currentLevel ? ' (' + ll.currentLevel + ')' : ''}`
              : `${l.native ?? '—'} → ${tr('onb.twin.native')}${l.study ? `, ${l.study} → ${tr('onb.twin.study')}` : ''}`
          }
          onEdit={() => onEdit(answers.education?.category === 'language' ? 'language_learner' : 'languages')}
        />
        <TwinRow icon="🎯" title={tr('onb.twin.goals')} value={goalsLabels.join(' · ') || '—'} onEdit={() => onEdit('goals')} />
        <TwinRow icon="📚" title={tr('onb.twin.subjects')} value={subjects.join(' · ') || '—'} onEdit={() => onEdit('subjects')} />
        <TwinRow icon="👨‍🏫" title={tr('onb.twin.prof')} value={teacherBits.join(' · ') || tr('onb.twin.toAdapt')} onEdit={() => onEdit('teacher')} />
      </View>
      <Text style={{ color: c.textMuted, fontSize: 12, marginTop: 6 }}>{tr('onb.twin.hi')} {name} — {tr('onb.twin.almost')}</Text>
    </StepScaffold>
  );
}

// ── AI adaptation preview (2.14) ─────────────────────────────────────────────
export function StepAdaptation({
  progress,
  answers,
  onBack,
  onEnter,
  entering,
}: {
  progress: number;
  answers: OnboardingAnswers;
  onBack: () => void;
  onEnter: () => void;
  entering?: boolean;
}) {
  const { colors: c } = useTokens();
  const { t: tr } = useI18n();
  const t = answers.teacher ?? {};
  const toneLabel = tr((TONE_CHOICES.find((x) => x.value === t.tone)?.label ?? 'onb.tone.balanced') as TranslationKey);
  const promises = [
    tr('onb.adapt.p1'),
    tr('onb.adapt.p2'),
    tr('onb.adapt.p3'),
    tr('onb.adapt.p4'),
    tr('onb.adapt.p5'),
    tr('onb.adapt.p6'),
  ];
  return (
    <StepScaffold
      progress={progress}
      title={tr('onb.adapt.title')}
      onBack={onBack}
      onNext={onEnter}
      nextLabel={entering ? tr('onb.adapt.preparing') : tr('onb.adapt.enter')}
      saving={entering}
    >
      <AIRecommendation title={`${tr('onb.twin.prof')} — ${toneLabel.toLowerCase()}`} body={tr('onb.adapt.willBody')} />
      <View style={{ gap: 8, marginTop: 8 }}>
        {promises.map((p) => (
          <View key={p} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
            <Text style={{ color: c.aiAccent }}>•</Text>
            <Text style={{ color: c.textSecondary, fontSize: 15, flex: 1, lineHeight: 22 }}>{p}</Text>
          </View>
        ))}
      </View>
    </StepScaffold>
  );
}

// ── small helpers ────────────────────────────────────────────────────────────
function Label({ text }: { text: string }) {
  const { colors: c } = useTokens();
  return <Text style={{ color: c.textSecondary, fontSize: 13, fontWeight: '700' }}>{text}</Text>;
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <Label text={label} />
      {children}
    </View>
  );
}
function TwinRow({ icon, title, value, onEdit }: { icon: string; title: string; value: string; onEdit: () => void }) {
  const { colors: c } = useTokens();
  const { t } = useI18n();
  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Text style={{ fontSize: 22 }}>{icon}</Text>
        <View style={{ flex: 1 }}>
          <Text style={{ color: c.textMuted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 }}>{title}</Text>
          <Text style={{ color: c.textPrimary, fontSize: 15 }}>{value}</Text>
        </View>
        <Pressable onPress={onEdit} accessibilityRole="button" accessibilityLabel={`${t('onb.edit')} ${title}`}>
          <Text style={{ color: c.aiAccent, fontSize: 14, fontWeight: '700' }}>{t('onb.edit')}</Text>
        </Pressable>
      </View>
    </Card>
  );
}

// The completion side-effect summary, shown briefly on the way in (optional use).
export function ConfigurationSummary({ config }: { config: SystemConfiguration }) {
  const { colors: c } = useTokens();
  const { t } = useI18n();
  const a = config.applied;
  return (
    <Card>
      <Text style={{ color: c.textPrimary, fontWeight: '700', marginBottom: 6 }}>{t('onb.cfg.title')}</Text>
      <Text style={{ color: c.textSecondary, fontSize: 13 }}>
        {a.profileUpdated ? `✓ ${t('onb.cfg.profileUpdated')}  ` : ''}
        {a.languageProfileCreated ? `✓ ${t('onb.cfg.langCreated')}  ` : ''}
        {a.conceptsCreated > 0 ? `✓ ${a.conceptsCreated} ${t('onb.cfg.concepts')}` : ''}
      </Text>
    </Card>
  );
}
