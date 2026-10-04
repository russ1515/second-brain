import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomUUID } from 'node:crypto';
import { chmod, mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import type { ImageUpload } from './image-safety.service';
import { ImageSafetyService } from './image-safety.service';
import { PrismaService } from '../prisma/prisma.service';

export interface StoredPrivateMedia {
  buffer: Buffer;
  mimeType: string;
  modifiedAt: Date;
}

export interface PortablePrivateMedia {
  avatar: {
    fileName: 'avatar.webp';
    mimeType: 'image/webp';
    encoding: 'base64';
    data: string;
    modifiedAt: string;
  } | null;
  scans: Array<{
    documentId: string;
    pages: Array<{
      fileName: string;
      mimeType: 'image/jpeg';
      encoding: 'base64';
      data: string;
      modifiedAt: string;
    }>;
  }>;
  reportScreenshots: Array<{
    reportId: string;
    fileName: 'screenshot.webp';
    mimeType: 'image/webp';
    encoding: 'base64';
    data: string;
    modifiedAt: string;
  }>;
}

/** Files are intentionally outside the public bundle and addressed only after
 * JWT ownership has resolved the current user. Hashed directory names prevent
 * user identifiers from appearing in filesystem paths or operational output. */
@Injectable()
export class PrivateMediaService implements OnModuleInit {
  private readonly logger = new Logger(PrivateMediaService.name);
  private readonly root: string;

  constructor(
    config: ConfigService,
    private readonly images: ImageSafetyService,
    private readonly prisma: PrismaService,
  ) {
    this.root = resolve(config.get<string>('privateMedia.directory', join(process.cwd(), '.private-media')));
  }

  async onModuleInit(): Promise<void> {
    await this.ensureDirectory(this.root);
  }

  async putAvatar(userId: string, file: ImageUpload): Promise<{ modifiedAt: string }> {
    return this.withOwnerLock(userId, async () => {
      // A request authenticated immediately before account deletion can wait on
      // this lock. Re-check ownership after acquiring it so it cannot recreate
      // an orphaned media directory once deletion has completed.
      const owner = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true },
      });
      if (!owner) throw new NotFoundException('Account not found.');
      const normalized = await this.images.avatar(file);
      const target = this.avatarPath(userId);
      await this.atomicWrite(target, normalized.buffer);
      const info = await stat(target);
      return { modifiedAt: info.mtime.toISOString() };
    });
  }

  async getAvatar(userId: string): Promise<StoredPrivateMedia> {
    const target = this.avatarPath(userId);
    try {
      const [buffer, info] = await Promise.all([readFile(target), stat(target)]);
      return { buffer, mimeType: 'image/webp', modifiedAt: info.mtime };
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
        throw new NotFoundException('Avatar not found.');
      }
      throw error;
    }
  }

  async deleteAvatar(userId: string): Promise<void> {
    await this.withOwnerLock(userId, () => rm(this.avatarPath(userId), { force: true }));
  }

  async putReportScreenshot(
    userId: string,
    reportId: string,
    file: ImageUpload,
  ): Promise<{ modifiedAt: string }> {
    return this.withOwnerLock(userId, async () => {
      await this.requireOwnedReport(userId, reportId);
      const normalized = await this.images.supportScreenshot(file);
      const target = this.reportScreenshotPath(userId, reportId);
      await this.atomicWrite(target, normalized.buffer);
      const info = await stat(target);
      return { modifiedAt: info.mtime.toISOString() };
    });
  }

  async getReportScreenshot(userId: string, reportId: string): Promise<StoredPrivateMedia> {
    await this.requireOwnedReport(userId, reportId);
    return this.readReportScreenshot(userId, reportId);
  }

  /** Admin authorization remains in the guarded controller. This method only
   * resolves the report owner server-side; callers can never supply it. */
  async getReportScreenshotForAdmin(reportId: string): Promise<StoredPrivateMedia> {
    const report = await this.prisma.report.findUnique({
      where: { id: reportId },
      select: { reporterId: true },
    });
    if (!report?.reporterId) throw new NotFoundException('Support screenshot not found.');
    return this.readReportScreenshot(report.reporterId, reportId);
  }

  async hasReportScreenshot(userId: string, reportId: string): Promise<boolean> {
    try {
      await stat(this.reportScreenshotPath(userId, reportId));
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') return false;
      throw error;
    }
  }

  async deleteReportScreenshot(userId: string, reportId: string): Promise<void> {
    await this.withOwnerLock(userId, async () => {
      await this.requireOwnedReport(userId, reportId);
      await rm(this.reportScreenshotPath(userId, reportId), { force: true });
    });
  }

  async deleteUserMedia(userId: string): Promise<void> {
    await this.withOwnerLock(
      userId,
      () => rm(this.userDirectory(userId), { force: true, recursive: true }),
    );
  }

  /** Hold the same cross-replica owner lock while media is erased and the
   * caller removes the SQL owner row. */
  async deleteUserMediaAnd<T>(userId: string, finalize: () => Promise<T>): Promise<T> {
    return this.withOwnerLock(
      userId,
      () => this.deleteWithTombstone(this.userDirectory(userId), finalize),
    );
  }

  /** Include user-provided private media in the existing GDPR JSON export.
   * Reads are serialized with avatar/scan writes and use only owner-derived,
   * hashed paths. No filesystem path or user identifier is returned. */
  async exportUserMedia(
    userId: string,
    documentIds: readonly string[],
  ): Promise<PortablePrivateMedia> {
    return this.withOwnerLock(userId, async () => {
      let avatar: PortablePrivateMedia['avatar'] = null;
      try {
        const target = this.avatarPath(userId);
        const [buffer, info] = await Promise.all([readFile(target), stat(target)]);
        avatar = {
          fileName: 'avatar.webp',
          mimeType: 'image/webp',
          encoding: 'base64',
          data: buffer.toString('base64'),
          modifiedAt: info.mtime.toISOString(),
        };
      } catch (error) {
        if ((error as NodeJS.ErrnoException)?.code !== 'ENOENT') throw error;
      }

      const scans: PortablePrivateMedia['scans'] = [];
      for (const documentId of documentIds) {
        const directory = this.scanDirectory(userId, documentId);
        let names: string[];
        try {
          names = (await readdir(directory))
            .filter((name) => /^\d{3}\.jpg$/.test(name))
            .sort();
        } catch (error) {
          if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') continue;
          throw error;
        }
        const pages: PortablePrivateMedia['scans'][number]['pages'] = [];
        for (const fileName of names) {
          const target = join(directory, fileName);
          const [buffer, info] = await Promise.all([readFile(target), stat(target)]);
          pages.push({
            fileName,
            mimeType: 'image/jpeg',
            encoding: 'base64',
            data: buffer.toString('base64'),
            modifiedAt: info.mtime.toISOString(),
          });
        }
        if (pages.length > 0) scans.push({ documentId, pages });
      }

      const reports = await this.prisma.report.findMany({
        where: { reporterId: userId },
        select: { id: true },
      });
      const reportScreenshots: PortablePrivateMedia['reportScreenshots'] = [];
      for (const report of reports) {
        try {
          const target = this.reportScreenshotPath(userId, report.id);
          const [buffer, info] = await Promise.all([readFile(target), stat(target)]);
          reportScreenshots.push({
            reportId: report.id,
            fileName: 'screenshot.webp',
            mimeType: 'image/webp',
            encoding: 'base64',
            data: buffer.toString('base64'),
            modifiedAt: info.mtime.toISOString(),
          });
        } catch (error) {
          if ((error as NodeJS.ErrnoException)?.code !== 'ENOENT') throw error;
        }
      }
      return { avatar, scans, reportScreenshots };
    });
  }

  /** Persist normalized scan captures outside the public bundle. OCR may run
   * now or later; saving the learner's capture never depends on an AI provider. */
  async putScanPages(
    userId: string,
    documentId: string,
    pages: readonly Buffer[],
  ): Promise<void> {
    await this.withOwnerLock(userId, async () => {
      const owner = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true },
      });
      if (!owner) throw new NotFoundException('Account not found.');
      const document = await this.prisma.document.findFirst({
        where: { id: documentId, userId, deletedAt: null },
        select: { id: true },
      });
      if (!document) throw new NotFoundException('Document not found.');
      const directory = this.scanDirectory(userId, documentId);
      const parent = dirname(directory);
      const temporary = join(parent, `.${basename(directory)}.uploading-${randomUUID()}`);
      const previous = join(parent, `.${basename(directory)}.replaced-${randomUUID()}`);
      let previousMoved = false;
      let promoted = false;
      try {
        // Build the complete page set out of sight. A failed page write can
        // never expose a partial scan to OCR or to a later retry.
        await this.ensureDirectory(temporary);
        for (let index = 0; index < pages.length; index += 1) {
          await this.atomicWrite(
            join(temporary, `${String(index + 1).padStart(3, '0')}.jpg`),
            pages[index],
          );
        }
        try {
          await rename(directory, previous);
          previousMoved = true;
        } catch (error) {
          if ((error as NodeJS.ErrnoException)?.code !== 'ENOENT') throw error;
        }
        await rename(temporary, directory);
        promoted = true;
      } catch (error) {
        if (previousMoved && !promoted) {
          await rename(previous, directory).catch(() => undefined);
        }
        throw error;
      } finally {
        await rm(temporary, { force: true, recursive: true }).catch(() => undefined);
      }
      if (previousMoved) {
        await rm(previous, { force: true, recursive: true }).catch(() => {
          this.logger.warn('A replaced private scan directory could not be purged.');
        });
      }
    });
  }

  /** Read the normalized private pages for an explicit OCR retry. This is an
   * internal service seam only: page bytes are never exposed by an HTTP route.
   * Ownership is revalidated while the private-media lock is held. */
  async getScanPages(userId: string, documentId: string): Promise<Buffer[]> {
    return this.withOwnerLock(userId, async () => {
      const document = await this.prisma.document.findFirst({
        where: { id: documentId, userId, deletedAt: null },
        select: { id: true },
      });
      if (!document) throw new NotFoundException('Document not found.');

      const directory = this.scanDirectory(userId, documentId);
      let names: string[];
      try {
        names = (await readdir(directory))
          .filter((name) => /^\d{3}\.jpg$/.test(name))
          .sort();
      } catch (error) {
        if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
          throw new NotFoundException('Scan pages not found.');
        }
        throw error;
      }
      if (names.length === 0) throw new NotFoundException('Scan pages not found.');
      return Promise.all(names.map((name) => readFile(join(directory, name))));
    });
  }

  async deleteScanPagesAnd<T>(
    userId: string,
    documentId: string,
    finalize: () => Promise<T>,
  ): Promise<T> {
    return this.withOwnerLock(
      userId,
      () => this.deleteWithTombstone(this.scanDirectory(userId, documentId), finalize),
    );
  }

  /** Stage filesystem deletion with an atomic same-volume rename. If the SQL
   * finalizer rolls back/fails, restore the exact directory before releasing
   * the owner lock. Cleanup after a successful finalizer is best-effort: a
   * cleanup failure must never roll back SQL after media has been committed. */
  private async deleteWithTombstone<T>(
    target: string,
    finalize: () => Promise<T>,
  ): Promise<T> {
    const tombstone = join(
      dirname(target),
      `.${basename(target)}.deleting-${randomUUID()}`,
    );
    let moved = false;
    try {
      await rename(target, tombstone);
      moved = true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code !== 'ENOENT') throw error;
    }

    let result: T;
    try {
      result = await finalize();
    } catch (error) {
      if (moved) {
        try {
          await rename(tombstone, target);
        } catch {
          throw new Error(
            'Private media restoration failed after the database operation failed.',
            { cause: error },
          );
        }
      }
      throw error;
    }

    if (moved) {
      await rm(tombstone, { force: true, recursive: true }).catch(() => {
        // The SQL owner is already finalized. Keep the inaccessible tombstone
        // for operational cleanup rather than restoring orphaned live media.
        this.logger.warn('A private-media deletion tombstone could not be purged.');
      });
    }
    return result;
  }

  private avatarPath(userId: string): string {
    return join(this.userDirectory(userId), 'avatar.webp');
  }

  private reportScreenshotPath(userId: string, reportId: string): string {
    const opaqueReport = createHash('sha256').update(reportId).digest('hex');
    return join(this.userDirectory(userId), 'reports', `${opaqueReport}.webp`);
  }

  private async readReportScreenshot(userId: string, reportId: string): Promise<StoredPrivateMedia> {
    const target = this.reportScreenshotPath(userId, reportId);
    try {
      const [buffer, info] = await Promise.all([readFile(target), stat(target)]);
      return { buffer, mimeType: 'image/webp', modifiedAt: info.mtime };
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
        throw new NotFoundException('Support screenshot not found.');
      }
      throw error;
    }
  }

  private async requireOwnedReport(userId: string, reportId: string): Promise<void> {
    const report = await this.prisma.report.findFirst({
      where: { id: reportId, reporterId: userId },
      select: { id: true },
    });
    if (!report) throw new NotFoundException('Report not found.');
  }

  private userDirectory(userId: string): string {
    const opaqueOwner = createHash('sha256').update(userId).digest('hex');
    return join(this.root, 'users', opaqueOwner);
  }

  private scanDirectory(userId: string, documentId: string): string {
    const opaqueDocument = createHash('sha256').update(documentId).digest('hex');
    return join(this.userDirectory(userId), 'scans', opaqueDocument);
  }

  private async atomicWrite(target: string, data: Buffer): Promise<void> {
    const directory = dirname(target);
    await this.ensureDirectory(directory);
    const temporary = join(directory, `.${randomUUID()}.tmp`);
    try {
      await writeFile(temporary, data, { flag: 'wx', mode: 0o600 });
      await rename(temporary, target);
      await chmod(target, 0o600);
    } finally {
      await rm(temporary, { force: true }).catch(() => undefined);
    }
  }

  private async ensureDirectory(path: string): Promise<void> {
    await mkdir(path, { recursive: true, mode: 0o700 });
    await chmod(path, 0o700);
  }

  private withOwnerLock<T>(userId: string, operation: () => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      const lockKey = `private-media:${userId}`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;
      return operation();
    }, { timeout: 30_000 });
  }
}
