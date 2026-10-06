'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');
const { ImageSafetyService } = require('../dist/media/image-safety.service.js');

const {
  MAX_PERSPECTIVE_OUTPUT_EDGE,
  MAX_PERSPECTIVE_OUTPUT_PIXELS,
  MAX_PERSPECTIVE_WORKER_MS,
  isIdentityScanQuadrilateral,
  isValidScanQuadrilateral,
  parseScanPageEdits,
  perspectiveOutputSize,
  projectUnitSquareToQuadrilateral,
  warpPerspectiveRaw,
  warpPerspectiveRawInWorker,
} = require('../dist/media/scan-page-transform.js');

const full = {
  topLeft: { x: 0, y: 0 },
  topRight: { x: 1, y: 0 },
  bottomRight: { x: 1, y: 1 },
  bottomLeft: { x: 0, y: 1 },
};

test('scan page edit metadata is bounded and must match every uploaded page', () => {
  const parsed = parseScanPageEdits(JSON.stringify([{ corners: full }, { corners: full }]), 2);
  assert.equal(parsed.length, 2);
  assert.deepEqual(parsed[0].corners, full);
  assert.equal(parseScanPageEdits(undefined, 2), undefined, 'older clients remain compatible');
  assert.throws(() => parseScanPageEdits(JSON.stringify([{ corners: full }]), 2), /match the uploaded page count/);
  assert.throws(() => parseScanPageEdits({ corners: full }, 1), /JSON string/);
  assert.throws(() => parseScanPageEdits('[' + ' '.repeat(70_000) + ']', 1), /safety limit/);
  assert.throws(() => parseScanPageEdits(JSON.stringify([{ corners: {
    ...full,
    topLeft: { x: -0.01, y: 0 },
  } }]), 1), /valid convex page quadrilateral/);
  assert.throws(() => parseScanPageEdits(JSON.stringify([{ corners: {
    topLeft: { x: 0, y: 0 },
    topRight: { x: 1, y: 1 },
    bottomRight: { x: 1, y: 0 },
    bottomLeft: { x: 0, y: 1 },
  } }]), 1), /valid convex page quadrilateral/);
});

test('projective mapping preserves corners and rectifies a trapezoid', () => {
  const trapezoid = {
    topLeft: { x: 0.2, y: 0.1 },
    topRight: { x: 0.8, y: 0.05 },
    bottomRight: { x: 0.95, y: 0.9 },
    bottomLeft: { x: 0.05, y: 0.85 },
  };
  assert.equal(isValidScanQuadrilateral(trapezoid), true);
  for (const [u, v, expected] of [
    [0, 0, trapezoid.topLeft],
    [1, 0, trapezoid.topRight],
    [1, 1, trapezoid.bottomRight],
    [0, 1, trapezoid.bottomLeft],
  ]) {
    const actual = projectUnitSquareToQuadrilateral(trapezoid, u, v);
    assert.ok(Math.abs(actual.x - expected.x) < 1e-12);
    assert.ok(Math.abs(actual.y - expected.y) < 1e-12);
  }
  const centre = projectUnitSquareToQuadrilateral(trapezoid, 0.5, 0.5);
  assert.ok(centre.x > 0.4 && centre.x < 0.6);
  assert.ok(centre.y > 0.35 && centre.y < 0.6);
});

test('identity metadata uses the authoritative no-warp fast path', () => {
  assert.equal(isIdentityScanQuadrilateral(full), true);
  assert.equal(isIdentityScanQuadrilateral({
    ...full,
    topLeft: { x: 0.001, y: 0 },
  }), false);
});

test('perspective warp performs a real bounded pixel transform', () => {
  const width = 128;
  const height = 128;
  const source = Buffer.alloc(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) source[y * width + x] = (x + y) % 256;
  }
  const identity = warpPerspectiveRaw({ data: source, width, height, channels: 1 }, full);
  assert.equal(identity.width, width);
  assert.equal(identity.height, height);
  assert.deepEqual(identity.data, source);

  const inset = {
    topLeft: { x: 0.15, y: 0.1 },
    topRight: { x: 0.8, y: 0.05 },
    bottomRight: { x: 0.9, y: 0.85 },
    bottomLeft: { x: 0.1, y: 0.9 },
  };
  const corrected = warpPerspectiveRaw({ data: source, width, height, channels: 1 }, inset);
  assert.notEqual(corrected.width, width);
  assert.notDeepEqual(corrected.data, source);

  const bounded = perspectiveOutputSize(40_000, 40_000, full);
  assert.ok(bounded.width <= MAX_PERSPECTIVE_OUTPUT_EDGE);
  assert.ok(bounded.height <= MAX_PERSPECTIVE_OUTPUT_EDGE);
  assert.ok(bounded.width * bounded.height <= MAX_PERSPECTIVE_OUTPUT_PIXELS);
});

