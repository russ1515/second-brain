import { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Platform, ScrollView, Text, View } from 'react-native';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { useFocusEffect, useRouter } from 'expo-router';
import type {
  OnboardingAnswers,
  OnboardingState,
  StrengthsWeaknesses,
  SubscriptionView,
  TwinOverview,
  UsageView,
} from '@second-brain/shared';
import { api } from '../../lib/client';
import { useAuth } from '../../lib/auth-context';
import { useI18n, type TranslationKey } from '../../lib/i18n';
import { useTheme, useTokens } from '../../lib/design/theme';
import { Alert, Badge, Button, Card } from '../../components/ds/core';
import { Sheet } from '../../components/ds/overlays';
import { Page, PageHeader, ResponsiveSplit, Section } from '../../components/ds/layout';
import { SmartLoadingState, SmartState } from '../../components/ds/states';
import { categoryLabel } from '../../lib/onboarding/catalog';
import { LocalePicker } from '../../components/locale-picker';
import { clearAvatarPhoto, loadAvatarPhoto, pickPhoto, saveAvatarPhoto } from '../../lib/profile/photo';
import { AdaptiveTeacherConfig, ProfilePhoto } from '../../components/profile/components';
import { CameraCapture } from '../../components/capture/camera-capture';
import type { CapturedImage } from '../../lib/capture/types';
import {
  AccountUsageCard,
  BrainProfilePreview,
  DataPrivacyCard,
  LanguageExperienceCard,
} from '../../components/profile/account';

/**
 * Account control centre. Detailed mastery and Learning DNA deliberately remain
 * in My Brain; this screen owns identity, preferences, languages, billing and
 * privacy entry points.
 */
