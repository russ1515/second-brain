import { BadRequestException } from '@nestjs/common';
import { join } from 'node:path';
import { Worker } from 'node:worker_threads';

export type ScanCorner = 'topLeft' | 'topRight' | 'bottomRight' | 'bottomLeft';

export interface NormalizedPoint {
  x: number;
  y: number;
}

export type ScanQuadrilateral = Record<ScanCorner, NormalizedPoint>;

export interface ScanPageEdit {
  corners: ScanQuadrilateral;
}

export interface PerspectiveOutputSize {
  width: number;
  height: number;
}

export const MAX_SCAN_PAGE_EDITS = 50;
export const MAX_SCAN_PAGE_EDITS_BYTES = 64 * 1024;
export const MAX_PERSPECTIVE_OUTPUT_EDGE = 2000;
export const MAX_PERSPECTIVE_OUTPUT_PIXELS = 3_000_000;
export const MAX_PERSPECTIVE_WORKER_MS = 15_000;
const MIN_PERSPECTIVE_EDGE_PIXELS = 64;
const MIN_NORMALIZED_EDGE = 0.06;
const MIN_NORMALIZED_AREA = 0.08;
const EPSILON = 1e-8;
const CORNERS: readonly ScanCorner[] = ['topLeft', 'topRight', 'bottomRight', 'bottomLeft'];

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function parsePoint(value: unknown): NormalizedPoint | null {
  const record = asRecord(value);
  if (!record || typeof record.x !== 'number' || typeof record.y !== 'number') return null;
  if (!Number.isFinite(record.x) || !Number.isFinite(record.y)) return null;
  return { x: record.x, y: record.y };
}

