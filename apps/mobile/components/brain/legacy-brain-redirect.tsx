import { Redirect } from 'expo-router';
import type { BrainView } from '@second-brain/shared';

/** Keeps historical deep links alive while presenting one coherent Brain. */
export function LegacyBrainRedirect({ view }: { view: BrainView }) {
  return <Redirect href={{ pathname: '/brain', params: { view } }} />;
}
