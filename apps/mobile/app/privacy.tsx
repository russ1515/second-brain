import { useCallback, useState, useMemo } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import type {
  ConsentView,
  DataExportResponse,
  LearningReportView,
} from '@second-brain/shared';
import { api } from '../lib/client';
import { useAuth } from '../lib/auth-context';
import { useTokens } from '../lib/design/theme';
import type { ColorScale } from '../lib/design/tokens';
import { localeDirection, useI18n, type TranslationKey } from '../lib/i18n';
import { saveLearningReportAsPdf } from '../lib/learning-report-pdf';
import { Button, Card, ErrorBanner, Loading } from '../components/ui';
import { LearningResetCard } from '../components/privacy/learning-reset-card';

/** Privacy & GDPR (Sprint 8.7): consents, data export, account deletion. */
export default function PrivacyScreen() {
  const { colors: c } = useTokens();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { t, locale, formatLocale } = useI18n();
  const router = useRouter();
  const { logout } = useAuth();
  const [consents, setConsents] = useState<ConsentView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [password, setPassword] = useState('');

  const load = useCallback(async () => {
    try {
      setConsents(await api<ConsentView[]>('/me/consents'));
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const toggle = async (c: ConsentView) => {
    setBusy(c.key); setError(null);
    try {
      await api('/me/consents', { method: 'PUT', body: { key: c.key, granted: !c.granted } });
      await load();
    } catch (e) { setError((e as Error).message); } finally { setBusy(null); }
  };

  const exportData = async () => {
    setBusy('export'); setError(null); setNotice(null);
    try {
      const dump = await api<DataExportResponse>('/me/export');
      const json = JSON.stringify(dump, null, 2);
      if (Platform.OS === 'web') {
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `second-brain-export-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        setNotice(t('priv.exportDone'));
      } else {
        setNotice(t('priv.exportReady'));
      }
    } catch (e) { setError((e as Error).message); } finally { setBusy(null); }
  };

  const exportLearningReport = async () => {
    setBusy('learning-report'); setError(null); setNotice(null);
    try {
      const report = await api<LearningReportView>(
        `/me/learning-report?locale=${encodeURIComponent(locale)}`,
      );
      const ageBand = report.declared.profile.ageBand;
      await saveLearningReportAsPdf(
        report,
        {
          title: t('priv.learningReport.title'),
          subtitle: t('priv.learningReport.help'),
          generated: t('priv.learningReport.generated'),
          learnerName: t('profile.card.name'),
          declared: t('passport.source.declared'),
          observed: t('passport.source.observed'),
          assessed: t('priv.learningReport.assessed'),
          ageBand: t('onb.identity.age'),
          originCountry: t('passport.originCountry'),
          currentCountry: t('passport.currentCountry'),
          teachingLanguage: t('passport.teachingLanguage'),
          subjects: t('onb.subjects.title'),
          goals: t('onb.twin.goals'),
          preferences: t('profile.preferences'),
          learningProfile: t('passport.title'),
          lessons: t('twin.lessons'),
          tutorSessions: t('tutor6.lobby.recent'),
          concepts: t('brain8.metrics.concepts'),
          completedSessions: t('priv.learningReport.completedSessions'),
          reviews: t('brain8.memory.reviews'),
          lastActivity: t('home4.lastActivity'),
          completedLearning: t('globalPath.calendar.title'),
          knowledge: t('globalPath.evidence.knowledge'),
          understanding: t('globalPath.evidence.understanding'),
          application: t('globalPath.evidence.application'),
          reasoning: t('globalPath.evidence.reasoning'),
          criticalReflection: t('globalPath.evidence.criticalReflection'),
          perspective: t('globalPath.evidence.perspective'),
          evidenceCount: t('globalPath.evidence.evidenceCount'),
          started: t('globalPath.calendar.started'),
          finalized: t('globalPath.calendar.finalized'),
          objective: t('globalPath.calendar.objective'),
          result: t('globalPath.calendar.result'),
          noEvidence: t('priv.learningReport.noEvidence'),
          notAvailable: t('priv.learningReport.notAvailable'),
          privacyNote: t('priv.learningReport.privacyNote'),
          provenanceNote: t('priv.learningReport.provenanceNote'),
        },
        formatLocale,
        localeDirection(locale),
        ageBand ? t(`onb.age.${ageBand}` as TranslationKey) : undefined,
      );
      setNotice(t('priv.learningReport.done'));
    } catch (e) { setError((e as Error).message); } finally { setBusy(null); }
  };

  const deleteAccount = async () => {
    setBusy('delete'); setError(null);
    try {
      await api('/me/delete', { method: 'POST', body: { password } });
      await logout();
      router.replace('/');
    } catch (e) { setError((e as Error).message); } finally { setBusy(null); }
  };

  if (!consents && !error) return <Loading />;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.h1}>{t('priv.title')}</Text>
      <Text style={styles.intro}>{t('priv.intro')}</Text>
      {error ? <ErrorBanner message={error} /> : null}
      {notice ? <Card style={styles.notice}><Text style={styles.noticeText}>{notice}</Text></Card> : null}

      <Text style={styles.section}>{t('priv.controls')}</Text>
      <Card style={styles.relatedCard}>
        <View style={styles.flex}>
          <Text style={styles.rowName}>{t('priv.memory')}</Text>
          <Text style={styles.sub}>{t('priv.memoryHelp')}</Text>
        </View>
        <Button variant="ghost" label={t('profile.privacy.memory')} onPress={() => router.push('/memory')} />
      </Card>
      <Card style={styles.relatedCard}>
        <View style={styles.flex}>
          <Text style={styles.rowName}>{t('priv.documents')}</Text>
          <Text style={styles.sub}>{t('priv.documentsHelp')}</Text>
        </View>
        <Button variant="ghost" label={t('profile.privacy.documents')} onPress={() => router.push('/library')} />
      </Card>

      {/* Consents */}
      <Text style={styles.section}>{t('priv.consents')}</Text>
      {consents?.map((c) => (
        <Card key={c.key} style={styles.rowCard}>
          <View style={styles.flex}>
            <Text style={styles.rowName}>{t(`priv.consent.${c.key}` as TranslationKey)}</Text>
            <Text style={styles.sub}>{c.granted ? t('priv.granted') : t('priv.notGranted')}</Text>
          </View>
          <Button
            variant="ghost"
            label={c.granted ? t('priv.withdraw') : t('priv.grant')}
            busy={busy === c.key}
            onPress={() => toggle(c)}
          />
        </Card>
      ))}

      {/* Export */}
      <Text style={styles.section}>{t('priv.export')}</Text>
      <Card>
        <Text style={styles.rowName}>{t('priv.learningReport.title')}</Text>
        <Text style={styles.sub}>{t('priv.learningReport.help')}</Text>
        <Button
          label={t('priv.learningReport.button')}
          busy={busy === 'learning-report'}
          onPress={exportLearningReport}
        />
      </Card>
      <Card>
        <Text style={styles.sub}>{t('priv.exportHelp')}</Text>
        <Button label={t('priv.exportBtn')} busy={busy === 'export'} onPress={exportData} />
      </Card>

      <Text style={styles.section}>{t('priv.learningReset.section')}</Text>
      <LearningResetCard />

      {/* Delete */}
      <Text style={styles.section}>{t('priv.danger')}</Text>
      <Card style={styles.dangerCard}>
        <Text style={styles.sub}>{t('priv.deleteHelp')}</Text>
        {!confirmDelete ? (
          <Button variant="danger" label={t('priv.deleteBtn')} onPress={() => setConfirmDelete(true)} />
        ) : (
          <>
            <TextInput
              style={styles.input}
              placeholder={t('priv.passwordPlaceholder')}
              placeholderTextColor={c.textMuted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
            />
            <View style={styles.row}>
              <View style={styles.flex}>
                <Button variant="ghost" label={t('priv.cancel')} onPress={() => { setConfirmDelete(false); setPassword(''); }} />
              </View>
              <View style={styles.flex}>
                <Button variant="danger" label={t('priv.confirmDelete')} busy={busy === 'delete'} disabled={!password} onPress={deleteAccount} />
              </View>
            </View>
          </>
        )}
      </Card>
    </ScrollView>
  );
}

const makeStyles = (c: ColorScale) => StyleSheet.create({
  container: { padding: 20, gap: 10, maxWidth: 1280, width: '100%', alignSelf: 'center' },
  h1: { fontSize: 28, fontWeight: '700', color: c.textPrimary },
  intro: { fontSize: 14, color: c.textSecondary, lineHeight: 20, marginBottom: 4 },
  notice: { backgroundColor: c.successSoft, borderColor: c.success },
  noticeText: { color: c.success, fontSize: 14 },
  section: { fontSize: 12, fontWeight: '700', color: c.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginTop: 14 },
  rowCard: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  relatedCard: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10 },
  row: { flexDirection: 'row', gap: 10 },
  flex: { flex: 1 },
  rowName: { fontSize: 15, fontWeight: '600', color: c.textPrimary },
  sub: { fontSize: 13, color: c.textSecondary, lineHeight: 19, marginBottom: 8 },
  dangerCard: { borderColor: c.errorSoft },
  input: {
    backgroundColor: c.surfaceElevated, borderWidth: 1, borderColor: c.border,
    borderRadius: 10, padding: 12, fontSize: 15, color: c.textPrimary, marginBottom: 10,
  },
});