test('near-limit perspective work stays off the API event loop and inside its deadline', async () => {
  const width = 2000;
  const height = 1500;
  const source = Buffer.alloc(width * height, 127);
  const trapezoid = {
    topLeft: { x: 0.02, y: 0.02 },
    topRight: { x: 0.98, y: 0.01 },
    bottomRight: { x: 0.99, y: 0.99 },
    bottomLeft: { x: 0.01, y: 0.98 },
  };
  let eventLoopTicks = 0;
  const heartbeat = setInterval(() => { eventLoopTicks += 1; }, 5);
  const started = performance.now();
  const corrected = await warpPerspectiveRawInWorker({
    data: source,
    width,
    height,
    channels: 1,
  }, trapezoid);
  const elapsedMs = performance.now() - started;
  clearInterval(heartbeat);
  assert.ok(corrected.width * corrected.height <= MAX_PERSPECTIVE_OUTPUT_PIXELS);
  assert.ok(eventLoopTicks > 0, 'the main event loop remains responsive during pixel work');
  assert.ok(elapsedMs < MAX_PERSPECTIVE_WORKER_MS, `worker exceeded its ${MAX_PERSPECTIVE_WORKER_MS}ms deadline`);
});

test('scan image normalization encodes the corrected readable page dimensions', async () => {
  const service = new ImageSafetyService();
  const source = await sharp({
    create: { width: 400, height: 300, channels: 3, background: '#777777' },
  })
    .composite([{ input: Buffer.from('<svg width="400" height="300"><path d="M80 30 L320 15 L360 270 L40 255 Z" fill="#888"/><path d="M100 80 L300 70" stroke="#999" stroke-width="8"/></svg>') }])
    .png()
    .toBuffer();
  const corners = {
    topLeft: { x: 0.2, y: 0.1 },
    topRight: { x: 0.8, y: 0.05 },
    bottomRight: { x: 0.9, y: 0.9 },
    bottomLeft: { x: 0.1, y: 0.85 },
  };
  const expected = perspectiveOutputSize(400, 300, corners);
  const upload = {
    originalname: 'page.png',
    mimetype: 'image/png',
    size: source.length,
    buffer: source,
  };
  const legacy = await service.scanPage(upload);
  const identity = await service.scanPage(upload, { corners: full });
  const legacyMetadata = await sharp(legacy.buffer).metadata();
  const identityMetadata = await sharp(identity.buffer).metadata();
  assert.equal(legacyMetadata.width, 400, 'clients without pageEdits keep working');
  assert.equal(legacyMetadata.height, 300);
  assert.equal(identityMetadata.width, legacyMetadata.width, 'identity edits take the fast path');
  assert.equal(identityMetadata.height, legacyMetadata.height);

  const corrected = await service.scanPage(upload, { corners });
  const metadata = await sharp(corrected.buffer).metadata();
  assert.equal(metadata.width, expected.width);
  assert.equal(metadata.height, expected.height);
  assert.equal(metadata.format, 'jpeg');
  assert.equal(metadata.exif, undefined);
  const stats = await sharp(corrected.buffer).stats();
  assert.ok(stats.channels[0].max - stats.channels[0].min > 100, 'readability normalization expands low contrast');
});

test('scan endpoint wires validated edits into durable normalization', () => {
  const root = path.resolve(__dirname, '../../..');
  const controller = fs.readFileSync(path.join(root, 'apps/api/src/documents/document.controller.ts'), 'utf8');
  const service = fs.readFileSync(path.join(root, 'apps/api/src/documents/scan.service.ts'), 'utf8');
  const safety = fs.readFileSync(path.join(root, 'apps/api/src/media/image-safety.service.ts'), 'utf8');
  assert.match(controller, /parseScanPageEdits\(pageEdits, images\.length\)/);
  assert.match(controller, /fromImages\(user\.userId, images, title, requestId, edits, \{/);
  assert.match(service, /scanPage\(files\[index\], pageEdits\?\.\[index\]\)/);
  assert.match(service, /putScanPages[\s\S]*images\.map\(\(image\) => image\.buffer\)/);
  assert.match(safety, /warpPerspectiveRaw/);
  assert.match(safety, /isIdentityScanQuadrilateral/);
  assert.match(safety, /\.normalize\(\)[\s\S]*\.sharpen\(\)/);
});
