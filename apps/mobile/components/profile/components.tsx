import { useState, type ReactNode } from 'react';
import { Image, Platform, Pressable, Text, View } from 'react-native';
import type { KycTeacher, LearningCategory } from '@second-brain/shared';
import { useTokens } from '../../lib/design/theme';
import { Badge, Button, Card, Input, Progress, SegmentedControl, Switch } from '../ds/core';
import { Sheet } from '../ds/overlays';
import { PostureBadge, type Posture } from '../ds/ai';
import { useI18n, type TranslationKey } from '../../lib/i18n';

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
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const initials = (name ?? '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('');

  return (
    <View style={{ alignItems: 'center', gap: 8 }}>
      <View>
        <View style={{ width: 96, height: 96, borderRadius: 999, backgroundColor: c.aiAccentSoft, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 2, borderColor: c.aiAccent }}>
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={{ width: '100%', height: '100%' }} accessibilityLabel={t('profile.card.photo')} />
          ) : (
            <Text style={{ fontSize: avatarEmoji ? 44 : 34, color: c.aiAccent, fontWeight: '800' }}>{avatarEmoji || initials || '👤'}</Text>
          )}
        </View>
        {/* edit FAB (camera icon) */}
        <Pressable
          onPress={() => setOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={t('profile.card.editPhoto')}
          style={{ position: 'absolute', right: -2, bottom: -2, width: 34, height: 34, borderRadius: 999, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: c.background }}
        >
          <Text style={{ fontSize: 16 }}>📷</Text>
        </Pressable>
      </View>

      <Sheet visible={open} onClose={() => setOpen(false)} title={t('profile.card.photo')}>
        <PhotoRow icon="📷" label={t(Platform.OS === 'web' ? 'profile.card.webcam' : 'profile.card.takePhoto')} onPress={() => { setOpen(false); onPick('camera'); }} disabled={busy} />
        <PhotoRow icon="🖼️" label={t(Platform.OS === 'web' ? 'profile.card.importImage' : 'profile.card.gallery')} onPress={() => { setOpen(false); onPick('gallery'); }} disabled={busy} />
        <View style={{ gap: 8, marginTop: 4 }}>
          <Text style={{ color: c.textMuted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' }}>{t('profile.card.avatar')}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {AVATAR_EMOJIS.map((e) => (
              <Pressable key={e} onPress={() => { setOpen(false); onChooseAvatar(e); }} accessibilityRole="button" accessibilityLabel={`${t('profile.card.avatar')} ${e}`}
                style={{ width: 44, height: 44, borderRadius: radius.md, borderWidth: 1, borderColor: avatarEmoji === e ? c.aiAccent : c.border, backgroundColor: avatarEmoji === e ? c.aiAccentSoft : c.surface, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 22 }}>{e}</Text>
              </Pressable>
            ))}
          </View>
        </View>
        {(photoUri || avatarEmoji) ? (
          <View style={{ marginTop: 8 }}>
            <PhotoRow icon="🗑️" label={t('profile.card.removePhoto')} danger onPress={() => { setOpen(false); onRemove(); }} />
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
const CATEGORY_LABEL: Record<LearningCategory, TranslationKey> = {
  kindergarten: 'profile.card.cat.child',
  primary: 'profile.card.cat.child',
  secondary: 'profile.card.cat.student',
  highschool: 'profile.card.cat.student',
  university: 'profile.card.cat.student',
  research: 'profile.card.cat.researcher',
  professional: 'profile.card.cat.adult',
  language: 'profile.card.cat.language',
  personal: 'profile.card.cat.adult',
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
  const { t } = useI18n();
  return (
    <ProfileSection title={t('profile.card.identity')}>
      <Field label={t('profile.card.name')}><Input placeholder={t('profile.card.namePh')} value={name} onChangeText={onEditName} /></Field>
      <Field label={t('profile.card.category')}>
        <Badge label={category ? t(CATEGORY_LABEL[category]) : '—'} tone="ai" />
      </Field>
      {field ? <Field label={t('profile.card.curriculum')}><ValueText>{field}</ValueText></Field> : null}
      {level ? <Field label={t('profile.card.level')}><ValueText>{level}</ValueText></Field> : null}
      {institution ? <Field label={t('profile.card.institution')}><ValueText>{institution}</ValueText></Field> : null}
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
  const { t } = useI18n();
  const foreign = !!native && !!study && native !== study;
  return (
    <ProfileSection title={t('profile.languages')}>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Field label={t('profile.card.nativeLanguage')}><Badge label={native || '—'} tone="neutral" /></Field>
        <Field label={t('profile.card.studyLanguage')}><Badge label={study || '—'} tone="primary" /></Field>
      </View>
      <View style={{ borderTopWidth: 1, borderTopColor: c.borderSubtle, paddingTop: 12, gap: 8 }}>
        <Switch value={mobility} onChange={onToggleMobility} label={t('profile.card.mobility')} />
        <Text style={{ color: c.textMuted, fontSize: 12, lineHeight: 18 }}>
          {foreign
            ? t('profile.card.mobilityOn')
            : t('profile.card.mobilityOff')}
        </Text>
        {mobility && foreign ? <Badge label={t('profile.card.languageSupport')} tone="success" /> : null}
      </View>
    </ProfileSection>
  );
}

// ── 4. AI teacher configuration ──────────────────────────────────────────────
const POSTURES: { key: NonNullable<KycTeacher['tone']>; posture: Posture; label: TranslationKey }[] = [
  { key: 'supportive', posture: 'supportive', label: 'profile.card.toneSupportive' },
  { key: 'balanced', posture: 'challenging', label: 'profile.card.toneBalanced' },
  { key: 'demanding', posture: 'examiner', label: 'profile.card.toneDemanding' },
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
  const { t } = useI18n();
  return (
    <ProfileSection title={t('profile.card.aiTeacher')}>
      <Field label={t('profile.card.posture')}>
        <View style={{ gap: 8 }}>
          {POSTURES.map((p) => {
            const on = p.key === tone;
            return (
              <Pressable key={p.key} onPress={() => onTone(p.key)} accessibilityRole="radio" accessibilityState={{ selected: on }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderColor: on ? c.aiAccent : c.border, backgroundColor: on ? c.aiAccentSoft : c.surface, borderRadius: radius.md, padding: 12 }}>
                <Text style={{ color: on ? c.aiAccent : c.textPrimary, fontSize: 15, fontWeight: '700', flex: 1 }}>{t(p.label)}</Text>
                <PostureBadge posture={p.posture} />
              </Pressable>
            );
          })}
        </View>
      </Field>
      <Field label={t('profile.card.explanations')}>
        <SegmentedControl
          options={['short', 'balanced', 'detailed'] as const}
          value={explanations ?? 'balanced'}
          onChange={onExplanations}
          labelFor={(v) => t(v === 'short' ? 'profile.card.explShort' : v === 'balanced' ? 'profile.card.explBalanced' : 'profile.card.explDetailed')}
        />
      </Field>
    </ProfileSection>
  );
}

/** Essential-first adaptive teacher settings. The backend captures these
 * preferences when a new session/assessment begins; it never trusts the UI as
 * the authority for exam safeguards. */
export function AdaptiveTeacherConfig({
  value,
  onChange,
}: {
  value: KycTeacher;
  onChange: (patch: Partial<KycTeacher>) => void;
}) {
  const { colors: c } = useTokens();
  const { t } = useI18n();
  const [advanced, setAdvanced] = useState(false);
  const displayedLearningSupport: NonNullable<KycTeacher['learningSupport']> = value.learningSupport
    ?? (value.tone === 'supportive' && value.intervention !== 'let_me_think'
      ? 'guided'
      : value.tone === 'demanding' && value.intervention !== 'guide_me'
        ? 'demanding'
        : value.intervention === 'guide_me' && value.tone !== 'demanding'
          ? 'guided'
          : value.intervention === 'let_me_think' && value.tone !== 'supportive'
            ? 'demanding'
            : 'balanced');
  const reset = () => onChange({
    automaticAdaptation: true,
    learningSupport: 'balanced',
    tone: 'balanced',
    intervention: 'interactive',
    conversationMode: 'training',
    examRigor: 'standard',
    correction: 'adaptive',
    explanations: 'balanced',
    sessionSummary: true,
    encouragement: 'supportive',
  });

  return (
    <ProfileSection title={t('profile.teacher.title')}>
      <Text style={{ color: c.textSecondary, fontSize: 13, lineHeight: 19 }}>
        {t('profile.teacher.detail')}
      </Text>
      <Switch
        value={value.automaticAdaptation !== false}
        onChange={(automaticAdaptation) => onChange({ automaticAdaptation })}
        label={t('profile.teacher.auto')}
      />
      <Text style={{ color: c.textMuted, fontSize: 12, lineHeight: 18 }}>
        {t('profile.teacher.autoDetail')}
      </Text>
      <Field label={t('profile.teacher.learning')}>
        <SegmentedControl
          options={['guided', 'balanced', 'demanding'] as const}
          value={displayedLearningSupport}
          wrap
          onChange={(learningSupport) => onChange({
            learningSupport,
            tone: learningSupport === 'guided'
              ? 'supportive'
              : learningSupport === 'demanding'
                ? 'demanding'
                : 'balanced',
            intervention: learningSupport === 'guided'
              ? 'guide_me'
              : learningSupport === 'demanding'
                ? 'let_me_think'
                : 'interactive',
          })}
          labelFor={(option) => t(`profile.teacher.learning.${option}` as TranslationKey)}
        />
      </Field>
      <Field label={t('profile.teacher.conversation')}>
        <SegmentedControl
          options={['training', 'assessed'] as const}
          value={value.conversationMode ?? 'training'}
          onChange={(conversationMode) => onChange({ conversationMode })}
          labelFor={(option) => t(`profile.teacher.conversation.${option}` as TranslationKey)}
        />
        <Text style={{ color: c.textMuted, fontSize: 12, lineHeight: 18 }}>
          {t(value.conversationMode === 'assessed'
            ? 'profile.teacher.conversation.assessedDetail'
            : 'profile.teacher.conversation.trainingDetail')}
        </Text>
      </Field>
      <Field label={t('profile.teacher.exam')}>
        <SegmentedControl
          options={['standard', 'strict'] as const}
          value={value.examRigor ?? 'standard'}
          onChange={(examRigor) => onChange({ examRigor })}
          labelFor={(option) => t(`profile.teacher.exam.${option}` as TranslationKey)}
        />
        <Text style={{ color: c.textMuted, fontSize: 12, lineHeight: 18 }}>
          {t('profile.teacher.examDetail')}
        </Text>
      </Field>
      <Button
        label={t(advanced ? 'profile.teacher.advancedClose' : 'profile.teacher.advancedOpen')}
        variant="ghost"
        onPress={() => setAdvanced((open) => !open)}
      />
      {advanced ? (
        <View style={{ gap: 12 }} testID="teacher-advanced-settings">
          <Field label={t('profile.teacher.correction')}>
            <SegmentedControl
              options={['immediate', 'let_me_finish', 'adaptive'] as const}
              value={value.correction ?? 'adaptive'}
              onChange={(correction) => onChange({ correction })}
              labelFor={(option) => t(`profile.teacher.correction.${option}` as TranslationKey)}
            />
          </Field>
          <Field label={t('profile.card.explanations')}>
            <SegmentedControl
              options={['short', 'balanced', 'detailed'] as const}
              value={value.explanations ?? 'balanced'}
              onChange={(explanations) => onChange({ explanations })}
              labelFor={(option) => t(`profile.card.expl${option === 'short' ? 'Short' : option === 'balanced' ? 'Balanced' : 'Detailed'}` as TranslationKey)}
            />
          </Field>
          <Switch
            value={value.sessionSummary !== false}
            onChange={(sessionSummary) => onChange({ sessionSummary })}
            label={t('profile.teacher.summary')}
          />
          <Field label={t('profile.teacher.encouragement')}>
            <SegmentedControl
              options={['measured', 'supportive'] as const}
              value={value.encouragement ?? 'supportive'}
              onChange={(encouragement) => onChange({ encouragement })}
              labelFor={(option) => t(`profile.teacher.encouragement.${option}` as TranslationKey)}
            />
          </Field>
        </View>
      ) : null}
      <Button label={t('profile.teacher.reset')} variant="secondary" onPress={reset} />
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
  const { t } = useI18n();
  return (
    <ProfileSection title={t('profile.card.cognitive')}>
      <Field label={t('profile.card.strengths')}>
        {strengths.length === 0 ? (
          <Text style={{ color: c.textMuted, fontSize: 14 }}>{t('profile.card.strengthsEmpty')}</Text>
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {strengths.slice(0, 6).map((s) => <Badge key={s} label={s} tone="success" />)}
          </View>
        )}
      </Field>
      <Field label={t('profile.card.targetRetention')}>
        <Progress value={retention ?? 0.9} tone="ai" />
        <Text style={{ color: c.textMuted, fontSize: 12, marginTop: 4 }}>{retention == null ? t('profile.card.target90') : `${Math.round(retention * 100)} % ${t('profile.card.retentionCurrent')}`}</Text>
      </Field>
      <Field label={t('profile.card.dailyPace')}>
        <Badge label={`~${dailyMinutes} ${t('profile.card.minDay')}`} tone="ai" />
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
  const { t } = useI18n();
  const stat = (v: string, l: string) => (
    <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
      <Text style={{ color: c.textPrimary, fontSize: 20, fontWeight: '800' }}>{v}</Text>
      <Text style={{ color: c.textMuted, fontSize: 12 }}>{l}</Text>
    </View>
  );
  return (
    <ProfileSection title={t('profile.card.systemData')}>
      <Field label={t('profile.card.theme')}>
        <SegmentedControl
          options={['light', 'dark', 'system'] as const}
          value={scheme}
          onChange={onScheme}
          labelFor={(v) => t(v === 'light' ? 'profile.card.light' : v === 'dark' ? 'profile.card.dark' : 'profile.card.system')}
        />
      </Field>
      <Field label={t('profile.card.statistics')}>
        <View style={{ flexDirection: 'row' }}>
          {stat(`${totalConcepts}`, t('profile.card.concepts'))}
          {stat(`${reviews}`, t('profile.card.reviews'))}
        </View>
      </Field>
      <Field label={t('profile.card.privacyMemory')}>
        <View style={{ gap: 8 }}>
          <Button label={t('profile.card.privacyData')} variant="secondary" onPress={onPrivacy} />
          <Button label={t('profile.card.vectorMemory')} variant="secondary" onPress={onMemory} />
        </View>
      </Field>
    </ProfileSection>
  );
}
