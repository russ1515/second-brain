import { useWindowDimensions } from 'react-native';

/**
 * Responsive layout (Sprint 10.2 — Mobile Optimization).
 *
 * One source of truth for adapting to screen size and orientation, so the same
 * code feels right on a phone (1–2 columns, portrait), a tablet (3 columns,
 * either orientation) and the web (up to 4, wider canvas). Everything derives
 * from the live window dimensions, so it reacts to rotation instantly.
 */
export interface Responsive {
  width: number;
  height: number;
  isLandscape: boolean;
  /** Short side ≥ 600dp — the usual phone/tablet divide. */
  isTablet: boolean;
  /** Grid columns for feature/card grids at this size. */
  columns: number;
  /** Max content width so text lines don't stretch on wide screens. */
  maxContentWidth: number;
}

export function useResponsive(): Responsive {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const isTablet = Math.min(width, height) >= 600;

  // More usable width → more columns. Landscape earns one extra on phones.
  let columns: number;
  if (width >= 1000) columns = 4;
  else if (width >= 700) columns = 3;
  else if (isLandscape && width >= 560) columns = 3;
  else columns = 2;

  const maxContentWidth = width >= 1440 ? 1360 : width >= 1200 ? 1280 : isTablet ? 960 : 720;

  return { width, height, isLandscape, isTablet, columns, maxContentWidth };
}

/** Flex basis (%) for one cell in an `n`-column wrap grid, accounting for gaps. */
export function columnBasis(columns: number): `${number}%` {
  // Leave a little slack so `gap` doesn't push a row to wrap early.
  const pct = Math.floor((100 - (columns - 1) * 2) / columns);
  return `${pct}%`;
}
