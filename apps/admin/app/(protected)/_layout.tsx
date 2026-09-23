import { Redirect, Slot } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { AdminShell } from '../../components/AdminShell';
import { useAuth } from '../../contexts/auth';

export default function ProtectedLayout() {
  const auth = useAuth();
  if (auth.loading) return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator /></View>;
  if (!auth.identity) return <Redirect href="/login" />;
  return <AdminShell><Slot /></AdminShell>;
}
