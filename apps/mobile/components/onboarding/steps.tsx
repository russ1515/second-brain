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
  return (
    <StepScaffold
      progress={progress}
      title="Bienvenue dans Second Brain."
      showBack={false}
      onNext={onNext}
      nextLabel="Commencer"
    >
      <Text style={{ color: c.textSecondary, fontSize: 18, lineHeight: 28 }}>
        Construisons ton espace d’apprentissage selon ta manière d’apprendre.
      </Text>
      <AITeacherMessage
        text="Je vais apprendre à te connaître pour adapter ton professeur IA à ton niveau, tes objectifs et ta façon d’apprendre."
        posture="supportive"
      />
    </StepScaffold>
  );
}

// ── Identity (2.2) ───────────────────────────────────────────────────────────
export function StepIdentity({ progress, answers, patchField, onNext, onBack, onSkip }: StepProps) {
  const id = answers.identity ?? {};
  return (
    <StepScaffold
      progress={progress}
      teacherLine="Faisons connaissance — le minimum, rien de plus."
      title="Qui es-tu ?"
      onBack={onBack}
      onSkip={onSkip}
      onNext={onNext}
    >
      <View style={{ gap: 14 }}>
        <Input label="Prénom" placeholder="Ton prénom" value={id.firstName ?? ''} onChangeText={(v) => patchField('identity', { firstName: v })} />
        <Input label="Nom (facultatif)" placeholder="Ton nom" value={id.lastName ?? ''} onChangeText={(v) => patchField('identity', { lastName: v })} />
        <View style={{ gap: 8 }}>
          <Label text="Avatar (facultatif)" />
          <SingleChoice choices={AVATARS} value={id.avatarEmoji} onChange={(v) => patchField('identity', { avatarEmoji: v })} />
        </View>
        <View style={{ gap: 8 }}>
          <Label text="Tranche d’âge" />
          <SingleChoice choices={AGE_BANDS} value={id.ageBand} onChange={(v) => patchField('identity', { ageBand: v, isMinor: v === 'under12' || v === '12to15' || v === '16to18' })} />
          <PrivacyNote why="La tranche d’âge sert uniquement à adapter le ton et la présentation. Aucune date de naissance n’est demandée, et l’expérience des plus jeunes reste protégée." />
        </View>
        <Input label="Pays / région (facultatif)" placeholder="Ex. France" value={id.country ?? ''} onChangeText={(v) => patchField('identity', { country: v })} />
      </View>
    </StepScaffold>
  );
}

