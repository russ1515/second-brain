import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '../contexts/auth';
import { AdminUiProvider } from '../contexts/admin-ui';
import { ErrorBoundary } from '../components/ErrorBoundary';

export default function RootLayout() {
  return <AdminUiProvider><ErrorBoundary><AuthProvider><StatusBar style="auto" /><Stack screenOptions={{ headerShown: false }} /></AuthProvider></ErrorBoundary></AdminUiProvider>;
}
