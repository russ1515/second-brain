import { CommercialControlCenter } from '../../components/CommercialControlCenter';

/** Static commercial route takes precedence over the legacy placeholder. */
export default function Plans() {
  return <CommercialControlCenter initialSection="plans" />;
}