function points(quad: ScanQuadrilateral): NormalizedPoint[] {
  return CORNERS.map((corner) => quad[corner]);
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

export function isValidScanQuadrilateral(quad: ScanQuadrilateral): boolean {
  const p = points(quad);
  if (p.some((point) => !Number.isFinite(point.x) || !Number.isFinite(point.y) ||
    point.x < 0 || point.x > 1 || point.y < 0 || point.y > 1)) return false;
  if (scanQuadrilateralArea(quad) < MIN_NORMALIZED_AREA) return false;
  for (let index = 0; index < p.length; index += 1) {
    if (distance(p[index], p[(index + 1) % p.length]) < MIN_NORMALIZED_EDGE) return false;
    // Coordinates use the screen/image convention (y grows downwards).
    if (cross(p[index], p[(index + 1) % p.length], p[(index + 2) % p.length]) <= 0.001) {
      return false;
    }
  }
  return true;
}

/** The mobile client still sends explicit metadata for an untouched page.
 * Detect that authoritative identity at the API boundary so the page keeps
 * the normal readability pass without paying for a projective JS warp. */
export function isIdentityScanQuadrilateral(quad: ScanQuadrilateral): boolean {
  const identity: ScanQuadrilateral = {
    topLeft: { x: 0, y: 0 },
    topRight: { x: 1, y: 0 },
    bottomRight: { x: 1, y: 1 },
    bottomLeft: { x: 0, y: 1 },
  };
  return CORNERS.every((corner) =>
    Math.abs(quad[corner].x - identity[corner].x) <= EPSILON &&
    Math.abs(quad[corner].y - identity[corner].y) <= EPSILON);
}

function parseEdit(value: unknown, index: number): ScanPageEdit {
  const record = asRecord(value);
  const cornersRecord = asRecord(record?.corners);
  if (!cornersRecord) {
    throw new BadRequestException(`Scan page edit ${index + 1} has no valid corners.`);
  }
  const corners = Object.fromEntries(CORNERS.map((corner) => [corner, parsePoint(cornersRecord[corner])])) as
    Record<ScanCorner, NormalizedPoint | null>;
  if (CORNERS.some((corner) => !corners[corner])) {
    throw new BadRequestException(`Scan page edit ${index + 1} has invalid corner coordinates.`);
  }
  const quad = corners as ScanQuadrilateral;
  if (!isValidScanQuadrilateral(quad)) {
    throw new BadRequestException(`Scan page edit ${index + 1} is not a valid convex page quadrilateral.`);
  }
  return { corners: quad };
}

/** Parse the compact multipart metadata. Absence remains backward-compatible,
 * but a supplied edit set must describe every uploaded page in the same order. */
export function parseScanPageEdits(
  value: unknown,
  pageCount: number,
): ScanPageEdit[] | undefined {
  if (value === undefined || value === '') return undefined;
  if (typeof value !== 'string') {
    throw new BadRequestException('Scan page edits must be a JSON string.');
  }
  if (Buffer.byteLength(value, 'utf8') > MAX_SCAN_PAGE_EDITS_BYTES) {
    throw new BadRequestException('Scan page edits exceed the request safety limit.');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new BadRequestException('Scan page edits must be valid JSON.');
  }
  if (!Array.isArray(parsed) || parsed.length !== pageCount || parsed.length > MAX_SCAN_PAGE_EDITS) {
    throw new BadRequestException('Scan page edits must match the uploaded page count.');
  }
  return parsed.map(parseEdit);
}

export function perspectiveOutputSize(
  inputWidth: number,
  inputHeight: number,
  quad: ScanQuadrilateral,
): PerspectiveOutputSize {
  if (!Number.isInteger(inputWidth) || !Number.isInteger(inputHeight) || inputWidth <= 0 || inputHeight <= 0) {
    throw new BadRequestException('The scan page dimensions are invalid.');
  }
  const pixel = (point: NormalizedPoint) => ({ x: point.x * (inputWidth - 1), y: point.y * (inputHeight - 1) });
  const tl = pixel(quad.topLeft);
  const tr = pixel(quad.topRight);
  const br = pixel(quad.bottomRight);
  const bl = pixel(quad.bottomLeft);
  let width = Math.round(Math.max(distance(tl, tr), distance(bl, br))) + 1;
  let height = Math.round(Math.max(distance(tl, bl), distance(tr, br))) + 1;
  if (width < MIN_PERSPECTIVE_EDGE_PIXELS || height < MIN_PERSPECTIVE_EDGE_PIXELS) {
    throw new BadRequestException('The selected scan page is too small to process safely.');
  }
  const scale = Math.min(
    1,
    MAX_PERSPECTIVE_OUTPUT_EDGE / width,
    MAX_PERSPECTIVE_OUTPUT_EDGE / height,
    Math.sqrt(MAX_PERSPECTIVE_OUTPUT_PIXELS / (width * height)),
  );
  width = Math.max(MIN_PERSPECTIVE_EDGE_PIXELS, Math.floor(width * scale));
  height = Math.max(MIN_PERSPECTIVE_EDGE_PIXELS, Math.floor(height * scale));
  return { width, height };
}

interface PerspectiveCoefficients {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
  g: number;
  h: number;
}

function perspectiveCoefficients(quad: ScanQuadrilateral): PerspectiveCoefficients {
  const p0 = quad.topLeft;
  const p1 = quad.topRight;
  const p2 = quad.bottomRight;
  const p3 = quad.bottomLeft;
  const dx1 = p1.x - p2.x;
  const dx2 = p3.x - p2.x;
  const dx3 = p0.x - p1.x + p2.x - p3.x;
  const dy1 = p1.y - p2.y;
  const dy2 = p3.y - p2.y;
  const dy3 = p0.y - p1.y + p2.y - p3.y;
  let g = 0;
  let h = 0;
  if (Math.abs(dx3) > EPSILON || Math.abs(dy3) > EPSILON) {
    const denominator = dx1 * dy2 - dx2 * dy1;
    if (Math.abs(denominator) <= EPSILON) {
      throw new BadRequestException('The scan perspective cannot be resolved.');
    }
    g = (dx3 * dy2 - dx2 * dy3) / denominator;
    h = (dx1 * dy3 - dx3 * dy1) / denominator;
  }
  return {
    a: p1.x - p0.x + g * p1.x,
    b: p3.x - p0.x + h * p3.x,
    c: p0.x,
    d: p1.y - p0.y + g * p1.y,
    e: p3.y - p0.y + h * p3.y,
    f: p0.y,
    g,
    h,
  };
}

function projectWithCoefficients(
  transform: PerspectiveCoefficients,
  u: number,
  v: number,
): NormalizedPoint {
  const divisor = transform.g * u + transform.h * v + 1;
  if (Math.abs(divisor) <= EPSILON) {
    throw new BadRequestException('The scan perspective cannot be resolved.');
  }
  return {
    x: (transform.a * u + transform.b * v + transform.c) / divisor,
    y: (transform.d * u + transform.e * v + transform.f) / divisor,
  };
}

/** Project a point from the corrected unit rectangle back into the source
 * quadrilateral. This inverse-mapping form avoids holes in the corrected page. */
export function projectUnitSquareToQuadrilateral(
  quad: ScanQuadrilateral,
  u: number,
  v: number,
): NormalizedPoint {
  return projectWithCoefficients(perspectiveCoefficients(quad), u, v);
}

export interface RawPerspectiveInput {
  data: Buffer;
  width: number;
  height: number;
  channels: number;
}

export interface RawPerspectiveOutput extends RawPerspectiveInput {}

/** Bounded bilinear projective warp. The caller processes pages sequentially;
 * output allocation and per-page pixel work are capped by the constants above. */
export function warpPerspectiveRaw(
  input: RawPerspectiveInput,
  quad: ScanQuadrilateral,
): RawPerspectiveOutput {
  if (!isValidScanQuadrilateral(quad)) {
    throw new BadRequestException('The scan page corners are invalid.');
  }
  if (!Number.isInteger(input.channels) || input.channels < 1 || input.channels > 4 ||
    input.data.length !== input.width * input.height * input.channels) {
    throw new BadRequestException('The decoded scan page buffer is invalid.');
  }
  const output = perspectiveOutputSize(input.width, input.height, quad);
  const data = Buffer.allocUnsafe(output.width * output.height * input.channels);
  const maxX = input.width - 1;
  const maxY = input.height - 1;
  // Calculate the homography once. Rebuilding it for every output pixel would
  // turn a bounded image into avoidable event-loop work.
  const transform = perspectiveCoefficients(quad);
  for (let y = 0; y < output.height; y += 1) {
    const v = output.height === 1 ? 0 : y / (output.height - 1);
    for (let x = 0; x < output.width; x += 1) {
      const u = output.width === 1 ? 0 : x / (output.width - 1);
      const divisor = transform.g * u + transform.h * v + 1;
      if (Math.abs(divisor) <= EPSILON) {
        throw new BadRequestException('The scan perspective cannot be resolved.');
      }
      const projectedX = (transform.a * u + transform.b * v + transform.c) / divisor;
      const projectedY = (transform.d * u + transform.e * v + transform.f) / divisor;
      const sourceX = Math.min(maxX, Math.max(0, projectedX * maxX));
      const sourceY = Math.min(maxY, Math.max(0, projectedY * maxY));
      const x0 = Math.floor(sourceX);
      const y0 = Math.floor(sourceY);
      const x1 = Math.min(maxX, x0 + 1);
      const y1 = Math.min(maxY, y0 + 1);
      const wx = sourceX - x0;
      const wy = sourceY - y0;
      const target = (y * output.width + x) * input.channels;
      for (let channel = 0; channel < input.channels; channel += 1) {
        const topLeft = input.data[(y0 * input.width + x0) * input.channels + channel];
        const topRight = input.data[(y0 * input.width + x1) * input.channels + channel];
        const bottomLeft = input.data[(y1 * input.width + x0) * input.channels + channel];
        const bottomRight = input.data[(y1 * input.width + x1) * input.channels + channel];
        const top = topLeft + (topRight - topLeft) * wx;
        const bottom = bottomLeft + (bottomRight - bottomLeft) * wx;
        data[target + channel] = Math.round(top + (bottom - top) * wy);
      }
    }
  }
  return { data, width: output.width, height: output.height, channels: input.channels };
}

interface PerspectiveWorkerSuccess {
  ok: true;
  output: {
    data: Uint8Array;
    width: number;
    height: number;
    channels: number;
  };
}

interface PerspectiveWorkerFailure {
  ok: false;
}

/** Run the bounded pixel loop outside Nest's event loop. Pages are still
 * awaited sequentially by ScanService, so a scan never creates eight workers
 * at once. The worker has both a V8 memory ceiling and a wall-clock deadline. */
export function warpPerspectiveRawInWorker(
  input: RawPerspectiveInput,
  quad: ScanQuadrilateral,
): Promise<RawPerspectiveOutput> {
  if (!isValidScanQuadrilateral(quad)) {
    return Promise.reject(new BadRequestException('The scan page corners are invalid.'));
  }
  // Validate dimensions and force the output-size checks before allocating a
  // worker. The worker repeats all validation as defense in depth.
  perspectiveOutputSize(input.width, input.height, quad);
  if (!Number.isInteger(input.channels) || input.channels < 1 || input.channels > 4 ||
    input.data.length !== input.width * input.height * input.channels) {
    return Promise.reject(new BadRequestException('The decoded scan page buffer is invalid.'));
  }

  return new Promise((resolve, reject) => {
    const worker = new Worker(join(__dirname, 'scan-page-transform.worker.js'), {
      workerData: { input, quad },
      resourceLimits: {
        maxOldGenerationSizeMb: 128,
        maxYoungGenerationSizeMb: 24,
        stackSizeMb: 4,
      },
    });
    let settled = false;
    const fail = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      void worker.terminate();
      reject(new BadRequestException('The scan perspective could not be processed safely.'));
    };
    const timer = setTimeout(fail, MAX_PERSPECTIVE_WORKER_MS);
    timer.unref?.();
    worker.once('message', (message: PerspectiveWorkerSuccess | PerspectiveWorkerFailure) => {
      if (settled) return;
      if (!message || message.ok !== true) {
        fail();
        return;
      }
      const { output } = message;
      if (!output || !Number.isInteger(output.width) || !Number.isInteger(output.height) ||
        !Number.isInteger(output.channels) || output.channels < 1 || output.channels > 4 ||
        output.width <= 0 || output.height <= 0 ||
        output.width > MAX_PERSPECTIVE_OUTPUT_EDGE || output.height > MAX_PERSPECTIVE_OUTPUT_EDGE ||
        output.width * output.height > MAX_PERSPECTIVE_OUTPUT_PIXELS ||
        output.data.byteLength !== output.width * output.height * output.channels) {
        fail();
        return;
      }
      settled = true;
      clearTimeout(timer);
      resolve({
        data: Buffer.from(output.data),
        width: output.width,
        height: output.height,
        channels: output.channels,
      });
      void worker.terminate();
    });
    worker.once('error', fail);
    worker.once('exit', (code) => {
      if (code !== 0) fail();
    });
  });
}
