'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const { mkdtemp, readdir, rm } = require('node:fs/promises');
const sharp = require('sharp');
const { ImageSafetyService } = require('../dist/media/image-safety.service.js');
const { PrivateMediaService } = require('../dist/media/private-media.service.js');

test('avatar bytes are decoded, bounded and re-encoded without metadata', async () => {
  const service = new ImageSafetyService();
  const input = await sharp({ create: { width: 80, height: 60, channels: 3, background: '#336699' } })
    .withMetadata({ orientation: 6 })
    .png()
    .toBuffer();
  const normalized = await service.avatar({ originalname: 'avatar.txt', mimetype: 'text/plain', size: input.length, buffer: input });
  const metadata = await sharp(normalized.buffer).metadata();
  assert.equal(normalized.mimeType, 'image/webp');
  assert.equal(metadata.format, 'webp');
  assert.equal(metadata.width, 512);
  assert.equal(metadata.height, 512);
  assert.equal(metadata.exif, undefined);
  await assert.rejects(
    service.avatar({ originalname: 'fake.jpg', mimetype: 'image/jpeg', size: 8, buffer: Buffer.from('not-image') }),
    /valid supported image/i,
  );
});

test('scan pages are orientation-normalized, metadata-free and size-bounded', async () => {
  const service = new ImageSafetyService();
  const input = await sharp({ create: { width: 3000, height: 1200, channels: 3, background: '#ffffff' } })
    .withMetadata({ orientation: 6 })
    .jpeg()
    .toBuffer();
  const normalized = await service.scanPage({
    originalname: 'page.jpg', mimetype: 'image/jpeg', size: input.length, buffer: input,
  });
  const metadata = await sharp(normalized.buffer).metadata();
  assert.equal(normalized.mimeType, 'image/jpeg');
  assert.ok(Math.max(metadata.width, metadata.height) <= 2400);
  assert.equal(metadata.exif, undefined);
});

test('support screenshots are metadata-free and size-bounded', async () => {
  const service = new ImageSafetyService();
  const input = await sharp({ create: { width: 2600, height: 1800, channels: 3, background: '#112233' } })
    .withMetadata({ orientation: 6 })
    .jpeg()
    .toBuffer();
  const normalized = await service.supportScreenshot({
    originalname: 'support.jpg', mimetype: 'image/jpeg', size: input.length, buffer: input,
  });
  const metadata = await sharp(normalized.buffer).metadata();
  assert.equal(normalized.mimeType, 'image/webp');
  assert.ok(Math.max(metadata.width, metadata.height) <= 1600);
  assert.equal(metadata.exif, undefined);
});

