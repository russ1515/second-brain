import { useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTokens } from '../../lib/design/theme';
import { Badge, Button, Card, Input, Progress, SegmentedControl } from '../ds/core';
import { AITeacherMessage, PostureBadge, type Posture } from '../ds/ai';
import { LessonStep } from '../ds/learning';
import { BilingualText, TranslationHint } from '../ds/language';
import type { Capability, StartEntry, TeachingMode } from '../../lib/learn/catalog';

/**
 * Apprendre component library (UI/UX Sprint 4, task 18).
 *
 * Reusable, PROP-DRIVEN presentational components built on the Sprint 1 design
 * system — the visual vocabulary of the learning workspace. They route into the
 * existing engines; none of them owns business logic. Reusable, not coded per
 * screen: the hub and the playground both compose the same pieces.
 */

// ── Capability card (the 6 capabilities of Apprendre) ────────────────────────
export function CapabilityCard({ capability, onOpen }: { capability: Capability; onOpen: () => void }) {
  const { colors: c, radius } = useTokens();
  return (
    <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel={capability.title}>
      <Card style={{ gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 44, height: 44, borderRadius: radius.md, backgroundColor: c.aiAccentSoft, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 22 }}>{capability.icon}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: c.textPrimary, fontSize: 16, fontWeight: '700' }}>{capability.title}</Text>
            <Text style={{ color: c.textSecondary, fontSize: 13, marginTop: 2 }}>{capability.subtitle}</Text>
          </View>
          <Text style={{ color: c.textMuted, fontSize: 20 }}>›</Text>
        </View>
        {capability.tags && capability.tags.length > 0 ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
            {capability.tags.map((tg) => (
              <Badge key={tg} label={tg} tone="neutral" />
            ))}
          </View>
        ) : null}
      </Card>
    </Pressable>
  );
}

// ── Learning mode selector (4.1 — the 6 pedagogical modes) ───────────────────
export function LearningModeSelector({
  modes,
  value,
  onSelect,
}: {
  modes: TeachingMode[];
  value: ModeKeyLike;
  onSelect: (m: TeachingMode) => void;
}) {
  const { colors: c, radius } = useTokens();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
      {modes.map((m) => {
        const on = m.key === value;
        return (
          <Pressable
            key={m.key}
            onPress={() => onSelect(m)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            accessibilityLabel={m.label}
            style={{ width: '47%', minWidth: 150, flexGrow: 1, borderWidth: 1.5, borderColor: on ? c.aiAccent : c.border, backgroundColor: on ? c.aiAccentSoft : c.surface, borderRadius: radius.md, padding: 12, gap: 4 }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontSize: 18 }}>{m.icon}</Text>
              <Text style={{ color: on ? c.aiAccent : c.textPrimary, fontSize: 15, fontWeight: '700' }}>{m.label}</Text>
              {m.oral ? <Badge label="oral" tone="ai" /> : null}
            </View>
            <Text style={{ color: c.textSecondary, fontSize: 12, lineHeight: 17 }}>{m.desc}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
type ModeKeyLike = TeachingMode['key'] | null;

// ── Universal start bar (4 — convergence: everything can begin here) ─────────
export function UniversalStartBar({
  entries,
  onText,
  onPick,
}: {
  entries: StartEntry[];
  onText: (text: string) => void;
  onPick: (e: StartEntry) => void;
}) {
  const { colors: c } = useTokens();
  const [text, setText] = useState('');
  const submit = () => {
    const v = text.trim();
    if (v) onText(v);
    setText('');
  };
  return (
    <Card elevated style={{ borderColor: c.aiAccent, gap: 12 }}>
      <Text style={{ color: c.textPrimary, fontSize: 18, fontWeight: '800' }}>🤖 Apprendre avec mon professeur</Text>
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
        <View style={{ flex: 1 }}>
          <Input placeholder="Pose une question, ou décris ce que tu veux apprendre…" value={text} onChangeText={setText} onSubmitEditing={submit} returnKeyType="send" />
        </View>
        <Button label="→" variant="ai" onPress={submit} disabled={!text.trim()} accessibilityLabel="Envoyer" />
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {entries.map((e) => (
          <Pressable
            key={e.key}
            onPress={() => onPick(e)}
            accessibilityRole="button"
            accessibilityLabel={e.label}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: c.border, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 12, minHeight: 40 }}
          >
            <Text style={{ fontSize: 15 }}>{e.icon}</Text>
            <Text style={{ color: c.textSecondary, fontSize: 13, fontWeight: '600' }}>{e.label}</Text>
          </Pressable>
        ))}
      </View>
    </Card>
  );
}

// ── Document drop zone + sources (4.2) ───────────────────────────────────────
export function DocumentDropZone({
  sources,
  onPick,
}: {
  sources: { icon: string; label: string }[];
  onPick: (label: string) => void;
}) {
  const { colors: c, radius } = useTokens();
  return (
    <Card style={{ gap: 12 }}>
      <View style={{ borderWidth: 2, borderStyle: 'dashed', borderColor: c.borderStrong, borderRadius: radius.lg, paddingVertical: 28, alignItems: 'center', gap: 6 }}>
        <Text style={{ fontSize: 30 }}>📥</Text>
        <Text style={{ color: c.textPrimary, fontSize: 16, fontWeight: '700' }}>Dépose ton document</Text>
        <Text style={{ color: c.textMuted, fontSize: 13 }}>PDF, photo, scan, livre, cahier…</Text>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {sources.map((s) => (
          <Pressable key={s.label} onPress={() => onPick(s.label)} accessibilityRole="button" accessibilityLabel={s.label}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: c.border, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 12, minHeight: 40 }}>
            <Text style={{ fontSize: 15 }}>{s.icon}</Text>
            <Text style={{ color: c.textSecondary, fontSize: 13, fontWeight: '600' }}>{s.label}</Text>
          </Pressable>
        ))}
      </View>
    </Card>
  );
}

// ── Multi-page scanner (4.6) ─────────────────────────────────────────────────
export function MultiPageScanner({
  pages,
  onAddPage,
  onAnalyze,
}: {
  pages: number;
  onAddPage: () => void;
  onAnalyze: () => void;
}) {
  const { colors: c, radius } = useTokens();
  return (
    <Card style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ color: c.textPrimary, fontSize: 16, fontWeight: '700' }}>📷 Scan multi-pages</Text>
        <Badge label={`${pages} page${pages > 1 ? 's' : ''}`} tone="neutral" />
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {Array.from({ length: pages }).map((_, i) => (
          <View key={i} style={{ width: 52, height: 68, borderRadius: radius.sm, borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceSunken, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: c.textMuted, fontSize: 12 }}>{i + 1}</Text>
          </View>
        ))}
        <Pressable onPress={onAddPage} accessibilityRole="button" accessibilityLabel="Ajouter une page"
          style={{ width: 52, height: 68, borderRadius: radius.sm, borderWidth: 1, borderStyle: 'dashed', borderColor: c.borderStrong, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: c.aiAccent, fontSize: 22 }}>＋</Text>
        </Pressable>
      </View>
      <Button label="Analyser" variant="ai" onPress={onAnalyze} disabled={pages === 0} />
    </Card>
  );
}

