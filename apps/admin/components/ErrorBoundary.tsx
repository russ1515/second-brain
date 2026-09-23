import { Component, type ErrorInfo, type PropsWithChildren } from 'react';
import { Text, View } from 'react-native';
import { captureAdminFrontendError } from '../lib/bugs';

export class ErrorBoundary extends Component<PropsWithChildren, { failed: boolean; requestId?: string }> {
  state = { failed: false, requestId: undefined as string | undefined };
  static getDerivedStateFromError(error: Error & { requestId?: string }) { return { failed: true, requestId: error.requestId }; }
  componentDidCatch(_error: Error, _info: ErrorInfo) {
    // Only a fixed, bounded telemetry shape is sent; the Error itself (stack,
    // message, component data) never crosses the client boundary.
    captureAdminFrontendError();
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return <View style={{ padding: 32 }} accessibilityRole="alert"><Text style={{ fontSize: 22, fontWeight: '700' }}>Unexpected error</Text><Text>Please retry. Request ID: {this.state.requestId ?? 'unavailable'}</Text></View>;
  }
}