test('support screenshot storage is private, owner-scoped and exportable', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'second-brain-support-media-'));
  try {
    const config = { get: (_key, fallback) => directory || fallback };
    const tx = { $executeRaw: async () => undefined };
    const reports = [{ id: 'report-a', reporterId: 'owner-a' }];
    const prisma = {
      $transaction: async (callback) => callback(tx),
      user: { findUnique: async () => ({ id: 'owner-a' }) },
      document: { findFirst: async () => ({ id: 'document-a' }) },
      report: {
        findFirst: async ({ where }) => reports.find((row) => row.id === where.id && row.reporterId === where.reporterId) ?? null,
        findUnique: async ({ where }) => reports.find((row) => row.id === where.id) ?? null,
        findMany: async ({ where }) => reports.filter((row) => row.reporterId === where.reporterId),
      },
    };
    const media = new PrivateMediaService(config, new ImageSafetyService(), prisma);
    await media.onModuleInit();
    const input = await sharp({ create: { width: 80, height: 60, channels: 3, background: '#445566' } })
      .withMetadata({ orientation: 6 })
      .png()
      .toBuffer();
    await media.putReportScreenshot('owner-a', 'report-a', {
      originalname: 'capture.png', mimetype: 'image/png', size: input.length, buffer: input,
    });

    assert.equal(await media.hasReportScreenshot('owner-a', 'report-a'), true);
    assert.ok((await media.getReportScreenshot('owner-a', 'report-a')).buffer.length > 0);
    assert.ok((await media.getReportScreenshotForAdmin('report-a')).buffer.length > 0);
    await assert.rejects(media.getReportScreenshot('owner-b', 'report-a'), /not found/i);

    const exported = await media.exportUserMedia('owner-a', []);
    assert.equal(exported.reportScreenshots.length, 1);
    assert.equal(exported.reportScreenshots[0].reportId, 'report-a');
    assert.equal(exported.reportScreenshots[0].mimeType, 'image/webp');

    await media.deleteReportScreenshot('owner-a', 'report-a');
    assert.equal(await media.hasReportScreenshot('owner-a', 'report-a'), false);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('private avatar paths are owner-scoped and deletion is idempotent', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'second-brain-media-'));
  try {
    const images = new ImageSafetyService();
    const config = { get: (_key, fallback) => directory || fallback };
    const tx = { $executeRaw: async () => undefined };
    const prisma = {
      $transaction: async (callback) => callback(tx),
      user: { findUnique: async () => ({ id: 'owner' }) },
      document: { findFirst: async () => ({ id: 'document' }) },
    };
    const media = new PrivateMediaService(config, images, prisma);
    await media.onModuleInit();
    const input = await sharp({ create: { width: 32, height: 32, channels: 3, background: '#ffffff' } }).png().toBuffer();
    await media.putAvatar('owner-a', { originalname: 'a.png', mimetype: 'image/png', size: input.length, buffer: input });
    assert.ok((await media.getAvatar('owner-a')).buffer.length > 0);
    await assert.rejects(media.getAvatar('owner-b'), /Avatar not found/);
    await media.deleteAvatar('owner-a');
    await media.deleteAvatar('owner-a');
    await assert.rejects(media.getAvatar('owner-a'), /Avatar not found/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('GDPR media export includes the owned avatar and normalized scan pages', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'second-brain-media-export-'));
  try {
    const images = new ImageSafetyService();
    const config = { get: (_key, fallback) => directory || fallback };
    const tx = { $executeRaw: async () => undefined };
    const prisma = {
      $transaction: async (callback) => callback(tx),
      user: { findUnique: async () => ({ id: 'owner-a' }) },
      document: { findFirst: async () => ({ id: 'document-a' }) },
      report: { findMany: async () => [] },
    };
    const media = new PrivateMediaService(config, images, prisma);
    await media.onModuleInit();
    const input = await sharp({
      create: { width: 40, height: 30, channels: 3, background: '#112233' },
    }).jpeg().toBuffer();
    await media.putAvatar('owner-a', {
      originalname: 'avatar.jpg', mimetype: 'image/jpeg', size: input.length, buffer: input,
    });
    await media.putScanPages('owner-a', 'document-a', [input]);

    const exported = await media.exportUserMedia('owner-a', ['document-a', 'document-without-pages']);
    assert.equal(exported.avatar.mimeType, 'image/webp');
    assert.equal(exported.avatar.encoding, 'base64');
    assert.ok(Buffer.from(exported.avatar.data, 'base64').length > 0);
    assert.equal(exported.scans.length, 1);
    assert.equal(exported.scans[0].documentId, 'document-a');
    assert.equal(exported.scans[0].pages[0].fileName, '001.jpg');
    assert.deepEqual(Buffer.from(exported.scans[0].pages[0].data, 'base64'), input);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('scan page replacement publishes one complete directory without staging artifacts', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'second-brain-media-scan-'));
  try {
    const config = { get: (_key, fallback) => directory || fallback };
    const tx = { $executeRaw: async () => undefined };
    const prisma = {
      $transaction: async (callback) => callback(tx),
      user: { findUnique: async () => ({ id: 'owner-a' }) },
      document: { findFirst: async () => ({ id: 'document-a' }) },
    };
    const media = new PrivateMediaService(config, new ImageSafetyService(), prisma);
    await media.onModuleInit();
    await media.putScanPages('owner-a', 'document-a', [Buffer.from('old')]);
    await media.putScanPages('owner-a', 'document-a', [
      Buffer.from('new-one'),
      Buffer.from('new-two'),
    ]);

    assert.deepEqual(await media.getScanPages('owner-a', 'document-a'), [
      Buffer.from('new-one'),
      Buffer.from('new-two'),
    ]);
    const tree = await readdir(directory, { recursive: true });
    assert.equal(tree.some((name) => /\.(?:uploading|replaced)-/.test(String(name))), false);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('destructive private-media finalizers restore tombstones on failure and purge on success', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'second-brain-media-delete-'));
  try {
    const images = new ImageSafetyService();
    const config = { get: (_key, fallback) => directory || fallback };
    const tx = { $executeRaw: async () => undefined };
    const prisma = {
      $transaction: async (callback) => callback(tx),
      user: { findUnique: async () => ({ id: 'owner-a' }) },
      document: { findFirst: async () => ({ id: 'document-a' }) },
    };
    const media = new PrivateMediaService(config, images, prisma);
    await media.onModuleInit();
    const page = Buffer.from([7, 8, 9]);
    const avatar = await sharp({
      create: { width: 24, height: 24, channels: 3, background: '#334455' },
    }).png().toBuffer();
    await media.putAvatar('owner-a', {
      originalname: 'avatar.png', mimetype: 'image/png', size: avatar.length, buffer: avatar,
    });
    await media.putScanPages('owner-a', 'document-a', [page]);

    await assert.rejects(
      media.deleteScanPagesAnd('owner-a', 'document-a', async () => {
        throw new Error('sql scan delete failed');
      }),
      /sql scan delete failed/,
    );
    assert.deepEqual(await media.getScanPages('owner-a', 'document-a'), [page]);

    await media.deleteScanPagesAnd('owner-a', 'document-a', async () => 'deleted');
    await assert.rejects(
      media.getScanPages('owner-a', 'document-a'),
      /Scan pages not found/,
    );

    await media.putScanPages('owner-a', 'document-a', [page]);
    await assert.rejects(
      media.deleteUserMediaAnd('owner-a', async () => {
        throw new Error('sql owner delete failed');
      }),
      /sql owner delete failed/,
    );
    assert.ok((await media.getAvatar('owner-a')).buffer.length > 0);
    assert.deepEqual(await media.getScanPages('owner-a', 'document-a'), [page]);

    await media.deleteUserMediaAnd('owner-a', async () => 'deleted');
    await assert.rejects(media.getAvatar('owner-a'), /Avatar not found/);
    await assert.rejects(media.getScanPages('owner-a', 'document-a'), /Scan pages not found/);

    const tree = await readdir(directory, { recursive: true });
    assert.equal(tree.some((name) => String(name).includes('.deleting-')), false);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('avatar decoding is throttled and account erasure shares the owner lock', () => {
  const controller = require('node:fs').readFileSync(
    path.join(__dirname, '../src/media/avatar.controller.ts'),
    'utf8',
  );
  const media = require('node:fs').readFileSync(
    path.join(__dirname, '../src/media/private-media.service.ts'),
    'utf8',
  );
  const privacy = require('node:fs').readFileSync(
    path.join(__dirname, '../src/privacy/privacy.service.ts'),
    'utf8',
  );
  assert.match(controller, /@Throttle\(\{ default: \{ limit: 5, ttl: 60_000 \} \}\)/);
  assert.match(media, /pg_advisory_xact_lock/);
  assert.match(media, /if \(!owner\) throw new NotFoundException/);
  assert.match(privacy, /deleteUserMediaAnd\(userId/);
  assert.match(media, /deleteScanPagesAnd/);
});
