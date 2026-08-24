import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import type {
  KycTeacher,
  LearningCategory,
  OnboardingAnswers,
  OnboardingState,
  ReviewStats,
  StrengthsWeaknesses,
  TwinOverview,
} from '@second-brain/shared';
import { api } from '../../lib/client';
import { useAuth } from '../../lib/auth-context';
import { useI18n, type TranslationKey } from '../../lib/i18n';
import { useTheme, useTokens } from '../../lib/design/theme';
import { useResponsive } from '../../lib/responsive';
import { Badge, Button, Card } from '../../components/ds/core';
import { categoryLabel } from '../../lib/onboarding/catalog';
import { LocalePicker } from '../../components/locale-picker';
import { clearAvatarPhoto, loadAvatarPhoto, pickPhoto, saveAvatarPhoto } from '../../lib/profile/photo';
import { CognitiveSummary, ProfilePhoto, SystemConfig, TeacherConfig } from '../../components/profile/components';

/**
 * 👤 Profil & KYC universel (UI/UX Sprint 7 unified).
 *
 * Full learner configuration on the Sprint 1 design system: native profile
 * photo, identity (prénom/nom/date/catégorie), full academic path, languages +
 * mobility, success goals, AI-teacher posture, the cognitive summary and system
 * settings. Every edit PATCHes the KYC (OnboardingProfile) and refreshes it, so
 * the twin + teacher context propagate to Home / Learn / Brain / Study. On
 * desktop the cards lay out in a 2-column grid; on mobile they stack.
 */
