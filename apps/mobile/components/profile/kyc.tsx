import { useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { KycEducation, LearningCategory } from '@second-brain/shared';
import { useTokens } from '../../lib/design/theme';
import { Badge, Card, Input } from '../ds/core';

/**
 * Profil & KYC — universal identity + academic path + goals (UI/UX Sprint 7
 * unified). Reusable, prop-driven; edits are saved to the KYC (OnboardingProfile)
 * by the hub, which propagates to the twin + teacher. French.
 */

function Section({ title, children }: { title: string; children: ReactNode }) {
  const { colors: c } = useTokens();
  return (
    <Card style={{ gap: 12 }}>
      <Text style={{ color: c.textPrimary, fontSize: 16, fontWeight: '800' }}>{title}</Text>
      {children}
    </Card>
  );
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  const { colors: c } = useTokens();
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: c.textSecondary, fontSize: 13, fontWeight: '700' }}>{label}</Text>
      {children}
    </View>
  );
}

// ── Learner category (full universal list) ───────────────────────────────────
export const CATEGORY_CHOICES: { value: LearningCategory; label: string; icon: string }[] = [
  { value: 'kindergarten', label: 'Enfant / Maternelle', icon: '🧒' },
  { value: 'primary', label: 'Primaire', icon: '📚' },
  { value: 'highschool', label: 'Lycée', icon: '🎓' },
  { value: 'university', label: 'Étudiant supérieur', icon: '🏛️' },
  { value: 'research', label: 'Chercheur', icon: '🔬' },
  { value: 'professional', label: 'Adulte', icon: '💼' },
  { value: 'language', label: 'Apprenant de langue', icon: '🌍' },
];

