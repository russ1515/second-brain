import { useMemo, useState } from 'react';
import { Redirect } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { api } from '../lib/client';
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
import { useAuth } from '../lib/auth-context';
import { useTokens } from '../lib/design/theme';
import type { ColorScale } from '../lib/design/tokens';
import { useI18n, type TranslationKey } from '../lib/i18n';
import { Badge, Button, Card } from '../components/ds/core';
import { Page, PageHeader, Section } from '../components/ds/layout';
import { SmartLoadingState } from '../components/ds/states';

const REPORT_CATEGORIES = [
  'app_not_working',
  'ai_teacher_problem',
  'document_pdf_problem',
  'voice_problem',
  'language_learning_problem',
  'revision_problem',
  'brain_digital_twin_problem',
  'subscription_payment_problem',
  'account_login_problem',
  'other',
] as const;

type ReportCategory = (typeof REPORT_CATEGORIES)[number];

function interpolate(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? `{${key}}`));
}

/**
 * Authenticated learner report entry. It intentionally supports text only:
 * screenshots, documents, conversations and audio are NOT_INSTRUMENTED by
 * design, so private learning content can never be uploaded from this flow.
 */
export default function ReportProblemScreen() {
  const { colors: c, spacing, typography, radius } = useTokens();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { t } = useI18n();
  const { user, loading } = useAuth();
  const [category, setCategory] = useState<ReportCategory>('app_not_working');
  const [message, setMessage] = useState('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(false);
  const [error, setError] = useState<'minimum' | 'submit' | null>(null);

  if (loading) return <SmartLoadingState title={t('state.loading')} />;
  if (!user) return <Redirect href={{ pathname: '/sign-in', params: { returnTo: '/report-problem' } }} />;

  const sanitizedMessage = sanitizeReportMessage(message);
  const validDescription = sanitizedMessage.length >= REPORT_MIN_MESSAGE_LENGTH;
  const canSubmit = validDescription && !busy;

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
      await api('/reports', {
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
      setMessage('');
      setConsent(false);
      setNotice(true);
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
          </Card>
        ) : null}

        {error ? (
          <Card style={{ ...styles.error, gap: spacing.xs }}>
            <Text style={[typography.bodySmall, { color: c.error }]}>
              {error === 'minimum'
                ? interpolate(t('report.minimum'), { min: REPORT_MIN_MESSAGE_LENGTH })
                : t('report.error')}
            </Text>
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
              <Badge label="NOT_INSTRUMENTED" tone="neutral" />
            </View>
            <Text style={[typography.caption, { color: c.textMuted, lineHeight: 18 }]}>{t('report.attachmentsDetail')}</Text>
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
  consent: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 8 },
  checkbox: { width: 24, height: 24, borderWidth: 2, borderRadius: 5, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
});
