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
import { useTheme, useTokens } from '../../lib/design/theme';
import { useResponsive } from '../../lib/responsive';
import { Button, Card } from '../../components/ds/core';
import { clearAvatarPhoto, loadAvatarPhoto, pickPhoto, saveAvatarPhoto } from '../../lib/profile/photo';
import { CognitiveSummary, LanguagesCard, ProfilePhoto, SystemConfig, TeacherConfig } from '../../components/profile/components';
import { AcademicPathCard, GoalsCard, IdentityFull, LearnedLanguages } from '../../components/profile/kyc';

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
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [birth, setBirth] = useState('');
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

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
      if (k.status === 'fulfilled') {
        setKyc(k.value);
        const id = k.value.answers.identity ?? {};
        setFirst(id.firstName ?? (user?.displayName?.split(' ')[0] ?? ''));
        setLast(id.lastName ?? (user?.displayName?.split(' ').slice(1).join(' ') ?? ''));
        setBirth((id as { birthDate?: string }).birthDate ?? '');
      }
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

  /** Debounced text-field patch. */
  const debounced = (key: string, fn: () => void) => {
    if (timers.current[key]) clearTimeout(timers.current[key]);
    timers.current[key] = setTimeout(fn, 700);
  };
  const onFirst = (v: string) => { setFirst(v); debounced('first', () => patch('identity', { firstName: v })); };
  const onLast = (v: string) => { setLast(v); debounced('last', () => patch('identity', { lastName: v })); };
  const onBirth = (v: string) => { setBirth(v); debounced('birth', () => patch('identity', { birthDate: v } as OnboardingAnswers['identity'])); };

  const onPick = async (source: 'camera' | 'gallery') => {
    setBusy(true);
    const res = await pickPhoto(source);
    setBusy(false);
    if (res.ok) { setPhoto(res.uri); await saveAvatarPhoto(res.uri); }
  };
  const onChooseAvatar = (emoji: string) => { setPhoto(null); void clearAvatarPhoto(); void patch('identity', { avatarEmoji: emoji }); };
  const onRemove = () => { setPhoto(null); void clearAvatarPhoto(); void patch('identity', { avatarEmoji: '' }); };

  const name = [first, last].filter(Boolean).join(' ');
  const strengths = (sw?.strengths ?? []).map((s) => s.name);

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

      {/* 2×2 (desktop) / stacked (mobile) */}
      <View style={grid}>
        <View style={cell}>
          <IdentityFull firstName={first} lastName={last} birthDate={birth} category={education?.category as LearningCategory | undefined}
            onFirst={onFirst} onLast={onLast} onBirth={onBirth} onCategory={(v) => patch('education', { category: v })} />
        </View>
        <View style={cell}>
          <AcademicPathCard education={education ?? {}} onChange={(k, v) => patch('education', { [k]: v } as OnboardingAnswers['education'])} />
        </View>
        <View style={cell}>
          <LanguagesCard native={languages.native} study={languages.study} mobility={languages.studyingInForeignLanguage ?? false} onToggleMobility={(v) => patch('languages', { studyingInForeignLanguage: v })} />
          <View style={{ height: 14 }} />
          <Card><LearnedLanguages languages={(languages.others ?? []) as string[]} onChange={(v) => patch('languages', { others: v })} /></Card>
        </View>
        <View style={cell}>
          <GoalsCard goals={goals} onToggle={(v) => patch('goals', v)} />
        </View>
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
        <Button label="Gérer mon abonnement" variant="secondary" onPress={() => router.push('/subscription')} />
        <View style={{ height: 8 }} />
        <Button label="Se déconnecter" variant="ghost" onPress={logout} />
      </Card>

      <Text style={{ color: c.textMuted, fontSize: 12, textAlign: 'center', marginTop: 4 }}>
        Tes modifications mettent aussitôt à jour ton Professeur IA et ton Digital Twin dans toute l’app.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 16, width: '100%', alignSelf: 'center', paddingBottom: 48 },
});
