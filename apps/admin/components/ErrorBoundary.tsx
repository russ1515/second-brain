import { Component, type ErrorInfo, type PropsWithChildren } from 'react';
import { Text, View } from 'react-native';
import { captureAdminFrontendError } from '../lib/bugs';
import { useAdminUi } from '../contexts/admin-ui';
import { t, type Locale } from '../lib/i18n';

export function ErrorBoundary({ children }: PropsWithChildren) {
  const { locale } = useAdminUi();
  return <LocalizedErrorBoundary locale={locale}>{children}</LocalizedErrorBoundary>;
}

class LocalizedErrorBoundary extends Component<PropsWithChildren<{ locale: Locale }>, { failed: boolean; requestId?: string }> {
  state = { failed: false, requestId: undefined as string | undefined };
  static getDerivedStateFromError(error: Error & { requestId?: string }) { return { failed: true, requestId: error.requestId }; }
  componentDidCatch(_error: Error, _info: ErrorInfo) {
    // Only a fixed, bounded telemetry shape is sent; the Error itself (stack,
    // message, component data) never crosses the client boundary.
    captureAdminFrontendError();
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return <View style={{ padding: 32 }} accessibilityRole="alert"><Text style={{ fontSize: 22, fontWeight: '700' }}>{t(this.props.locale, 'unexpectedError')}</Text><Text>{t(this.props.locale, 'retryRequest')} {t(this.props.locale, 'requestId')}: {this.state.requestId ?? t(this.props.locale, 'requestIdUnavailable')}</Text></View>;
  }
}
