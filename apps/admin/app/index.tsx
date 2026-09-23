import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../contexts/auth';
export default function Index() {
  const auth = useAuth();
  if (auth.loading) return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator /></View>;
  return <Redirect href={auth.identity ? '/dashboard' : '/login'} />;
}