// ── Category (2.3) ───────────────────────────────────────────────────────────
export function StepCategory({ progress, answers, patchField, onNext, onBack }: StepProps) {
  const category = answers.education?.category;
  return (
    <StepScaffold
      progress={progress}
      teacherLine="Ça m’aide à comprendre où tu en es dans ton parcours."
      title="Où en es-tu ?"
      subtitle="Choisis ce qui te ressemble le plus."
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
  const e = answers.education ?? {};
  return (
    <StepScaffold
      progress={progress}
      teacherLine="Décris ton cursus — choisis, cherche ou saisis librement."
      title="Ton cursus"
      subtitle="Rien n’est imposé : remplis ce qui s’applique à toi."
      onBack={onBack}
      onSkip={onSkip}
      onNext={onNext}
    >
      <View style={{ gap: 14 }}>
        <Input label="Niveau" placeholder="Ex. Université" value={e.level ?? ''} onChangeText={(v) => patchField('education', { level: v })} />
        <Input label="Pays / système éducatif" placeholder="Ex. France — LMD" value={e.system ?? ''} onChangeText={(v) => patchField('education', { system: v })} />
        <Input label="Filière" placeholder="Ex. Informatique" value={e.field ?? ''} onChangeText={(v) => patchField('education', { field: v })} />
        <Input label="Domaine" placeholder="Ex. Génie logiciel" value={e.domain ?? ''} onChangeText={(v) => patchField('education', { domain: v })} />
        <Input label="Spécialité (facultatif)" placeholder="Ex. Systèmes distribués" value={e.specialty ?? ''} onChangeText={(v) => patchField('education', { specialty: v })} />
        <Input label="Année / niveau" placeholder="Ex. Licence 3" value={e.year ?? ''} onChangeText={(v) => patchField('education', { year: v })} />
      </View>
    </StepScaffold>
  );
}

// ── Goals (2.5) ──────────────────────────────────────────────────────────────
export function StepGoals({ progress, answers, patch, onNext, onBack, onSkip }: StepProps) {
  const goals = (answers.goals ?? []) as string[];
  return (
    <StepScaffold
      progress={progress}
      teacherLine="Dis-moi pourquoi tu es là — tu peux en choisir plusieurs."
      title="Pourquoi utilises-tu Second Brain ?"
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
      teacherLine="Ces matières nourriront ta mémoire, ton graphe de connaissances et ton planning."
      title="Tes matières"
      onBack={onBack}
      onSkip={onSkip}
      onNext={onNext}
    >
      <MultiChoice choices={[...SUBJECT_CHOICES, ...extra]} values={subjects} onChange={(v) => patch('subjects', v)} />
      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-end', marginTop: 8 }}>
        <View style={{ flex: 1 }}>
          <Input label="Ajouter une matière" placeholder="Ex. Astrophysique" value={custom} onChangeText={setCustom} />
        </View>
        <Button label="Ajouter" variant="secondary" onPress={add} />
      </View>
    </StepScaffold>
  );
}

// ── Languages (2.7) ──────────────────────────────────────────────────────────
export function StepLanguages({ progress, answers, patchField, onNext, onBack, onSkip }: StepProps) {
  const l = answers.languages ?? {};
  return (
    <StepScaffold
      progress={progress}
      teacherLine="La langue façonne mes explications et le support que je peux t’offrir."
      title="Tes langues"
      onBack={onBack}
      onSkip={onSkip}
      onNext={onNext}
    >
      <View style={{ gap: 16 }}>
        <View style={{ gap: 8 }}>
          <Label text="Langue maternelle" />
          <SingleChoice choices={QUICK_LANGUAGES} value={l.native} onChange={(v) => patchField('languages', { native: v })} />
        </View>
        <View style={{ gap: 8 }}>
          <Label text="Langue de l’interface" />
          <SingleChoice choices={QUICK_LANGUAGES} value={l.interface} onChange={(v) => patchField('languages', { interface: v })} />
          <PrivacyNote why="La langue de l’interface change l’affichage et la langue dans laquelle le Professeur IA t’enseigne." />
        </View>
        <View style={{ gap: 8 }}>
          <Label text="Langue d’étude (facultatif)" />
          <SingleChoice choices={QUICK_LANGUAGES} value={l.study} onChange={(v) => patchField('languages', { study: v })} />
          <PrivacyNote why="Si tu étudies dans une autre langue que ta langue maternelle, j’active un support bilingue et du vocabulaire académique." />
        </View>
      </View>
    </StepScaffold>
  );
}

// ── International mobility (2.7) ──────────────────────────────────────────────
export function StepMobility({ progress, answers, patchField, onNext, onBack, onSkip }: StepProps) {
  const l = answers.languages ?? {};
  const yes = l.studyingInForeignLanguage === true;
  const no = l.studyingInForeignLanguage === false;
  return (
    <StepScaffold
      progress={progress}
      title="Mobilité internationale"
      subtitle="Étudies-tu actuellement dans une langue différente de ta langue maternelle ?"
      onBack={onBack}
      onSkip={onSkip}
      onNext={onNext}
    >
      <SingleChoice
        choices={[
          { value: 'yes', label: 'Oui', icon: '🌍' },
          { value: 'no', label: 'Non', icon: '🏠' },
        ]}
        value={yes ? 'yes' : no ? 'no' : undefined}
        onChange={(v) => patchField('languages', { studyingInForeignLanguage: v === 'yes' })}
      />
      {yes ? (
        <Alert tone="info" title="Support linguistique activé" detail="Traduction contextuelle, vocabulaire académique, explication bilingue et immersion progressive." />
      ) : null}
    </StepScaffold>
  );
}

// ── Language-learner branch (2.8) ────────────────────────────────────────────
export function StepLanguageLearner({ progress, answers, patchField, onNext, onBack }: StepProps) {
  const ll = answers.languageLearner ?? {};
  const skills = (ll.skills ?? []) as string[];
  return (
    <StepScaffold
      progress={progress}
      teacherLine="Construisons ton parcours linguistique sur mesure."
      title="Apprendre une langue"
      onBack={onBack}
      onNext={onNext}
      nextDisabled={!ll.targetLanguage}
    >
      <View style={{ gap: 16 }}>
        <View style={{ gap: 8 }}>
          <Label text="Je veux apprendre" />
          <SingleChoice choices={QUICK_LANGUAGES} value={ll.targetLanguage} onChange={(v) => patchField('languageLearner', { targetLanguage: v })} />
        </View>
        <View style={{ gap: 8 }}>
          <Label text="Niveau actuel" />
          <SingleChoice choices={CEFR_LEVELS} value={ll.currentLevel} onChange={(v) => patchField('languageLearner', { currentLevel: v })} />
        </View>
        <View style={{ gap: 8 }}>
          <Label text="Objectif" />
          <SingleChoice choices={CEFR_LEVELS} value={ll.targetLevel} onChange={(v) => patchField('languageLearner', { targetLevel: v })} />
        </View>
        <Input label="Objectif principal" placeholder="Ex. Conversation" value={ll.mainGoal ?? ''} onChangeText={(v) => patchField('languageLearner', { mainGoal: v })} />
        <View style={{ gap: 8 }}>
          <Label text="Ce que tu veux travailler" />
          <MultiChoice choices={LANGUAGE_SKILL_CHOICES} values={skills} onChange={(v) => patchField('languageLearner', { skills: v })} />
        </View>
      </View>
    </StepScaffold>
  );
}

// ── Learning preferences (2.9) ───────────────────────────────────────────────
export function StepPreferences({ progress, answers, patch, onNext, onBack, onSkip }: StepProps) {
  const prefs = (answers.preferences ?? []) as string[];
  return (
    <StepScaffold
      progress={progress}
      teacherLine="Des préférences, pas un diagnostic. Tu pourras les changer à tout moment."
      title="Comment préfères-tu apprendre ?"
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
  const t = answers.teacher ?? {};
  return (
    <StepScaffold
      progress={progress}
      teacherLine="Configure-moi. Je m’adapterai ensuite selon tes résultats."
      title="Ton professeur IA"
      onBack={onBack}
      onSkip={onSkip}
      onNext={onNext}
    >
      <View style={{ gap: 18 }}>
        <Field label="Ton">
          <SingleChoice choices={TONE_CHOICES} value={t.tone} onChange={(v) => patchField('teacher', { tone: v })} />
        </Field>
        <Field label="Explications">
          <SingleChoice choices={EXPLANATION_CHOICES} value={t.explanations} onChange={(v) => patchField('teacher', { explanations: v })} />
        </Field>
        <Field label="Intervention">
          <SingleChoice choices={INTERVENTION_CHOICES} value={t.intervention} onChange={(v) => patchField('teacher', { intervention: v })} />
        </Field>
        <Field label="Correction">
          <SingleChoice choices={CORRECTION_CHOICES} value={t.correction} onChange={(v) => patchField('teacher', { correction: v })} />
        </Field>
      </View>
    </StepScaffold>
  );
}

// ── Academic assistance (2.11) ───────────────────────────────────────────────
export function StepAcademicSupport({ progress, answers, patch, onNext, onBack, onSkip }: StepProps) {
  const sup = (answers.academicSupport ?? []) as string[];
  return (
    <StepScaffold
      progress={progress}
      teacherLine="TP, devoirs, rapports, projets, mémoires — comment veux-tu que je t’accompagne ?"
      title="Aide académique"
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
      teacherLine="Voyons rapidement ce que tu maîtrises déjà — quelques questions, pas un examen."
      title="Petit diagnostic"
      onBack={onBack}
      onSkip={onSkip}
      onNext={items.length ? save : undefined}
      nextLabel="Enregistrer"
    >
      {subjects.length === 0 ? (
        <Alert tone="info" title="Aucune matière sélectionnée" detail="Ajoute une matière à l’étape précédente pour lancer un diagnostic, ou passe cette étape." />
      ) : (
        <View style={{ gap: 14 }}>
          <View style={{ gap: 8 }}>
            <Label text="Sur quelle matière ?" />
            <SingleChoice choices={subjects.map((s) => ({ value: s, label: s }))} value={subject} onChange={setSubject} />
          </View>
          {items.length === 0 ? (
            <Button label={running ? 'Préparation…' : 'Lancer le diagnostic'} onPress={run} disabled={running || !subject} />
          ) : null}
          {err ? <Alert tone="warning" title="Diagnostic indisponible" detail="Tu peux auto-évaluer ton niveau ci-dessous." /> : null}
          {aiGenerated === false && items.length ? (
            <Text style={{ color: c.textSecondary, fontSize: 14 }}>Auto-évalue ton niveau sur « {subject} » :</Text>
          ) : null}
          {items.map((it, i) => (
            <Card key={`${it.concept}-${i}`}>
              <Text style={{ color: c.textPrimary, fontSize: 15, fontWeight: '700', marginBottom: 6 }}>{it.concept}</Text>
              {it.question ? (
                <>
                  <Text style={{ color: c.textSecondary, fontSize: 14, marginBottom: 8 }}>{it.question}</Text>
                  <Input placeholder="Ta réponse (facultatif)" value={it.answer ?? ''} onChangeText={(v) => answer(i, v)} />
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
  const id = answers.identity ?? {};
  const l = answers.languages ?? {};
  const ll = answers.languageLearner ?? {};
  const name = [id.firstName, id.lastName].filter(Boolean).join(' ') || 'toi';
  const goalsLabels = (answers.goals ?? []).map((g) => GOAL_CHOICES.find((x) => x.value === g)?.label ?? g);
  const subjects = (answers.subjects ?? []) as string[];
  const t = answers.teacher ?? {};
  const teacherBits = [
    TONE_CHOICES.find((x) => x.value === t.tone)?.label,
    EXPLANATION_CHOICES.find((x) => x.value === t.explanations)?.label,
    INTERVENTION_CHOICES.find((x) => x.value === t.intervention)?.label,
  ].filter(Boolean);

  return (
    <StepScaffold
      progress={progress}
      title="Voici ce que j’ai compris de toi"
      subtitle="Tu peux corriger tout de suite ce que Second Brain a compris."
      onBack={onBack}
      onNext={onNext}
      nextLabel="C’est juste"
    >
      <View style={{ gap: 12 }}>
        <TwinRow icon="🎓" title="Profil" value={`${categoryLabel(answers.education?.category)}${answers.education?.field ? ' — ' + answers.education.field : ''}`} onEdit={() => onEdit('category')} />
        <TwinRow
          icon="🌍"
          title="Langues"
          value={
            answers.education?.category === 'language'
              ? `Cible : ${ll.targetLanguage ?? '—'}${ll.currentLevel ? ' (' + ll.currentLevel + ')' : ''}`
              : `${l.native ?? '—'} → langue native${l.study ? `, ${l.study} → étude` : ''}`
          }
          onEdit={() => onEdit(answers.education?.category === 'language' ? 'language_learner' : 'languages')}
        />
        <TwinRow icon="🎯" title="Objectifs" value={goalsLabels.join(' · ') || '—'} onEdit={() => onEdit('goals')} />
        <TwinRow icon="📚" title="Matières" value={subjects.join(' · ') || '—'} onEdit={() => onEdit('subjects')} />
        <TwinRow icon="👨‍🏫" title="Professeur" value={teacherBits.join(' · ') || 'À adapter'} onEdit={() => onEdit('teacher')} />
      </View>
      <Text style={{ color: c.textMuted, fontSize: 12, marginTop: 6 }}>Bonjour {name} — on y est presque.</Text>
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
  const t = answers.teacher ?? {};
  const toneLabel = TONE_CHOICES.find((x) => x.value === t.tone)?.label ?? 'équilibré';
  const promises = [
    'adapter mes explications à ton niveau',
    'détecter tes difficultés',
    'te faire pratiquer',
    'planifier tes révisions',
    'utiliser tes documents',
    't’aider dans tes travaux',
  ];
  return (
    <StepScaffold
      progress={progress}
      title="Voilà comment ton Professeur IA va fonctionner"
      onBack={onBack}
      onNext={onEnter}
      nextLabel={entering ? 'Préparation…' : 'Entrer dans Second Brain'}
      saving={entering}
    >
      <AIRecommendation title={`Ton professeur — ton ${toneLabel.toLowerCase()}`} body="Je vais :" />
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
  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Text style={{ fontSize: 22 }}>{icon}</Text>
        <View style={{ flex: 1 }}>
          <Text style={{ color: c.textMuted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 }}>{title}</Text>
          <Text style={{ color: c.textPrimary, fontSize: 15 }}>{value}</Text>
        </View>
        <Pressable onPress={onEdit} accessibilityRole="button" accessibilityLabel={`Modifier ${title}`}>
          <Text style={{ color: c.aiAccent, fontSize: 14, fontWeight: '700' }}>Modifier</Text>
        </Pressable>
      </View>
    </Card>
  );
}

// The completion side-effect summary, shown briefly on the way in (optional use).
export function ConfigurationSummary({ config }: { config: SystemConfiguration }) {
  const { colors: c } = useTokens();
  const a = config.applied;
  return (
    <Card>
      <Text style={{ color: c.textPrimary, fontWeight: '700', marginBottom: 6 }}>Configuration appliquée</Text>
      <Text style={{ color: c.textSecondary, fontSize: 13 }}>
        {a.profileUpdated ? '✓ Profil mis à jour  ' : ''}
        {a.languageProfileCreated ? '✓ Profil de langue créé  ' : ''}
        {a.conceptsCreated > 0 ? `✓ ${a.conceptsCreated} concepts initiaux` : ''}
      </Text>
    </Card>
  );
}
