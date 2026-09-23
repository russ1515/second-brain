/** Pure, cross-platform helpers used by the converged design-system layer. */

export type ResponsiveLayoutMode = 'compact' | 'medium' | 'wide';

export interface ResponsiveLayout {
  width: number;
  height: number;
  isLandscape: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  mode: ResponsiveLayoutMode;
  columns: number;
  maxContentWidth: number;
  contentPadding: number;
}

/**
 * Resolve composition from the live viewport. The output describes layout
 * intent; components remain responsible for choosing stack/split/grid.
 */
export function resolveResponsiveLayout(width: number, height: number): ResponsiveLayout {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error('Responsive layout requires positive finite dimensions.');
  }

  const isLandscape = width > height;
  const isTablet = Math.min(width, height) >= 600;
  const isDesktop = width >= 1024;
  const mode: ResponsiveLayoutMode = isDesktop ? 'wide' : width >= 600 ? 'medium' : 'compact';

  let columns: number;
  if (width >= 1000) columns = 4;
  else if (width >= 700) columns = 3;
  else if (isLandscape && width >= 560) columns = 3;
  else columns = 2;

  const maxContentWidth = width >= 1440 ? 1360 : width >= 1200 ? 1280 : isTablet ? 960 : 720;
  const contentPadding = mode === 'wide' ? 32 : mode === 'medium' ? 24 : 16;

  return {
    width,
    height,
    isLandscape,
    isTablet,
    isDesktop,
    mode,
    columns,
    maxContentWidth,
    contentPadding,
  };
}

/** Flex basis for a wrapping grid, retaining slack for the configured gap. */
export function responsiveColumnBasis(columns: number): `${number}%` {
  if (!Number.isInteger(columns) || columns < 1 || columns > 12) {
    throw new Error('Grid columns must be an integer between 1 and 12.');
  }
  return `${Math.floor((100 - (columns - 1) * 2) / columns)}%`;
}

export type UsageMeterTone = 'neutral' | 'primary' | 'warning' | 'critical';

export interface UsageMeterValue {
  used: number;
  limit: number | null;
  remaining: number | null;
  ratio: number | null;
  percent: number | null;
  unlimited: boolean;
  tone: UsageMeterTone;
}

/** Resolve display state without inventing a quota or reset date. */
export function resolveUsageMeter(
  used: number,
  limit: number | null,
  warningAt = 0.8,
): UsageMeterValue {
  if (!Number.isFinite(used) || used < 0) throw new Error('Usage must be a non-negative finite number.');
  if (limit !== null && (!Number.isFinite(limit) || limit < 0)) {
    throw new Error('Usage limit must be null or a non-negative finite number.');
  }
  if (!Number.isFinite(warningAt) || warningAt <= 0 || warningAt >= 1) {
    throw new Error('Usage warning threshold must be between 0 and 1.');
  }

  if (limit === null) {
    return {
      used,
      limit,
      remaining: null,
      ratio: null,
      percent: null,
      unlimited: true,
      tone: 'neutral',
    };
  }

  const ratio = limit === 0 ? 1 : used / limit;
  const boundedRatio = Math.max(0, Math.min(1, ratio));
  return {
    used,
    limit,
    remaining: Math.max(0, limit - used),
    ratio: boundedRatio,
    percent: Math.round(boundedRatio * 100),
    unlimited: false,
    tone: ratio >= 1 ? 'critical' : ratio >= warningAt ? 'warning' : 'primary',
  };
}

export interface SearchableLanguageOption<TCode extends string = string> {
  code: TCode;
  nativeName: string;
  displayName: string;
  searchTerms?: readonly string[];
}

function normalizedSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleLowerCase();
}

/** Search then rank active and recent languages without changing the registry. */
export function filterAndRankLanguages<TCode extends string>(
  options: readonly SearchableLanguageOption<TCode>[],
  query: string,
  activeCode?: TCode | null,
  recentCodes: readonly TCode[] = [],
): SearchableLanguageOption<TCode>[] {
  const needle = normalizedSearch(query);
  const recentRank = new Map(recentCodes.map((code, index) => [code, index]));

  return options
    .filter((option) => {
      if (!needle) return true;
      return [option.code, option.nativeName, option.displayName, ...(option.searchTerms ?? [])]
        .some((value) => normalizedSearch(value).includes(needle));
    })
    .map((option, index) => ({ option, index }))
    .sort((a, b) => {
      const aActive = a.option.code === activeCode ? 0 : 1;
      const bActive = b.option.code === activeCode ? 0 : 1;
      if (aActive !== bActive) return aActive - bActive;
      const aRecent = recentRank.get(a.option.code) ?? Number.MAX_SAFE_INTEGER;
      const bRecent = recentRank.get(b.option.code) ?? Number.MAX_SAFE_INTEGER;
      if (aRecent !== bRecent) return aRecent - bRecent;
      return a.index - b.index;
    })
    .map(({ option }) => option);
}
