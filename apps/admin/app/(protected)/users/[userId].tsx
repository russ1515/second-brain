import { Redirect, useLocalSearchParams } from 'expo-router';
import { UserControlCenter } from '../../../components/UserControlCenter';

export default function UserDetailRoute() {
  const { userId } = useLocalSearchParams<{ userId?: string }>();
  if (!userId || Array.isArray(userId)) return <Redirect href="/users" />;
  return <UserControlCenter key={userId} userId={userId} />;
}
