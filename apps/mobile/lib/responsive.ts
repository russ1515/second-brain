import { useWindowDimensions } from 'react-native';
import {
  resolveResponsiveLayout,
  responsiveColumnBasis,
  type ResponsiveLayout,
} from '@second-brain/shared';

/**
 * Responsive layout (Sprint 10.2 — Mobile Optimization).
 *
 * One source of truth for adapting to screen size and orientation, so the same
 * code feels right on a phone (1–2 columns, portrait), a tablet (3 columns,
 * either orientation) and the web (up to 4, wider canvas). Everything derives
 * from the live window dimensions, so it reacts to rotation instantly.
 */
export interface Responsive extends ResponsiveLayout {}

export function useResponsive(): Responsive {
  const { width, height } = useWindowDimensions();
  return resolveResponsiveLayout(width, height);
}

/** Flex basis (%) for one cell in an `n`-column wrap grid, accounting for gaps. */
export function columnBasis(columns: number): `${number}%` {
  return responsiveColumnBasis(columns);
}
