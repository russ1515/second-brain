import { useEffect, useRef } from 'react';
import { ScrollView } from 'react-native';
import type { ErrorBoundaryProps } from 'expo-router';
import { captureSafeClientError } from '../lib/client-diagnostics';
import { createClientRequestId } from '../lib/request-id';
import { ThemeProvider, useTokens } from '../lib/design/theme';
import { I18nProvider, useI18n } from '../lib/i18n';
import { Button, EmptyState } from './ds/core';

/**
 * App-wide error fallback (Zero-blank-page, §35).
 *
 * Wired as the root route's `ErrorBoundary` export, so any render error in any
 * screen shows this localized, on-brand recovery UI with a working retry —
 * never a white screen. expo-router renders this OUTSIDE the layout's provider
 * tree, so it re-establishes ThemeProvider + I18nProvider itself to keep the
 * fallback theme-aware and translated.
 */
function Fallback({ retry }: ErrorBoundaryProps) {
  const { colors: c, spacing } = useTokens();
  const { t } = useI18n();
  // The id lives for this fallback instance, so React re-renders cannot create
  // duplicate ErrorEvents. Do not send error.message, stack or component data.
  const ingestId = useRef(createClientRequestId('boundary')).current;

  useEffect(() => {
    void captureSafeClientError({ ingestId, code: 'MOBILE_RENDER_ERROR' });
  }, [ingestId]);

  return (
    <ScrollView
      style={{ backgroundColor: c.background }}
      contentContainerStyle={{
        flexGrow: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.xl,
        gap: spacing.lg,
      }}
    >
      <EmptyState icon="⚠️" title={t('error.title')} detail={t('error.detail')} />
      <Button label={t('app.tryAgain')} onPress={retry} icon="↻" />
    </ScrollView>
  );
}

export function AppErrorBoundary(props: ErrorBoundaryProps) {
  return (
    <ThemeProvider>
      <I18nProvider>
        <Fallback {...props} />
      </I18nProvider>
    </ThemeProvider>
  );
}
