import { Redirect, useLocalSearchParams } from 'expo-router';
import { BugDetail } from '../../../components/BugDetail';

/** Bug IDs are kept route-local and never rendered as a raw diagnostic value. */
export default function BugDetailRoute() {
  const { bugId } = useLocalSearchParams<{ bugId?: string }>();
  if (!bugId || Array.isArray(bugId)) return <Redirect href="/bugs" />;
  return <BugDetail key={bugId} bugId={bugId} />;
}