// ── Document context form + AI suggestion (4.7) ──────────────────────────────
export function DocumentContextForm({
  suggestion,
  onConfirm,
}: {
  suggestion?: string;
  onConfirm: () => void;
}) {
  const { colors: c } = useTokens();
  const [name, setName] = useState('');
  return (
    <Card style={{ gap: 12 }}>
      <Text style={{ color: c.textPrimary, fontSize: 16, fontWeight: '700' }}>Quel est ce document ?</Text>
      {suggestion ? (
        <View style={{ backgroundColor: c.aiAccentSoft, borderRadius: 12, padding: 12, gap: 8 }}>
          <Text style={{ color: c.aiAccent, fontSize: 12, fontWeight: '800' }}>🤖 SUGGESTION AUTOMATIQUE</Text>
          <Text style={{ color: c.textSecondary, fontSize: 14, lineHeight: 20 }}>{suggestion}</Text>
          <View style={{ alignSelf: 'flex-start' }}>
            <Button label="Confirmer" size="sm" onPress={onConfirm} />
          </View>
        </View>
      ) : null}
      <Field label="Type" value="Cours" />
      <Field label="Matière" value="Mathématiques" />
      <Field label="Niveau" value="Licence 1" />
      <Input label="Nom" placeholder="Ex. Algèbre linéaire" value={name} onChangeText={setName} />
      <Field label="Langue" value="Français" />
    </Card>
  );
}
function Field({ label, value }: { label: string; value: string }) {
  const { colors: c, radius } = useTokens();
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: c.textSecondary, fontSize: 13, fontWeight: '600' }}>{label}</Text>
      <View style={{ borderWidth: 1, borderColor: c.border, borderRadius: radius.sm, paddingVertical: 11, paddingHorizontal: 14, minHeight: 44, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: c.surface }}>
        <Text style={{ color: c.textPrimary, fontSize: 15 }}>{value}</Text>
        <Text style={{ color: c.textMuted }}>▾</Text>
      </View>
    </View>
  );
}

