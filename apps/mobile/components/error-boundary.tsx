import { ScrollView, View } from 'react-native';
import type { ErrorBoundaryProps } from 'expo-router';
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
function Fallback({ error, retry }: ErrorBoundaryProps) {
  const { colors: c, spacing } = useTokens();
  const { t } = useI18n();
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
      {__DEV__ ? (
        <View style={{ maxWidth: 520 }}>
          <EmptyState icon="" title="" detail={error.message} />
        </View>
      ) : null}
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