// ── Identity: prénom, nom, date de naissance, catégorie ──────────────────────
export function IdentityFull({
  firstName,
  lastName,
  birthDate,
  category,
  onFirst,
  onLast,
  onBirth,
  onCategory,
}: {
  firstName: string;
  lastName: string;
  birthDate: string;
  category?: LearningCategory | null;
  onFirst: (v: string) => void;
  onLast: (v: string) => void;
  onBirth: (v: string) => void;
  onCategory: (v: LearningCategory) => void;
}) {
  const { colors: c, radius } = useTokens();
  return (
    <Section title="Mon identité">
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}><Field label="Prénom"><Input placeholder="Prénom" value={firstName} onChangeText={onFirst} /></Field></View>
        <View style={{ flex: 1 }}><Field label="Nom"><Input placeholder="Nom" value={lastName} onChangeText={onLast} /></Field></View>
      </View>
      <Field label="Date de naissance"><Input placeholder="JJ/MM/AAAA" value={birthDate} onChangeText={onBirth} /></Field>
      <Field label="Catégorie d’apprenant">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {CATEGORY_CHOICES.map((ch) => {
            const on = ch.value === category;
            return (
              <Pressable key={ch.value} onPress={() => onCategory(ch.value)} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={ch.label}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1.5, borderColor: on ? c.aiAccent : c.border, backgroundColor: on ? c.aiAccentSoft : c.surface, borderRadius: radius.md, paddingVertical: 8, paddingHorizontal: 12, minHeight: 40 }}>
                <Text style={{ fontSize: 15 }}>{ch.icon}</Text>
                <Text style={{ color: on ? c.aiAccent : c.textPrimary, fontSize: 13, fontWeight: on ? '700' : '500' }}>{ch.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </Field>
    </Section>
  );
}

// ── Full academic path: Niveau → Cursus → Établissement → Faculté → Domaine →
//    Spécialité → Option (task 1.2) ──────────────────────────────────────────
type PathKey = keyof Pick<KycEducation, 'level' | 'field' | 'system' | 'domain' | 'specialty'> | 'faculty' | 'option';
export function AcademicPathCard({
  education,
  onChange,
}: {
  education: KycEducation & { faculty?: string; option?: string };
  onChange: (key: PathKey, value: string) => void;
}) {
  const rows: { key: PathKey; label: string; ph: string; value?: string }[] = [
    { key: 'level', label: 'Niveau', ph: 'Ex. Université — Licence 3', value: education.level },
    { key: 'field', label: 'Cursus', ph: 'Ex. Informatique', value: education.field },
    { key: 'system', label: 'Établissement', ph: 'Ex. Université de Paris', value: education.system },
    { key: 'faculty', label: 'Faculté', ph: 'Ex. Sciences', value: education.faculty },
    { key: 'domain', label: 'Domaine', ph: 'Ex. Génie logiciel', value: education.domain },
    { key: 'specialty', label: 'Spécialité', ph: 'Ex. Systèmes distribués', value: education.specialty },
    { key: 'option', label: 'Option', ph: 'Ex. Cloud', value: education.option },
  ];
  return (
    <Section title="Parcours académique">
      {rows.map((r) => (
        <Field key={r.key} label={r.label}>
          <Input placeholder={r.ph} value={r.value ?? ''} onChangeText={(v) => onChange(r.key, v)} />
        </Field>
      ))}
    </Section>
  );
}

// ── Objectifs de réussite (task 1.4) ─────────────────────────────────────────
export const GOAL_CHOICES: { value: string; label: string; icon: string }[] = [
  { value: 'diploma', label: 'Diplôme', icon: '🎓' },
  { value: 'exams', label: 'Examen', icon: '🎯' },
  { value: 'skills', label: 'Compétences', icon: '🚀' },
  { value: 'research', label: 'Recherche', icon: '🔬' },
  { value: 'contest', label: 'Concours', icon: '🏆' },
  { value: 'language', label: 'Langue', icon: '🌍' },
];
export function GoalsCard({ goals, onToggle }: { goals: string[]; onToggle: (v: string[]) => void }) {
  const { colors: c, radius } = useTokens();
  const toggle = (v: string) => onToggle(goals.includes(v) ? goals.filter((g) => g !== v) : [...goals, v]);
  return (
    <Section title="Objectifs de réussite">
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {GOAL_CHOICES.map((g) => {
          const on = goals.includes(g.value);
          return (
            <Pressable key={g.value} onPress={() => toggle(g.value)} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={g.label}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1.5, borderColor: on ? c.aiAccent : c.border, backgroundColor: on ? c.aiAccentSoft : c.surface, borderRadius: radius.md, paddingVertical: 8, paddingHorizontal: 12, minHeight: 40 }}>
              <Text style={{ fontSize: 15 }}>{g.icon}</Text>
              <Text style={{ color: on ? c.aiAccent : c.textPrimary, fontSize: 13, fontWeight: on ? '700' : '500' }}>{g.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={{ color: c.textMuted, fontSize: 12 }}>Ces cibles alimentent Réviser, le Professeur IA et ton Digital Twin.</Text>
    </Section>
  );
}

// ── Langues apprises (task 1.3, "autres langues") ────────────────────────────
export function LearnedLanguages({ languages, onChange }: { languages: string[]; onChange: (v: string[]) => void }) {
  const { colors: c } = useTokens();
  const [draft, setDraft] = useState('');
  const add = () => { const v = draft.trim(); if (v && !languages.includes(v)) onChange([...languages, v]); setDraft(''); };
  return (
    <Field label="Langues apprises">
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
        {languages.length === 0 ? <Text style={{ color: c.textMuted, fontSize: 13 }}>Aucune pour l’instant.</Text> : languages.map((l) => (
          <Pressable key={l} onPress={() => onChange(languages.filter((x) => x !== l))} accessibilityLabel={`Retirer ${l}`}>
            <Badge label={`${l}  ✕`} tone="primary" />
          </Pressable>
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
        <View style={{ flex: 1 }}><Input placeholder="Ajouter une langue" value={draft} onChangeText={setDraft} onSubmitEditing={add} returnKeyType="done" /></View>
      </View>
    </Field>
  );
}