// ── Pedagogy level selector (4.3 — the 3 levels) ─────────────────────────────
export type PedagogyLevel = 'guide' | 'assist' | 'solution';
export function PedagogyLevelSelector({ value, onChange }: { value: PedagogyLevel; onChange: (v: PedagogyLevel) => void }) {
  const { colors: c, radius } = useTokens();
  const opts: { key: PedagogyLevel; dot: string; label: string; desc: string; color: string }[] = [
    { key: 'guide', dot: '🟢', label: 'Guidage pédagogique', desc: 'Je t’aide à réfléchir par toi-même.', color: c.success },
    { key: 'assist', dot: '🟡', label: 'Résolution accompagnée', desc: 'On avance étape par étape ensemble.', color: c.warning },
    { key: 'solution', dot: '🔵', label: 'Solution expliquée', desc: 'Une solution complète, toujours expliquée.', color: c.info },
  ];
  return (
    <View style={{ gap: 8 }}>
      {opts.map((o) => {
        const on = o.key === value;
        return (
          <Pressable key={o.key} onPress={() => onChange(o.key)} accessibilityRole="radio" accessibilityState={{ selected: on }}
            style={{ borderWidth: 1.5, borderColor: on ? o.color : c.border, backgroundColor: on ? c.surfaceElevated : c.surface, borderRadius: radius.md, padding: 12, flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <Text style={{ fontSize: 18 }}>{o.dot}</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: c.textPrimary, fontSize: 15, fontWeight: '700' }}>{o.label}</Text>
              <Text style={{ color: c.textSecondary, fontSize: 12, marginTop: 2 }}>{o.desc}</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

// ── Task stepper (4.10 — workspace pedagogical flow) ─────────────────────────
export function TaskStepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <View style={{ gap: 8 }}>
      {steps.map((s, i) => (
        <LessonStep key={s} index={i + 1} title={s} active={i === current} done={i < current} />
      ))}
    </View>
  );
}

// ── Exam card (4.4) ──────────────────────────────────────────────────────────
export function ExamCard({ title, detail, count, onStart }: { title: string; detail?: string; count?: number; onStart: () => void }) {
  const { colors: c } = useTokens();
  return (
    <Card style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ color: c.textPrimary, fontSize: 16, fontWeight: '700' }}>📝 {title}</Text>
        {count != null ? <Badge label={`${count} questions`} tone="neutral" /> : null}
      </View>
      {detail ? <Text style={{ color: c.textSecondary, fontSize: 14 }}>{detail}</Text> : null}
      <View style={{ alignSelf: 'flex-start' }}>
        <Button label="Commencer l’examen" onPress={onStart} />
      </View>
    </Card>
  );
}

// ── Language practice card (4.5) ─────────────────────────────────────────────
export function LanguagePracticeCard({ skills, onPractice }: { skills: string[]; onPractice: (skill: string) => void }) {
  const { colors: c } = useTokens();
  return (
    <Card style={{ gap: 10 }}>
      <Text style={{ color: c.textPrimary, fontSize: 16, fontWeight: '700' }}>🌍 Pratique linguistique</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {skills.map((s) => (
          <Pressable key={s} onPress={() => onPractice(s)} accessibilityRole="button"
            style={{ borderWidth: 1, borderColor: c.border, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 12, minHeight: 40, justifyContent: 'center' }}>
            <Text style={{ color: c.textSecondary, fontSize: 13, fontWeight: '600' }}>{s}</Text>
          </Pressable>
        ))}
      </View>
    </Card>
  );
}

// ── Voice shadowing (4.13) ───────────────────────────────────────────────────
export function VoiceShadowing({
  phrase,
  scores,
}: {
  phrase: string;
  scores?: { pronunciation: number; accent: number; fluency: number } | null;
}) {
  const { colors: c } = useTokens();
  const bar = (label: string, v: number) => (
    <View style={{ gap: 4 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ color: c.textSecondary, fontSize: 13 }}>{label}</Text>
        <Text style={{ color: c.textMuted, fontSize: 13, fontWeight: '700' }}>{Math.round(v * 100)}%</Text>
      </View>
      <Progress value={v} tone="ai" />
    </View>
  );
  return (
    <Card style={{ gap: 12 }}>
      <Text style={{ color: c.textPrimary, fontSize: 16, fontWeight: '700' }}>🎙️ Voice Shadowing</Text>
      <View style={{ backgroundColor: c.surfaceSunken, borderRadius: 12, padding: 14, gap: 8, alignItems: 'center' }}>
        <Text style={{ color: c.textPrimary, fontSize: 18, fontWeight: '600' }}>“{phrase}”</Text>
        <Text style={{ fontSize: 26 }}>🎙️</Text>
        <Text style={{ color: c.aiAccent, fontSize: 14, fontWeight: '700' }}>À toi.</Text>
      </View>
      {scores ? (
        <View style={{ gap: 10 }}>
          {bar('Prononciation', scores.pronunciation)}
          {bar('Accent', scores.accent)}
          {bar('Fluidité', scores.fluency)}
        </View>
      ) : null}
    </Card>
  );
}

// ── Translation panel — international mobility engine (4.12) ──────────────────
export function TranslationPanel({
  concept,
  nativeExplanation,
  term,
  translation,
  example,
}: {
  concept: string;
  nativeExplanation: string;
  term: string;
  translation: string;
  example: string;
}) {
  const { colors: c } = useTokens();
  return (
    <Card style={{ gap: 10, borderColor: c.aiAccent }}>
      <Text style={{ color: c.aiAccent, fontSize: 12, fontWeight: '800' }}>🌍 SUPPORT BILINGUE</Text>
      <Text style={{ color: c.textPrimary, fontSize: 16, fontWeight: '700' }}>{concept}</Text>
      <Text style={{ color: c.textSecondary, fontSize: 14, lineHeight: 20 }}>{nativeExplanation}</Text>
      <TranslationHint term={term} translation={translation} />
      <BilingualText text={example} gloss={translation} />
    </Card>
  );
}

// ── Deep search: in-docs vs external, with source citation (4.8) ─────────────
export function DeepSearchScope({ value, onChange }: { value: 'docs' | 'web'; onChange: (v: 'docs' | 'web') => void }) {
  return (
    <SegmentedControl
      options={['docs', 'web'] as const}
      value={value}
      onChange={onChange}
      labelFor={(v) => (v === 'docs' ? '📚 Dans mes documents' : '🌐 Recherche approfondie')}
    />
  );
}
export function SourceCitation({ title, external }: { title: string; external?: boolean }) {
  const { colors: c, radius } = useTokens();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: external ? c.warning : c.border, borderRadius: radius.sm, paddingVertical: 6, paddingHorizontal: 10, alignSelf: 'flex-start' }}>
      <Text style={{ fontSize: 12 }}>{external ? '🌐' : '📄'}</Text>
      <Text style={{ color: c.textSecondary, fontSize: 12 }}>{title}</Text>
      {external ? <Badge label="externe" tone="warning" /> : null}
    </View>
  );
}

