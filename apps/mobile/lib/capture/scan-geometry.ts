export type ScanCorner = 'topLeft' | 'topRight' | 'bottomRight' | 'bottomLeft';

export interface NormalizedPoint {
  x: number;
  y: number;
}

export type ScanQuadrilateral = Record<ScanCorner, NormalizedPoint>;

export interface ImageContainRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const SCAN_CORNERS: readonly ScanCorner[] = [
  'topLeft',
  'topRight',
  'bottomRight',
  'bottomLeft',
];

const DEFAULT_INSET = 0;
const MIN_EDGE = 0.06;
const MIN_AREA = 0.08;

export function defaultScanQuadrilateral(): ScanQuadrilateral {
  return {
    topLeft: { x: DEFAULT_INSET, y: DEFAULT_INSET },
    topRight: { x: 1 - DEFAULT_INSET, y: DEFAULT_INSET },
    bottomRight: { x: 1 - DEFAULT_INSET, y: 1 - DEFAULT_INSET },
    bottomLeft: { x: DEFAULT_INSET, y: 1 - DEFAULT_INSET },
  };
}

export function clampNormalizedPoint(point: NormalizedPoint): NormalizedPoint {
  return {
    x: Math.min(1, Math.max(0, point.x)),
    y: Math.min(1, Math.max(0, point.y)),
  };
}

function points(quad: ScanQuadrilateral): NormalizedPoint[] {
  return SCAN_CORNERS.map((corner) => quad[corner]);
}

function cross(a: NormalizedPoint, b: NormalizedPoint, c: NormalizedPoint): number {
  return (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
}

function distance(a: NormalizedPoint, b: NormalizedPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function scanQuadrilateralArea(quad: ScanQuadrilateral): number {
  const p = points(quad);
  let twiceArea = 0;
  for (let index = 0; index < p.length; index += 1) {
    const next = p[(index + 1) % p.length];
    twiceArea += p[index].x * next.y - next.x * p[index].y;
  }
  return Math.abs(twiceArea) / 2;
}

/** The fixed TL → TR → BR → BL order must describe a sizeable, convex page.
 * Keeping this validation on the client prevents handles crossing each other;
 * the API repeats the check and remains authoritative. */
export function isValidScanQuadrilateral(quad: ScanQuadrilateral): boolean {
  const p = points(quad);
  if (p.some((point) => !Number.isFinite(point.x) || !Number.isFinite(point.y) ||
    point.x < 0 || point.x > 1 || point.y < 0 || point.y > 1)) return false;
  if (scanQuadrilateralArea(quad) < MIN_AREA) return false;
  for (let index = 0; index < p.length; index += 1) {
    if (distance(p[index], p[(index + 1) % p.length]) < MIN_EDGE) return false;
    // Screen coordinates grow downwards, so a correctly ordered convex page
    // has a positive turn at every corner.
    if (cross(p[index], p[(index + 1) % p.length], p[(index + 2) % p.length]) <= 0.001) {
      return false;
    }
  }
  return true;
}

export function moveScanCorner(
  quad: ScanQuadrilateral,
  corner: ScanCorner,
  candidate: NormalizedPoint,
): ScanQuadrilateral {
  const next = { ...quad, [corner]: clampNormalizedPoint(candidate) };
  return isValidScanQuadrilateral(next) ? next : quad;
}

export function containedImageRect(
  containerWidth: number,
  containerHeight: number,
  imageWidth: number,
  imageHeight: number,
): ImageContainRect {
  if (containerWidth <= 0 || containerHeight <= 0 || imageWidth <= 0 || imageHeight <= 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }
  const scale = Math.min(containerWidth / imageWidth, containerHeight / imageHeight);
  const width = imageWidth * scale;
  const height = imageHeight * scale;
  return {
    x: (containerWidth - width) / 2,
    y: (containerHeight - height) / 2,
    width,
    height,
  };
}