export default function ProfileScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const { user, logout, refreshOnboarding } = useAuth();
  const { colors: c } = useTokens();
  const { scheme, setScheme } = useTheme();
  const { width, maxContentWidth } = useResponsive();
  const wide = width >= 1024;

  const [kyc, setKyc] = useState<OnboardingState | null>(null);
  const [twin, setTwin] = useState<TwinOverview | null>(null);
  const [sw, setSw] = useState<StrengthsWeaknesses | null>(null);
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancel = false;
    (async () => {
      const [k, t, s, r] = await Promise.allSettled([
        api<OnboardingState>('/onboarding'),
        api<TwinOverview>('/twin'),
        api<StrengthsWeaknesses>('/twin/strengths'),
        api<ReviewStats>('/review/stats'),
      ]);
      if (cancel) return;
      if (k.status === 'fulfilled') setKyc(k.value);
      if (t.status === 'fulfilled') setTwin(t.value);
      if (s.status === 'fulfilled') setSw(s.value);
      if (r.status === 'fulfilled') setStats(r.value);
    })();
    loadAvatarPhoto().then((p) => { if (!cancel) setPhoto(p); });
    return () => { cancel = true; };
  }, [user?.displayName]);

  const answers = kyc?.answers ?? {};
  const identity = answers.identity ?? {};
  const education = (answers.education ?? {}) as OnboardingAnswers['education'] & { faculty?: string; option?: string };
  const languages = answers.languages ?? {};
  const teacher = answers.teacher ?? {};
  const goals = (answers.goals ?? []) as string[];

  /** PATCH a KYC section (object merge or list replace) + refresh (task 1.8). */
  const patch = useCallback(
    async <K extends keyof OnboardingAnswers>(section: K, value: OnboardingAnswers[K]) => {
      setKyc((prev) => (prev ? { ...prev, answers: { ...prev.answers, [section]: Array.isArray(value) ? value : { ...(prev.answers[section] as object ?? {}), ...(value as object) } } } : prev));
      try {
        await api('/onboarding', { method: 'PUT', body: { answers: { [section]: value } } });
        await refreshOnboarding?.();
      } catch { /* local state already updated */ }
    },
    [refreshOnboarding],
  );

  const onPick = async (source: 'camera' | 'gallery') => {
    setBusy(true);
    const res = await pickPhoto(source);
    setBusy(false);
    if (res.ok) { setPhoto(res.uri); await saveAvatarPhoto(res.uri); }
  };
  const onChooseAvatar = (emoji: string) => { setPhoto(null); void clearAvatarPhoto(); void patch('identity', { avatarEmoji: emoji }); };
  const onRemove = () => { setPhoto(null); void clearAvatarPhoto(); void patch('identity', { avatarEmoji: '' }); };

  const name = [identity.firstName, identity.lastName].filter(Boolean).join(' ');
  const strengths = (sw?.strengths ?? []).map((s) => s.name);
  // KYC completeness (§20): the core answers that tailor the twin/teacher.
  const kycComplete = Boolean(identity.firstName && education?.category && goals.length > 0);
  const langLine = languages.native
    ? `${languages.native}${languages.study ? ` → ${languages.study}` : ''}`
    : '—';
  const pathLine =
    (education?.category ? t(categoryLabel(education.category) as TranslationKey) : '—') +
    (education?.field ? ` — ${education.field}` : '');

  const grid: ViewStyle = wide ? { flexDirection: 'row', flexWrap: 'wrap', gap: 14 } : { gap: 16 };
  const cell: ViewStyle = wide ? { width: '48%', flexGrow: 1 } : {};

  return (
    <ScrollView contentContainerStyle={[styles.container, { maxWidth: maxContentWidth }]}>
      {/* Photo + name */}
      <View style={{ alignItems: 'center', gap: 6, marginTop: 6 }}>
        <ProfilePhoto photoUri={photo} avatarEmoji={identity.avatarEmoji} name={name} busy={busy} onPick={onPick} onChooseAvatar={onChooseAvatar} onRemove={onRemove} />
        <Text style={{ color: c.textPrimary, fontSize: 22, fontWeight: '800' }}>{name || user?.email?.split('@')[0]}</Text>
        <Text style={{ color: c.textMuted, fontSize: 13 }}>{user?.email ?? ''}</Text>
      </View>

      {/* Compact KYC card (§20): a summary + a button into the KYC flow — never a
          massive form in the profile page. Editing happens in the onboarding flow. */}
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <Text style={{ color: c.textPrimary, fontSize: 17, fontWeight: '800' }}>{t('profile.kyc.title')}</Text>
          <Badge tone={kycComplete ? 'success' : 'warning'} label={kycComplete ? t('profile.kyc.complete') : t('profile.kyc.incomplete')} />
        </View>
        <Text style={{ color: c.textMuted, fontSize: 13, marginBottom: 12 }}>{t('profile.kyc.detail')}</Text>
        <View style={{ gap: 8, marginBottom: 14 }}>
          <SummaryRow c={c} label={t('profile.kyc.name')} value={name || (user?.email?.split('@')[0] ?? '—')} />
          <SummaryRow c={c} label={t('profile.kyc.path')} value={pathLine} />
          <SummaryRow c={c} label={t('profile.kyc.languagesRow')} value={langLine} />
          <SummaryRow c={c} label={t('profile.kyc.goalsRow')} value={`${goals.length} ${t('profile.kyc.goalsN')}`} />
        </View>
        <Button label={t('profile.kyc.verify')} variant="secondary" icon="→" onPress={() => router.push('/onboarding')} />
      </Card>

      {/* Interface-language selector (§21): premium, accessible, drives the whole
          UI language via i18n setLocale (persisted). */}
      <Card>
        <LocalePicker />
      </Card>

      {/* Kept in-profile: AI-teacher posture + the read-only cognitive summary. */}
      <View style={grid}>
        <View style={cell}>
          <TeacherConfig tone={teacher.tone} explanations={teacher.explanations}
            onTone={(v: NonNullable<KycTeacher['tone']>) => patch('teacher', { tone: v })}
            onExplanations={(v: NonNullable<KycTeacher['explanations']>) => patch('teacher', { explanations: v })} />
        </View>
        <View style={cell}>
          <CognitiveSummary strengths={strengths} retention={stats?.retention ?? twin?.summary.averageMastery ?? null} dailyMinutes={Math.max(10, Math.round(((stats?.due ?? 0) * 25) / 60) || 15)} />
        </View>
      </View>

      <SystemConfig scheme={scheme} onScheme={setScheme} totalConcepts={twin?.summary.totalConcepts ?? 0} reviews={stats?.reviewsToday ?? 0}
        onPrivacy={() => router.push('/privacy')} onMemory={() => router.push('/memory')} />

      <Card>
        <Button label={t('profile.manageSubscription')} variant="secondary" onPress={() => router.push('/subscription')} />
        <View style={{ height: 8 }} />
        <Button label={t('app.signOut')} variant="ghost" onPress={logout} />
      </Card>

      <Text style={{ color: c.textMuted, fontSize: 12, textAlign: 'center', marginTop: 4 }}>
        {t('profile.footer')}
      </Text>
    </ScrollView>
  );
}

/** One read-only "label — value" line inside the compact KYC card. */
function SummaryRow({ c, label, value }: { c: { textMuted: string; textPrimary: string }; label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
      <Text style={{ color: c.textMuted, fontSize: 13 }}>{label}</Text>
      <Text style={{ color: c.textPrimary, fontSize: 13, fontWeight: '600', flexShrink: 1, textAlign: 'right' }} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 16, width: '100%', alignSelf: 'center', paddingBottom: 48 },
});
