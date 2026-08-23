import { useState, type ReactNode } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import type { KycTeacher, LearningCategory } from '@second-brain/shared';
import { useTokens } from '../../lib/design/theme';
import { Badge, Button, Card, Input, Progress, SegmentedControl, Switch } from '../ds/core';
import { Sheet } from '../ds/overlays';
import { PostureBadge, type Posture } from '../ds/ai';

/**
 * Profil & KYC components (UI/UX Sprint 7). Reusable views for the learner's
 * configuration: interactive profile photo (camera / gallery / avatar / remove),
 * identity & journey, languages + international mobility, AI-teacher posture, the
 * cognitive summary, and system/data settings. Editing propagates to the KYC
 * (OnboardingProfile) so the twin + teacher context update everywhere. French.
 */

const AVATAR_EMOJIS = ['🧑‍🎓', '👩‍🎓', '🧑‍💻', '👨‍🔬', '🧑‍🏫', '🚀', '🧠', '⭐', '🦉', '🌟'];

// ── 1. Interactive profile photo ─────────────────────────────────────────────
export function ProfilePhoto({
  photoUri,
  avatarEmoji,
  name,
  busy,
  onPick,
  onChooseAvatar,
  onRemove,
}: {
  photoUri?: string | null;
  avatarEmoji?: string | null;
  name?: string;
  busy?: boolean;
  onPick: (source: 'camera' | 'gallery') => void;
  onChooseAvatar: (emoji: string) => void;
  onRemove: () => void;
}) {
  const { colors: c, radius } = useTokens();
  const [open, setOpen] = useState(false);
  const initials = (name ?? '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('');

  return (
    <View style={{ alignItems: 'center', gap: 8 }}>
      <View>
        <View style={{ width: 96, height: 96, borderRadius: 999, backgroundColor: c.aiAccentSoft, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 2, borderColor: c.aiAccent }}>
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={{ width: '100%', height: '100%' }} accessibilityLabel="Photo de profil" />
          ) : (
            <Text style={{ fontSize: avatarEmoji ? 44 : 34, color: c.aiAccent, fontWeight: '800' }}>{avatarEmoji || initials || '👤'}</Text>
          )}
        </View>
        {/* edit FAB (camera icon) */}
        <Pressable
          onPress={() => setOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Modifier la photo"
          style={{ position: 'absolute', right: -2, bottom: -2, width: 34, height: 34, borderRadius: 999, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: c.background }}
        >
          <Text style={{ fontSize: 16 }}>📷</Text>
        </Pressable>
      </View>

      <Sheet visible={open} onClose={() => setOpen(false)} title="Photo de profil">
        <PhotoRow icon="📷" label="Prendre une photo" onPress={() => { setOpen(false); onPick('camera'); }} disabled={busy} />
        <PhotoRow icon="🖼️" label="Choisir depuis la galerie" onPress={() => { setOpen(false); onPick('gallery'); }} disabled={busy} />
        <View style={{ gap: 8, marginTop: 4 }}>
          <Text style={{ color: c.textMuted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' }}>Ou un avatar</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {AVATAR_EMOJIS.map((e) => (
              <Pressable key={e} onPress={() => { setOpen(false); onChooseAvatar(e); }} accessibilityRole="button" accessibilityLabel={`Avatar ${e}`}
                style={{ width: 44, height: 44, borderRadius: radius.md, borderWidth: 1, borderColor: avatarEmoji === e ? c.aiAccent : c.border, backgroundColor: avatarEmoji === e ? c.aiAccentSoft : c.surface, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 22 }}>{e}</Text>
              </Pressable>
            ))}
          </View>
        </View>
        {(photoUri || avatarEmoji) ? (
          <View style={{ marginTop: 8 }}>
            <PhotoRow icon="🗑️" label="Supprimer la photo" danger onPress={() => { setOpen(false); onRemove(); }} />
          </View>
        ) : null}
      </Sheet>
    </View>
  );
}
function PhotoRow({ icon, label, onPress, danger, disabled }: { icon: string; label: string; onPress: () => void; danger?: boolean; disabled?: boolean }) {
  const { colors: c, radius } = useTokens();
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={label}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, minHeight: 48, opacity: disabled ? 0.5 : 1 }}>
      <Text style={{ fontSize: 18 }}>{icon}</Text>
      <Text style={{ color: danger ? c.error : c.textPrimary, fontSize: 15, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

// ── section wrapper ──────────────────────────────────────────────────────────
export function ProfileSection({ title, children }: { title: string; children: ReactNode }) {
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

// ── 2. Identity & journey ────────────────────────────────────────────────────
const CATEGORY_LABEL: Record<LearningCategory, string> = {
  kindergarten: 'Enfant',
  primary: 'Enfant',
  secondary: 'Élève',
  highschool: 'Élève',
  university: 'Étudiant',
  research: 'Chercheur',
  professional: 'Adulte',
  language: 'Apprenant de langue',
  personal: 'Adulte',
};
export function IdentityCard({
  name,
  category,
  level,
  field,
  institution,
  onEditName,
}: {
  name: string;
  category?: LearningCategory | null;
  level?: string;
  field?: string;
  institution?: string;
  onEditName: (v: string) => void;
}) {
  return (
    <ProfileSection title="Identité & parcours">
      <Field label="Nom"><Input placeholder="Ton nom" value={name} onChangeText={onEditName} /></Field>
      <Field label="Catégorie d’apprenant">
        <Badge label={category ? CATEGORY_LABEL[category] : '—'} tone="ai" />
      </Field>
      {field ? <Field label="Cursus / domaine"><ValueText>{field}</ValueText></Field> : null}
      {level ? <Field label="Niveau"><ValueText>{level}</ValueText></Field> : null}
      {institution ? <Field label="Établissement"><ValueText>{institution}</ValueText></Field> : null}
    </ProfileSection>
  );
}
function ValueText({ children }: { children: ReactNode }) {
  const { colors: c } = useTokens();
  return <Text style={{ color: c.textPrimary, fontSize: 15 }}>{children}</Text>;
}

// ── 2/3. Languages + international mobility ───────────────────────────────────
export function LanguagesCard({
  native,
  study,
  mobility,
  onToggleMobility,
}: {
  native?: string;
  study?: string;
  mobility: boolean;
  onToggleMobility: (v: boolean) => void;
}) {
  const { colors: c } = useTokens();
  const foreign = !!native && !!study && native !== study;
  return (
    <ProfileSection title="Langues">
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Field label="Langue maternelle"><Badge label={native || '—'} tone="neutral" /></Field>
        <Field label="Langue d’étude"><Badge label={study || '—'} tone="primary" /></Field>
      </View>
      <View style={{ borderTopWidth: 1, borderTopColor: c.borderSubtle, paddingTop: 12, gap: 8 }}>
        <Switch value={mobility} onChange={onToggleMobility} label="Mobilité internationale" />
        <Text style={{ color: c.textMuted, fontSize: 12, lineHeight: 18 }}>
          {foreign
            ? 'Tu étudies dans une langue différente de ta langue maternelle : le soutien linguistique automatique et l’immersion contextuelle sont activés.'
            : 'Active-le si tu étudies dans une autre langue que ta langue maternelle.'}
        </Text>
        {mobility && foreign ? <Badge label="🌍 Soutien linguistique activé" tone="success" /> : null}
      </View>
    </ProfileSection>
  );
}

// ── 4. AI teacher configuration ──────────────────────────────────────────────
const POSTURES: { key: NonNullable<KycTeacher['tone']>; posture: Posture; label: string }[] = [
  { key: 'supportive', posture: 'supportive', label: '🟢 Bienveillante' },
  { key: 'balanced', posture: 'supportive', label: '🟡 Exigeante' },
  { key: 'demanding', posture: 'examiner', label: '🔴 Sévère / Examinateur' },
];
export function TeacherConfig({
  tone,
  explanations,
  onTone,
  onExplanations,
}: {
  tone?: KycTeacher['tone'];
  explanations?: KycTeacher['explanations'];
  onTone: (v: NonNullable<KycTeacher['tone']>) => void;
  onExplanations: (v: NonNullable<KycTeacher['explanations']>) => void;
}) {
  const { colors: c, radius } = useTokens();
  return (
    <ProfileSection title="Professeur IA">
      <Field label="Posture">
        <View style={{ gap: 8 }}>
          {POSTURES.map((p) => {
            const on = p.key === tone;
            return (
              <Pressable key={p.key} onPress={() => onTone(p.key)} accessibilityRole="radio" accessibilityState={{ selected: on }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderColor: on ? c.aiAccent : c.border, backgroundColor: on ? c.aiAccentSoft : c.surface, borderRadius: radius.md, padding: 12 }}>
                <Text style={{ color: on ? c.aiAccent : c.textPrimary, fontSize: 15, fontWeight: '700', flex: 1 }}>{p.label}</Text>
                <PostureBadge posture={p.posture} />
              </Pressable>
            );
          })}
        </View>
      </Field>
      <Field label="Explications">
        <SegmentedControl
          options={['short', 'balanced', 'detailed'] as const}
          value={explanations ?? 'balanced'}
          onChange={onExplanations}
          labelFor={(v) => (v === 'short' ? 'Courtes' : v === 'balanced' ? 'Équilibrées' : 'Détaillées')}
        />
      </Field>
    </ProfileSection>
  );
}

// ── 5. Digital Twin & FSRS summary ───────────────────────────────────────────
export function CognitiveSummary({
  strengths,
  retention,
  dailyMinutes,
}: {
  strengths: string[];
  retention: number | null;
  dailyMinutes: number;
}) {
  const { colors: c } = useTokens();
  return (
    <ProfileSection title="Profil cognitif (Digital Twin)">
      <Field label="Tes forces">
        {strengths.length === 0 ? (
          <Text style={{ color: c.textMuted, fontSize: 14 }}>Elles apparaîtront au fil de ton apprentissage.</Text>
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {strengths.slice(0, 6).map((s) => <Badge key={s} label={s} tone="success" />)}
          </View>
        )}
      </Field>
      <Field label="Rétention cible">
        <Progress value={retention ?? 0.9} tone="ai" />
        <Text style={{ color: c.textMuted, fontSize: 12, marginTop: 4 }}>{retention == null ? 'objectif 90 %' : `${Math.round(retention * 100)} % actuel · objectif 90 %`}</Text>
      </Field>
      <Field label="Rythme quotidien">
        <Badge label={`~${dailyMinutes} min / jour`} tone="ai" />
      </Field>
    </ProfileSection>
  );
}

// ── 6. System & data ─────────────────────────────────────────────────────────
export function SystemConfig({
  scheme,
  onScheme,
  totalConcepts,
  reviews,
  onPrivacy,
  onMemory,
}: {
  scheme: 'light' | 'dark' | 'system';
  onScheme: (s: 'light' | 'dark' | 'system') => void;
  totalConcepts: number;
  reviews: number;
  onPrivacy: () => void;
  onMemory: () => void;
}) {
  const { colors: c } = useTokens();
  const stat = (v: string, l: string) => (
    <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
      <Text style={{ color: c.textPrimary, fontSize: 20, fontWeight: '800' }}>{v}</Text>
      <Text style={{ color: c.textMuted, fontSize: 12 }}>{l}</Text>
    </View>
  );
  return (
    <ProfileSection title="Système & données">
      <Field label="Thème">
        <SegmentedControl
          options={['light', 'dark', 'system'] as const}
          value={scheme}
          onChange={onScheme}
          labelFor={(v) => (v === 'light' ? '☀︎ Clair' : v === 'dark' ? '☾ Sombre' : '⚙︎ Système')}
        />
      </Field>
      <Field label="Statistiques">
        <View style={{ flexDirection: 'row' }}>
          {stat(`${totalConcepts}`, 'concepts')}
          {stat(`${reviews}`, 'révisions')}
        </View>
      </Field>
      <Field label="Confidentialité & mémoire">
        <View style={{ gap: 8 }}>
          <Button label="🔒 Confidentialité & données" variant="secondary" onPress={onPrivacy} />
          <Button label="🧠 Gérer la mémoire vectorielle" variant="secondary" onPress={onMemory} />
        </View>
      </Field>
    </ProfileSection>
  );
}
