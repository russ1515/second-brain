import { useCallback, useEffect, useMemo, useState } from 'react';
import { Redirect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Image, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { api, apiUpload } from '../lib/client';
import {
  clientAppVersion,
  clientBuildVersion,
  clientPlatform,
  featureForSafeRoute,
  getRecentSafeTelemetryRequestId,
  getSafeReportOriginRoute,
  REPORT_MAX_MESSAGE_LENGTH,
  REPORT_MIN_MESSAGE_LENGTH,
  sanitizeReportMessage,
} from '../lib/client-diagnostics';
import { createClientRequestId } from '../lib/request-id';
import { appendPickedDocument } from '../lib/document-import';
import type { CapturedImage } from '../lib/capture/types';
import { useAuth } from '../lib/auth-context';
import { useTokens } from '../lib/design/theme';
import type { ColorScale } from '../lib/design/tokens';
import { useI18n, type TranslationKey } from '../lib/i18n';
import { Badge, Button, Card } from '../components/ds/core';
import { Page, PageHeader, Section } from '../components/ds/layout';
import { SmartLoadingState } from '../components/ds/states';
import { CameraCapture } from '../components/capture/camera-capture';

const REPORT_CATEGORIES = [
  'bug',
  'usage_problem',
  'account',
  'ai_teacher',
  'document_scan',
  'language_translation',
  'other',
] as const;

type ReportCategory = (typeof REPORT_CATEGORIES)[number];

type UserReportStatus = 'RECEIVED' | 'IN_REVIEW' | 'NEEDS_INFORMATION' | 'RESOLVED' | 'CLOSED';

interface CreatedReport {
  id: string;
  trackingId: string;
  status: UserReportStatus;
  screenshotAvailable: boolean;
}

interface UserReportSummary {
  trackingId: string;
  category: string;
  status: UserReportStatus;
  correlationStatus: string;
  screenshotAvailable: boolean;
  createdAt: string;
  updatedAt: string;
}

interface UserReportPage {
  items: UserReportSummary[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

function interpolate(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? `{${key}}`));
}

/** Authenticated learner report entry. A single image can be attached only
 * after an explicit learner action; automatic capture remains prohibited. */
export default function ReportProblemScreen() {
  const { colors: c, spacing, typography, radius } = useTokens();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { t, formatLocale } = useI18n();
  const { user, loading } = useAuth();
  const [category, setCategory] = useState<ReportCategory>('bug');
  const [message, setMessage] = useState('');
  const [capture, setCapture] = useState<CapturedImage | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(false);
  const [trackingId, setTrackingId] = useState<string | null>(null);
  const [pendingCaptureReportId, setPendingCaptureReportId] = useState<string | null>(null);
  const [error, setError] = useState<'minimum' | 'submit' | 'capture' | 'captureSelection' | null>(null);
  const [reports, setReports] = useState<UserReportSummary[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [reportsError, setReportsError] = useState(false);

  const loadReports = useCallback(async () => {
    if (!user) return;
    setReportsLoading(true);
    setReportsError(false);
    try {
      const page = await api<UserReportPage>('/reports?page=1&pageSize=20');
      setReports(page.items);
    } catch {
      setReportsError(true);
    } finally {
      setReportsLoading(false);
    }
  }, [user]);

  useEffect(() => { void loadReports(); }, [loadReports]);

  if (loading) return <SmartLoadingState title={t('state.loading')} />;
  if (!user) return <Redirect href={{ pathname: '/sign-in', params: { returnTo: '/report-problem' } }} />;
  if (cameraOpen) {
    return (
      <CameraCapture
        mode="document"
        onCapture={(image) => { setCapture(image); setCameraOpen(false); setError(null); }}
        onCancel={() => setCameraOpen(false)}
        onImport={() => { setCameraOpen(false); void pickCapture(); }}
      />
    );
  }

  const sanitizedMessage = sanitizeReportMessage(message);
  const validDescription = sanitizedMessage.length >= REPORT_MIN_MESSAGE_LENGTH;
  const canSubmit = validDescription && !busy && !pendingCaptureReportId;

  async function pickCapture() {
    try {
      if (Platform.OS !== 'web') {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.9,
      });
      const asset = result.canceled ? undefined : result.assets[0];
      if (!asset) return;
      setCapture({
        uri: asset.uri,
        name: asset.fileName ?? `support-capture-${Date.now()}.jpg`,
        mimeType: asset.mimeType ?? 'image/jpeg',
        width: asset.width,
        height: asset.height,
        size: asset.fileSize ?? null,
        ...(asset.file ? { file: asset.file } : {}),
      });
      setError(null);
    } catch {
      setError('captureSelection');
    }
  }

  const uploadCapture = async (reportId: string, image: CapturedImage) => {
    const form = new FormData();
    await appendPickedDocument(form, 'file', image);
    await apiUpload(`/reports/${encodeURIComponent(reportId)}/screenshot`, form, { method: 'PUT' });
  };

  const retryCapture = async () => {
    if (!pendingCaptureReportId || !capture || busy) return;
    setBusy(true);
    try {
      await uploadCapture(pendingCaptureReportId, capture);
      setPendingCaptureReportId(null);
      setCapture(null);
      setError(null);
      await loadReports();
    } catch {
      setError('capture');
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    setNotice(false);
    if (!validDescription) {
      setError('minimum');
      return;
    }
    setBusy(true);
    setError(null);
    const route = getSafeReportOriginRoute();
    const requestId = createClientRequestId('report');
    // This is a prior error telemetry request, not this report submission.
    // It is available only for the matching safe route, only for a few
    // minutes, and only in memory; no learner content or identity is added.
    const observedRequestId = getRecentSafeTelemetryRequestId(route);
    try {
      const created = await api<CreatedReport>('/reports', {
        method: 'POST',
        requestId,
        body: {
          category,
          message: sanitizedMessage,
          route,
          feature: featureForSafeRoute(route),
          requestId,
          observedRequestId: observedRequestId !== requestId ? observedRequestId : undefined,
          appVersion: clientAppVersion(),
          buildVersion: clientBuildVersion(),
          platform: clientPlatform(),
          consentAdditionalDiagnostics: consent,
        },
      });
      setTrackingId(created.trackingId);
      setPendingCaptureReportId(null);
      if (capture) {
        try {
          await uploadCapture(created.id, capture);
          setCapture(null);
        } catch {
          // The report itself is durable. Preserve the local image and report
          // id so retry uploads only the attachment, never a duplicate report.
          setPendingCaptureReportId(created.id);
          setError('capture');
        }
      }
      setMessage('');
      setConsent(false);
      setNotice(true);
      void loadReports();
    } catch {
      // Backend text is deliberately not rendered here: it can be untrusted or
      // contain diagnostics not appropriate for a learner-facing surface.
      setError('submit');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={{ backgroundColor: c.background }} contentContainerStyle={{ flexGrow: 1 }}>
      <Page width="content" style={{ paddingBottom: spacing.xxxl }}>
        <PageHeader title={t('report.title')} description={t('report.intro')} />

        {notice ? (
          <Card style={{ ...styles.notice, gap: spacing.xs }}>
            <Text style={[typography.h3, { color: c.success }]}>{t('report.successTitle')}</Text>
            <Text style={[typography.bodySmall, { color: c.textSecondary }]}>{t('report.successDetail')}</Text>
            {trackingId ? (
              <Text selectable style={[typography.bodySmall, { color: c.textPrimary, fontWeight: '700' }]}>
                {interpolate(t('report.tracking'), { trackingId })}
              </Text>
            ) : null}
          </Card>
        ) : null}

        {error ? (
          <Card style={{ ...styles.error, gap: spacing.xs }}>
            <Text style={[typography.bodySmall, { color: c.error }]}>
              {error === 'minimum'
                ? interpolate(t('report.minimum'), { min: REPORT_MIN_MESSAGE_LENGTH })
                : error === 'capture'
                  ? t('report.captureUploadError')
                  : error === 'captureSelection'
                    ? t('capture.error.capture')
                    : t('report.error')}
            </Text>
            {error === 'capture' && pendingCaptureReportId && capture ? (
              <Button
                label={t('report.captureRetry')}
                onPress={() => void retryCapture()}
                variant="secondary"
                loading={busy}
                accessibilityLabel={t('report.captureRetry')}
              />
            ) : null}
          </Card>
        ) : null}

        <Section title={t('report.category')}>
          <View style={styles.categories} accessibilityRole="radiogroup">
            {REPORT_CATEGORIES.map((value) => {
              const selected = value === category;
              return (
                <Pressable
                  key={value}
                  onPress={() => { setCategory(value); setError(null); }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={t(`report.category.${value}` as TranslationKey)}
                  style={({ pressed }) => [
                    styles.category,
                    {
                      backgroundColor: selected ? c.aiAccentSoft : c.surface,
                      borderColor: selected ? c.primary : c.borderSubtle,
                      opacity: pressed ? 0.86 : 1,
                    },
                  ]}
                >
                  <View style={[styles.radio, { borderColor: selected ? c.primary : c.borderStrong }]}>
                    {selected ? <View style={[styles.radioDot, { backgroundColor: c.primary }]} /> : null}
                  </View>
                  <Text style={[typography.bodySmall, { color: c.textPrimary, flex: 1, fontWeight: selected ? '700' : '500' }]}>
                    {t(`report.category.${value}` as TranslationKey)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Section>

        <Section title={t('report.description')}>
          <Card style={{ gap: spacing.sm }}>
            <TextInput
              value={message}
              onChangeText={(value) => { setMessage(value.slice(0, REPORT_MAX_MESSAGE_LENGTH)); setError(null); setNotice(false); }}
              placeholder={t('report.placeholder')}
              placeholderTextColor={c.textMuted}
              multiline
              textAlignVertical="top"
              maxLength={REPORT_MAX_MESSAGE_LENGTH}
              accessibilityLabel={t('report.description')}
              style={[styles.input, { color: c.textPrimary, backgroundColor: c.surfaceSunken, borderColor: c.border, borderRadius: radius.sm }]}
            />
            <Text style={[typography.caption, { color: c.textMuted, textAlign: 'right' }]}>
              {interpolate(t('report.counter'), { count: message.length, max: REPORT_MAX_MESSAGE_LENGTH })}
            </Text>
          </Card>
        </Section>

        <Section title={t('report.privacyTitle')}>
          <Card style={{ gap: spacing.sm }}>
            <Text style={[typography.bodySmall, { color: c.textSecondary, lineHeight: 20 }]}>{t('report.privacyDetail')}</Text>
            <View style={styles.contextHeader}>
              <Text style={[typography.bodySmall, { color: c.textPrimary, fontWeight: '700', flex: 1 }]}>{t('report.contextTitle')}</Text>
              <Badge label="NOT_INSTRUMENTED" tone="neutral" />
            </View>
            <Text style={[typography.caption, { color: c.textMuted, lineHeight: 18 }]}>{t('report.contextDetail')}</Text>
            <View style={styles.contextHeader}>
              <Text style={[typography.bodySmall, { color: c.textPrimary, fontWeight: '700', flex: 1 }]}>{t('report.attachments')}</Text>
            </View>
            <Text style={[typography.caption, { color: c.textMuted, lineHeight: 18 }]}>{t('report.attachmentsDetail')}</Text>
            {capture ? (
              <View style={{ gap: spacing.sm }}>
                <Image
                  source={{ uri: capture.uri }}
                  accessibilityLabel={t('report.captureSelected')}
                  style={styles.capturePreview}
                  resizeMode="contain"
                />
                <Text style={[typography.bodySmall, { color: c.textPrimary, fontWeight: '700' }]}>{t('report.captureSelected')}</Text>
                <Button
                  label={t('report.captureRemove')}
                  variant="ghost"
                  onPress={() => { setCapture(null); setPendingCaptureReportId(null); setError(null); }}
                />
              </View>
            ) : (
              <View style={styles.captureActions}>
                <Button label={t('capture.camera')} variant="secondary" onPress={() => setCameraOpen(true)} />
                <Button label={t('capture.importFallback')} variant="ghost" onPress={() => void pickCapture()} />
              </View>
            )}
          </Card>
        </Section>

        <Pressable
          onPress={() => setConsent((value) => !value)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: consent }}
          accessibilityLabel={t('report.consent')}
          style={({ pressed }) => [styles.consent, { opacity: pressed ? 0.85 : 1 }]}
        >
          <View style={[styles.checkbox, { borderColor: consent ? c.primary : c.borderStrong, backgroundColor: consent ? c.primary : 'transparent' }]}>
            {consent ? <Text style={{ color: c.onPrimary, fontWeight: '800', fontSize: 13 }}>✓</Text> : null}
          </View>
          <Text style={[typography.bodySmall, { color: c.textPrimary, flex: 1, lineHeight: 20 }]}>{t('report.consent')}</Text>
        </Pressable>

        <Button
          label={t('report.submit')}
          onPress={() => void submit()}
          disabled={!canSubmit}
          loading={busy}
          fullWidth
          accessibilityLabel={t('report.submit')}
        />

        <Section
          title={t('report.myReports')}
          action={<Button label={t('report.refresh')} variant="ghost" size="sm" onPress={() => void loadReports()} loading={reportsLoading} />}
        >
          {reportsError ? (
            <Card style={{ ...styles.error, gap: spacing.sm }}>
              <Text accessibilityRole="alert" style={[typography.bodySmall, { color: c.error }]}>{t('report.myReportsError')}</Text>
            </Card>
          ) : reports.length === 0 && !reportsLoading ? (
            <Card><Text style={[typography.bodySmall, { color: c.textSecondary }]}>{t('report.myReportsEmpty')}</Text></Card>
          ) : (
            <View style={{ gap: spacing.sm }}>
              {reports.map((report) => (
                <Card key={report.trackingId} style={{ gap: spacing.xs }}>
                  <View style={styles.contextHeader}>
                    <Text selectable style={[typography.bodySmall, { color: c.textPrimary, fontWeight: '700', flex: 1 }]}>{report.trackingId}</Text>
                    <Badge
                      label={t(`report.status.${report.status}` as TranslationKey)}
                      tone={report.status === 'RESOLVED' ? 'success' : report.status === 'NEEDS_INFORMATION' ? 'warning' : 'info'}
                    />
                  </View>
                  <Text style={[typography.bodySmall, { color: c.textSecondary }]}>
                    {t(`report.category.${report.category}` as TranslationKey)}
                  </Text>
                  <Text style={[typography.caption, { color: c.textMuted }]}>
                    {new Intl.DateTimeFormat(formatLocale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(report.updatedAt))}
                  </Text>
                  {report.screenshotAvailable ? <Text style={[typography.caption, { color: c.textMuted }]}>{t('report.captureSelected')}</Text> : null}
                </Card>
              ))}
            </View>
          )}
        </Section>
      </Page>
    </ScrollView>
  );
}

const makeStyles = (c: ColorScale) => StyleSheet.create({
  notice: { borderColor: c.success, backgroundColor: c.successSoft },
  error: { borderColor: c.error, backgroundColor: c.errorSoft },
  categories: { gap: 8 },
  category: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  radio: { width: 20, height: 20, borderWidth: 2, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  input: { minHeight: 150, borderWidth: 1, padding: 12, fontSize: 15, lineHeight: 22 },
  contextHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  captureActions: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  capturePreview: { width: '100%', height: 220, borderRadius: 12, backgroundColor: c.surfaceSunken },
  consent: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 8 },
  checkbox: { width: 24, height: 24, borderWidth: 2, borderRadius: 5, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
});
