import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../contexts/auth';
import { useAdminUi } from '../contexts/admin-ui';
import { t } from '../lib/i18n';
export default function Index() {
  const auth = useAuth();
  const { locale } = useAdminUi();
  if (auth.loading) return <View style={{ flex: 1, justifyContent: 'center' }} accessibilityLabel={t(locale, 'loadingAdmin')}><ActivityIndicator /></View>;
  return <Redirect href={auth.identity ? '/dashboard' : '/login'} />;
}