export default function ProfileScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const { user, logout, refreshOnboarding } = useAuth();
  const { colors: c } = useTokens();
  const { scheme, setScheme } = useTheme();

  const [kyc, setKyc] = useState<OnboardingState | null>(null);
  const [twin, setTwin] = useState<TwinOverview | null>(null);
  const [sw, setSw] = useState<StrengthsWeaknesses | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionView | null>(null);
  const [usage, setUsage] = useState<UsageView | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [avatarCameraOpen, setAvatarCameraOpen] = useState(false);
  const [avatarDraft, setAvatarDraft] = useState<CapturedImage | null>(null);
  const [avatarRotation, setAvatarRotation] = useState<0 | 90 | 180 | 270>(0);
  const [avatarZoom, setAvatarZoom] = useState(1);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [partial, setPartial] = useState(false);
  const profilePatchQueue = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    let cancel = false;
    loadAvatarPhoto()
      .then((value) => { if (!cancel) setPhoto(value); })
      .catch(() => { if (!cancel) setAvatarError(t('profile.avatar.loadError')); });
    return () => { cancel = true; };
  }, [t, user?.id]);

  useEffect(() => () => {
    if (avatarDraft?.uri.startsWith('blob:')) URL.revokeObjectURL(avatarDraft.uri);
  }, [avatarDraft]);

  const load = useCallback(async (active: () => boolean = () => true) => {
    setLoading(true);
    const results = await Promise.allSettled([
        api<OnboardingState>('/onboarding'),
        api<TwinOverview>('/twin'),
        api<StrengthsWeaknesses>('/twin/strengths'),
        api<SubscriptionView>('/subscription'),
        api<UsageView>('/usage'),
      ]);
    if (!active()) return;
    const [kycResult, twinResult, strengthsResult, subscriptionResult, usageResult] = results;
    if (kycResult.status === 'fulfilled') setKyc(kycResult.value);
    if (twinResult.status === 'fulfilled') setTwin(twinResult.value);
    if (strengthsResult.status === 'fulfilled') setSw(strengthsResult.value);
    if (subscriptionResult.status === 'fulfilled') setSubscription(subscriptionResult.value);
    if (usageResult.status === 'fulfilled') setUsage(usageResult.value);
    setPartial(results.some((result) => result.status === 'rejected'));
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => {
    let active = true;
    void load(() => active);
    return () => { active = false; };
  }, [load]));

  const answers = kyc?.answers ?? {};
  const identity = answers.identity ?? {};
  const education = (answers.education ?? {}) as OnboardingAnswers['education'] & { faculty?: string; option?: string };
  const languages = answers.languages ?? {};
  const teacher = answers.teacher ?? {};
  const goals = (answers.goals ?? []) as string[];

  /** PATCH a KYC section (object merge or list replace) + refresh (task 1.8). */
  const patch = useCallback(
    <K extends keyof OnboardingAnswers>(
      section: K,
      value: OnboardingAnswers[K],
    ): Promise<OnboardingState | null> => {
      const execute = async (): Promise<OnboardingState | null> => {
        setSettingsError(null);
        try {
          const saved = await api<OnboardingState>('/onboarding', {
            method: 'PUT',
            body: { answers: { [section]: value } },
          });
          setKyc(saved);
          await refreshOnboarding?.();
          return saved;
        } catch {
          setSettingsError(t('profile.settings.saveError'));
          return null;
        }
      };
      const pending = profilePatchQueue.current.then(execute, execute);
      profilePatchQueue.current = pending.then(() => undefined, () => undefined);
      return pending;
    },
    [refreshOnboarding, t],
  );

  const onPick = async (source: 'camera' | 'gallery') => {
    if (source === 'camera') {
      setAvatarCameraOpen(true);
      return;
    }
    setBusy(true);
    setAvatarError(null);
    try {
      const result = await pickPhoto(source);
      if (result.ok) {
        setAvatarDraft(result.image);
        setAvatarRotation(0);
        setAvatarZoom(1);
      }
      else if (result.reason !== 'cancelled') setAvatarError(t(`profile.avatar.${result.reason}` as TranslationKey));
    } catch {
      setAvatarError(t('profile.avatar.saveError'));
    } finally {
      setBusy(false);
    }
  };
  const editCapturedAvatar = (image: CapturedImage) => {
    setAvatarDraft(image);
    setAvatarRotation(0);
    setAvatarZoom(1);
    setAvatarCameraOpen(false);
  };
  const storeCapturedAvatar = async () => {
    if (!avatarDraft || !user?.id) return;
    setBusy(true);
    setAvatarError(null);
    let generatedUri: string | null = null;
    try {
      const edge = Math.max(1, Math.floor(Math.min(avatarDraft.width, avatarDraft.height) / avatarZoom));
      const result = await manipulateAsync(avatarDraft.uri, [
        { crop: {
          originX: Math.max(0, Math.floor((avatarDraft.width - edge) / 2)),
          originY: Math.max(0, Math.floor((avatarDraft.height - edge) / 2)),
          width: edge,
          height: edge,
        } },
        ...(avatarRotation ? [{ rotate: avatarRotation }] : []),
      ], { compress: 0.9, format: SaveFormat.JPEG });
      generatedUri = result.uri;
      // Persist the identity mutation first. If it fails, the server-side
      // avatar has not been touched and the previous photo remains intact.
      const identitySaved = await patch('identity', { avatarEmoji: '' });
      if (!identitySaved) {
        setAvatarError(t('profile.avatar.saveError'));
        return;
      }
      const stored = await saveAvatarPhoto(user.id, {
        ...avatarDraft,
        uri: result.uri,
        width: result.width,
        height: result.height,
        mimeType: 'image/jpeg',
        name: avatarDraft.name.replace(/\.[^.]+$/, '.jpg'),
        file: undefined,
      });
      setPhoto(stored);
      setAvatarDraft(null);
    } catch {
      setAvatarError(t('profile.avatar.saveError'));
    } finally {
      if (generatedUri?.startsWith('blob:')) URL.revokeObjectURL(generatedUri);
      setBusy(false);
    }
  };
  const onChooseAvatar = async (emoji: string) => {
    if (!user?.id) return;
    setBusy(true);
    setAvatarError(null);
    try {
      const identitySaved = await patch('identity', { avatarEmoji: emoji });
      if (!identitySaved) {
        setAvatarError(t('profile.avatar.removeError'));
        return;
      }
      await clearAvatarPhoto(user.id);
      setPhoto(null);
    } catch {
      setAvatarError(t('profile.avatar.removeError'));
    } finally {
      setBusy(false);
    }
  };
  const onRemove = async () => {
    if (!user?.id) return;
    setBusy(true);
    setAvatarError(null);
    try {
      const identitySaved = await patch('identity', { avatarEmoji: '' });
      if (!identitySaved) {
        setAvatarError(t('profile.avatar.removeError'));
        return;
      }
      await clearAvatarPhoto(user.id);
      setPhoto(null);
    } catch {
      setAvatarError(t('profile.avatar.removeError'));
    } finally {
      setBusy(false);
    }
  };

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

  const photoHeader = (
    <View style={{ alignItems: 'center', gap: 6, marginTop: 6 }}>
      <ProfilePhoto photoUri={photo} avatarEmoji={identity.avatarEmoji} name={name} busy={busy} onPick={onPick} onChooseAvatar={onChooseAvatar} onRemove={onRemove} />
      <Text style={{ color: c.textPrimary, fontSize: 22, fontWeight: '800' }}>{name || user?.email?.split('@')[0]}</Text>
      <Text style={{ color: c.textMuted, fontSize: 13 }}>{user?.email ?? ''}</Text>
      <Badge tone={user?.emailVerified ? 'success' : 'warning'} label={user?.emailVerified ? t('profile.email.verified') : t('profile.email.unverified')} />
      <Button size="sm" variant="secondary" label={t('profile.edit')} onPress={() => router.push('/onboarding')} />
    </View>
  );

  const kycCard = (
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
      <Button label={t('profile.edit')} variant="secondary" icon="→" onPress={() => router.push('/onboarding')} />
    </Card>
  );

  if (loading && !kyc && !subscription && !usage) {
    return <SmartLoadingState title={t('state.loading')} />;
  }

  return (
    <ScrollView style={{ backgroundColor: c.background }}>
      <Page width="content" style={{ paddingBottom: 48 }}>
        <PageHeader title={t('profile.title')} description={t('profile.intro')} />

        {partial ? <SmartState state="partial" detail={t('profile.partial')} /> : null}
        {settingsError ? <Alert tone="error" title={settingsError} detail={t('profile.settings.preserved')} /> : null}
        {avatarError ? <Alert tone="error" title={avatarError} detail={t('profile.avatar.preserved')} /> : null}

        <ResponsiveSplit
          secondaryWidth={400}
          primary={(
            <View style={{ gap: 24 }}>
              <Section title={t('profile.section.myProfile')} description={t('profile.section.myProfileDetail')}>
                <View style={{ gap: 16 }}>
                  {photoHeader}
                  {kycCard}
                </View>
              </Section>

              <Section title={t('profile.section.personalization')} description={t('profile.section.personalizationDetail')}>
                <View style={{ gap: 12 }}>
                  <AdaptiveTeacherConfig
                    value={teacher}
                    onChange={(value) => void patch('teacher', value)}
                  />
                  <BrainProfilePreview
                    totalConcepts={twin?.summary.totalConcepts ?? null}
                    strengths={strengths}
                    onOpen={() => router.push('/brain')}
                  />
                </View>
              </Section>
            </View>
          )}
          secondary={(
            <View style={{ gap: 24 }}>
              <Section title={t('profile.section.languages')} description={t('profile.section.languagesDetail')}>
                <View style={{ gap: 12 }}>
                  <Card><LocalePicker /></Card>
                  <LanguageExperienceCard
                    nativeLanguage={languages.native}
                    learningLanguage={languages.study}
                    onOpen={() => router.push('/languages')}
                  />
                </View>
              </Section>

              <Section title={t('profile.section.billing')} description={t('profile.section.billingDetail')}>
                <AccountUsageCard
                  subscription={subscription}
                  usage={usage}
                  onSubscription={() => router.push('/subscription')}
                  onUsage={() => router.push('/usage')}
                />
              </Section>

              <Section title={t('profile.section.privacy')} description={t('profile.section.privacyDetail')}>
                <View style={{ gap: 12 }}>
                  {Platform.OS === 'web' ? (
                    <Card style={{ gap: 10 }} testID="profile-mfa-card">
                      <Text style={{ color: c.textPrimary, fontSize: 16, fontWeight: '800' }}>{t('mfa.profileTitle')}</Text>
                      <Text style={{ color: c.textSecondary, fontSize: 13, lineHeight: 19 }}>{t('mfa.profileDetail')}</Text>
                      <Button label={t('mfa.open')} variant="secondary" onPress={() => router.push('/two-factor')} />
                    </Card>
                  ) : null}
                  <DataPrivacyCard
                    scheme={scheme}
                    onScheme={setScheme}
                    onPrivacy={() => router.push('/privacy')}
                    onMemory={() => router.push('/memory')}
                    onDocuments={() => router.push('/library')}
                  />
                </View>
              </Section>

              <Section title={t('report.profileTitle')} description={t('report.profileDetail')}>
                <Card style={{ gap: 10 }}>
                  <Text style={{ color: c.textSecondary, fontSize: 13, lineHeight: 19 }}>
                    {t('report.contextDetail')}
                  </Text>
                  <Button label={t('report.open')} variant="secondary" onPress={() => router.push('/report-problem')} />
                </Card>
              </Section>

              <Button label={t('app.signOut')} variant="ghost" onPress={() => void logout()} />
            </View>
          )}
        />

        <Sheet visible={avatarCameraOpen} onClose={() => { if (!busy) setAvatarCameraOpen(false); }} title={t('profile.card.photo')}>
          <CameraCapture
            mode="avatar"
            onCapture={editCapturedAvatar}
            onCancel={() => setAvatarCameraOpen(false)}
            onImport={() => { setAvatarCameraOpen(false); void onPick('gallery'); }}
          />
        </Sheet>

        <Sheet visible={Boolean(avatarDraft)} onClose={() => { if (!busy) setAvatarDraft(null); }} title={t('profile.avatar.editorTitle')}>
          {avatarDraft ? (
            <View style={{ gap: 12 }}>
              <View style={{ width: 260, height: 260, maxWidth: '100%', borderRadius: 999, overflow: 'hidden', alignSelf: 'center', backgroundColor: c.surfaceSunken }}>
                <Image
                  source={{ uri: avatarDraft.uri }}
                  resizeMode="cover"
                  style={{ width: '100%', height: '100%', transform: [{ scale: avatarZoom }, { rotate: `${avatarRotation}deg` }] }}
                />
              </View>
              <Text style={{ color: c.textMuted, textAlign: 'center' }}>{t('profile.avatar.editorDetail')}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
                <Button size="sm" variant="secondary" label={t('profile.avatar.rotate')} onPress={() => setAvatarRotation((value) => ((value + 90) % 360) as 0 | 90 | 180 | 270)} />
                <Button size="sm" variant="secondary" label={t('profile.avatar.zoomOut')} disabled={avatarZoom <= 1} onPress={() => setAvatarZoom((value) => Math.max(1, Number((value - 0.1).toFixed(1))))} />
                <Button size="sm" variant="secondary" label={t('profile.avatar.zoomIn')} disabled={avatarZoom >= 1.5} onPress={() => setAvatarZoom((value) => Math.min(1.5, Number((value + 0.1).toFixed(1))))} />
              </View>
              <Button label={t('profile.avatar.confirm')} loading={busy} onPress={() => void storeCapturedAvatar()} />
              <Button variant="ghost" label={t('learn5.cancel')} disabled={busy} onPress={() => setAvatarDraft(null)} />
            </View>
          ) : null}
        </Sheet>

        <Text style={{ color: c.textMuted, fontSize: 12, textAlign: 'center' }}>{t('profile.footer')}</Text>
      </Page>
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
