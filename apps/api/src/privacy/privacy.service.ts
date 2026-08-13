import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import type {
  ConsentKey,
  ConsentView,
  DataExportResponse,
} from '@second-brain/shared';
import { CONSENT_KEYS } from '@second-brain/shared';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Privacy & GDPR (Sprint 8.7). The three user rights: portability (export),
 * erasure (delete) and consent. Deletion is guarded by password re-entry, then
 * relies on the schema's ON DELETE CASCADE to remove everything the user owns.
 */
@Injectable()
export class PrivacyService {
  constructor(private readonly prisma: PrismaService) {}

  // ── consent ──────────────────────────────────────────────────────────────

  async getConsents(userId: string): Promise<ConsentView[]> {
    const rows = await this.prisma.consent.findMany({ where: { userId } });
    const byKey = new Map(rows.map((c) => [c.key, c]));
    return CONSENT_KEYS.map((key) => {
      const row = byKey.get(key);
      return {
        key,
        granted: row?.granted ?? false,
        updatedAt: row?.updatedAt.toISOString() ?? null,
      };
    });
  }

  async setConsent(
    userId: string,
    key: ConsentKey,
    granted: boolean,
  ): Promise<ConsentView> {
    const row = await this.prisma.consent.upsert({
      where: { userId_key: { userId, key } },
      create: { userId, key, granted },
      update: { granted },
    });
    return { key, granted: row.granted, updatedAt: row.updatedAt.toISOString() };
  }

  // ── erasure ──────────────────────────────────────────────────────────────

  async deleteAccount(userId: string, password: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });
    if (!user) throw new NotFoundException('Account not found.');
    const ok = await argon2.verify(user.passwordHash, password).catch(() => false);
    if (!ok) throw new ForbiddenException('Incorrect password.');
    // ON DELETE CASCADE removes sessions, documents, lessons, subscriptions,
    // memberships, usage — everything the user owns.
    await this.prisma.user.delete({ where: { id: userId } });
  }

  // ── portability ──────────────────────────────────────────────────────────

  async exportData(userId: string): Promise<DataExportResponse> {
    const [
      account, subscription, invoices, payments, documents, concepts, lessons,
      tutorSessions, assessments, writing, reading, usage, memberships, consents, studySessions,
    ] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true, email: true, createdAt: true, isAdmin: true,
          profile: { select: { displayName: true, preferredLanguage: true, timezone: true } },
        },
      }),
      this.prisma.subscription.findUnique({
        where: { userId },
        select: { status: true, interval: true, currentPeriodEnd: true, plan: { select: { slug: true } } },
      }),
      this.prisma.invoice.findMany({ where: { userId }, select: { number: true, amount: true, currency: true, status: true, createdAt: true } }),
      this.prisma.payment.findMany({ where: { userId }, select: { provider: true, amount: true, currency: true, status: true, purpose: true, createdAt: true } }),
      this.prisma.document.findMany({ where: { userId, deletedAt: null }, select: { title: true, content: true, charCount: true, createdAt: true } }),
      this.prisma.concept.findMany({ where: { userId }, select: { name: true, createdAt: true } }),
      this.prisma.lesson.findMany({ where: { userId }, select: { topic: true, createdAt: true } }),
      this.prisma.tutorSession.findMany({
        where: { userId },
        select: { title: true, createdAt: true, messages: { select: { role: true, content: true, createdAt: true } } },
      }),
      this.prisma.assessment.findMany({ where: { userId }, select: { type: true, topic: true, createdAt: true } }),
      this.prisma.writingSubmission.findMany({ where: { userId }, select: { type: true, title: true, text: true, score: true, createdAt: true } }),
      this.prisma.readingExercise.findMany({ where: { userId }, select: { level: true, title: true, score: true, createdAt: true } }),
      this.prisma.usageCounter.findMany({ where: { userId }, select: { metric: true, period: true, used: true } }),
      this.prisma.membership.findMany({ where: { userId }, select: { role: true, organization: { select: { name: true, type: true } } } }),
      this.prisma.consent.findMany({ where: { userId }, select: { key: true, granted: true, updatedAt: true } }),
      this.prisma.studySession.findMany({ where: { userId }, select: { subject: true, status: true, startedAt: true, completedAt: true } }),
    ]);

    return {
      generatedAt: new Date().toISOString(),
      data: {
        account, subscription, invoices, payments, documents, concepts, lessons,
        tutorSessions, assessments, writing, reading, usage, memberships, consents, studySessions,
      },
    };
  }
}