// ── Concept explanation (4.15) ───────────────────────────────────────────────
export function ConceptExplanation({ concept, text }: { concept: string; text: string }) {
  const { colors: c } = useTokens();
  return (
    <Card style={{ gap: 6 }}>
      <Text style={{ color: c.aiAccent, fontSize: 12, fontWeight: '800' }}>📘 EXPLICATION</Text>
      <Text style={{ color: c.textPrimary, fontSize: 16, fontWeight: '700' }}>{concept}</Text>
      <Text style={{ color: c.textSecondary, fontSize: 15, lineHeight: 22 }}>{text}</Text>
    </Card>
  );
}

// ── Progress feedback (4 — connected to the twin) ────────────────────────────
export function ProgressFeedback({ concept, mastery, note }: { concept: string; mastery: number; note?: string }) {
  const { colors: c } = useTokens();
  return (
    <Card style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ color: c.textPrimary, fontSize: 15, fontWeight: '700' }}>{concept}</Text>
        <Text style={{ color: c.textMuted, fontSize: 14, fontWeight: '700' }}>{Math.round(mastery * 100)}%</Text>
      </View>
      <Progress value={mastery} tone={mastery >= 0.8 ? 'success' : mastery >= 0.5 ? 'primary' : 'ai'} />
      {note ? <AITeacherMessage text={note} posture="challenging" /> : null}
    </Card>
  );
}

// ── AI teacher panel (compact conversation entry, 4.1) ───────────────────────
export function AITeacherPanel({
  posture = 'supportive',
  message,
  onWrite,
  onSpeak,
  children,
}: {
  posture?: Posture;
  message: string;
  onWrite: () => void;
  onSpeak: () => void;
  children?: ReactNode;
}) {
  const { colors: c } = useTokens();
  return (
    <Card style={{ gap: 10, borderColor: c.aiAccent }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={{ fontSize: 20 }}>👨‍🏫</Text>
        <Text style={{ color: c.aiAccent, fontSize: 12, fontWeight: '800', letterSpacing: 0.5 }}>PROFESSEUR IA</Text>
        <PostureBadge posture={posture} />
      </View>
      <AITeacherMessage text={message} posture={posture} />
      {children}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Button label="✍️ Écrire" variant="secondary" onPress={onWrite} />
        <Button label="🎙️ Oral" variant="ai" onPress={onSpeak} />
      </View>
    </Card>
  );
}
