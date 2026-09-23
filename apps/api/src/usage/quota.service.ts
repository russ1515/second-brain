import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma, type QuotaAccount, type QuotaReservation, type QuotaResource, type QuotaState } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionService } from '../subscription/subscription.service';
import { EntitlementsService } from '../subscription/entitlements.service';

const RESOURCE_QUOTA_KEY: Partial<Record<QuotaResource, string>> = {
  AI_TEXT: 'ai_questions',
  VOICE_SECONDS: 'voice_minutes',
};
export const QUOTA_WARNING_THRESHOLDS = [50, 70, 85, 95, 100] as const;
const SERIALIZABLE_RETRY_LIMIT = 12;
// A burst of legitimate requests can temporarily queue for a Prisma interactive
// transaction connection.  The defaults are only two/five seconds, which is
// too short for the last-unit race we explicitly support.  These values remain
// bounded, and every write below stays in one serializable transaction.
const QUOTA_TRANSACTION_MAX_WAIT_MS = 10_000;
const QUOTA_TRANSACTION_TIMEOUT_MS = 10_000;

interface ReservationRequest {
  userId: string;
  resource: QuotaResource;
  feature: string;
  units: number;
  idempotencyKey: string;
}

/**
 * The only supported human quota correction.  It is deliberately a positive
 * credit: the engine never exposes a generic reset or an unaudited debit.
 */
export interface AdminQuotaCreditInput {
  userId: string;
  resource: QuotaResource;
  amount: number;
  reason: string;
  actorId?: string;
  cycleId?: string;
  /** Called inside the same serializable transaction after the ledger entry. */
  afterApplied?: (tx: Prisma.TransactionClient, result: AdminQuotaCreditResult) => Promise<void>;
}

export interface AdminQuotaCreditResult {
  cycleId: string;
  accountId: string;
  resource: QuotaResource;
  requestedCredit: number;
  appliedCredit: number;
  unappliedCredit: number;
  primaryCredit: number;
  fallbackCredit: number;
  state: QuotaState;
  primaryUsed: number;
  fallbackUsed: number;
  ledgerId: string;
}

@Injectable()
export class QuotaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptions: SubscriptionService,
    @Optional() private readonly entitlements?: EntitlementsService,
  ) {}

  async reserve(input: ReservationRequest): Promise<QuotaReservation> {
    if (!Number.isSafeInteger(input.units) || input.units <= 0) {
      throw new ForbiddenException({ code: 'INVALID_QUOTA_RESERVATION', message: 'Units must be a positive integer.' });
    }
    for (let attempt = 1; ; attempt += 1) {
      try {
        return await this.reserveOnce(input);
      } catch (error) {
        if (attempt >= SERIALIZABLE_RETRY_LIMIT || !this.isRetryableConflict(error)) throw error;
        // PostgreSQL can abort one participant of a Serializable race. Retrying
        // the complete reservation is safe because both reservation and ledger
        // have durable idempotency constraints.
        await new Promise((resolve) => setTimeout(resolve, attempt * 5));
      }
    }
  }

  /**
   * Apply a targeted ADMIN_CREDIT to one active quota account.  The transaction
   * credits fallback first (the continuity reserve currently in use), then
   * primary usage, recalculates the state, and leaves the full correction in
   * UsageLedger.  It never assigns `used = 0` directly.
   */
  async adminCredit(input: AdminQuotaCreditInput): Promise<AdminQuotaCreditResult> {
    if (!Number.isSafeInteger(input.amount) || input.amount <= 0) {
      throw new BadRequestException({ code: 'INVALID_ADMIN_QUOTA_CREDIT' });
    }
    for (let attempt = 1; ; attempt += 1) {
      try {
        return await this.adminCreditOnce(input);
      } catch (error) {
        if (attempt >= SERIALIZABLE_RETRY_LIMIT || !this.isRetryableConflict(error)) throw error;
        await new Promise((resolve) => setTimeout(resolve, attempt * 5));
      }
    }
  }

  private async adminCreditOnce(input: AdminQuotaCreditInput): Promise<AdminQuotaCreditResult> {
    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      const cycle = await tx.quotaCycle.findFirst({
        where: {
          ...(input.cycleId ? { id: input.cycleId } : {}),
          userId: input.userId,
          status: 'ACTIVE',
          startsAt: { lte: now },
          endsAt: { gt: now },
        },
        orderBy: { startsAt: 'desc' },
      });
      if (!cycle) {
        throw new NotFoundException({ code: input.cycleId ? 'QUOTA_CYCLE_NOT_FOUND' : 'ACTIVE_QUOTA_CYCLE_NOT_FOUND' });
      }

      const account = await tx.quotaAccount.findUnique({
        where: { cycleId_resource: { cycleId: cycle.id, resource: input.resource } },
      });
      if (!account) {
        throw new NotFoundException({ code: 'QUOTA_ACCOUNT_NOT_FOUND' });
      }

      // There is no useful correction when nothing has been consumed.  This is
      // intentionally not converted into a fabricated future allowance.
      const fallbackCredit = Math.min(account.fallbackUsed, input.amount);
      const primaryCredit = Math.min(account.primaryUsed, input.amount - fallbackCredit);
      const appliedCredit = fallbackCredit + primaryCredit;
      if (appliedCredit === 0) {
        throw new ConflictException({ code: 'QUOTA_CREDIT_NOT_APPLICABLE' });
      }

      const nextPrimaryUsed = account.primaryUsed - primaryCredit;
      const nextFallbackUsed = account.fallbackUsed - fallbackCredit;
      const primaryAvailable = account.primaryLimit === null || nextPrimaryUsed < account.primaryLimit;
      const fallbackAvailable = nextFallbackUsed < account.fallbackLimit;
      const nextState: QuotaState = primaryAvailable ? 'PRIMARY' : fallbackAvailable ? 'FALLBACK' : 'BLOCKED';
      const updated = await tx.quotaAccount.update({
        where: { id: account.id },
        data: {
          primaryUsed: { decrement: primaryCredit },
          fallbackUsed: { decrement: fallbackCredit },
          state: nextState,
          version: { increment: 1 },
        },
      });
      const ledger = await tx.usageLedger.create({
        data: {
          userId: input.userId,
          cycleId: cycle.id,
          resource: input.resource,
          event: 'ADJUST',
          primaryDelta: -primaryCredit,
          fallbackDelta: -fallbackCredit,
          actualUnits: appliedCredit,
          actorId: input.actorId ?? null,
          reason: input.reason,
          idempotencyKey: `admin-credit:${input.userId}:${cycle.id}:${input.resource}:${randomUUID()}`,
          metadata: {
            source: 'ADMIN_CREDIT',
            requestedCredit: input.amount,
            appliedCredit,
            unappliedCredit: input.amount - appliedCredit,
            primaryCredit,
            fallbackCredit,
            accountId: account.id,
          },
        },
      });
      const result: AdminQuotaCreditResult = {
        cycleId: cycle.id,
        accountId: account.id,
        resource: input.resource,
        requestedCredit: input.amount,
        appliedCredit,
        unappliedCredit: input.amount - appliedCredit,
        primaryCredit,
        fallbackCredit,
        state: updated.state,
        primaryUsed: updated.primaryUsed,
        fallbackUsed: updated.fallbackUsed,
        ledgerId: ledger.id,
      };
      await input.afterApplied?.(tx, result);
      return result;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  private async reserveOnce(input: ReservationRequest): Promise<QuotaReservation> {
    const duplicate = await this.prisma.quotaReservation.findUnique({
      where: { userId_idempotencyKey: { userId: input.userId, idempotencyKey: input.idempotencyKey } },
    });
    if (duplicate) return duplicate;

    const { cycle, account } = await this.ensureAccount(input.userId, input.resource);
    try {
      return await this.prisma.$transaction(async (tx) => {
        let primaryUnits = 0;
        let fallbackUnits = 0;

        if (account.primaryLimit === null) {
          await tx.quotaAccount.update({ where: { id: account.id }, data: { primaryUsed: { increment: input.units }, version: { increment: 1 } } });
          primaryUnits = input.units;
        } else {
          const primary = await tx.quotaAccount.updateMany({
            where: { id: account.id, primaryUsed: { lte: account.primaryLimit - input.units } },
            data: { primaryUsed: { increment: input.units }, state: 'PRIMARY', version: { increment: 1 } },
          });
          if (primary.count === 1) {
            primaryUnits = input.units;
          } else if (account.fallbackLimit > 0) {
            const fallback = await tx.quotaAccount.updateMany({
              where: { id: account.id, fallbackUsed: { lte: account.fallbackLimit - input.units } },
              data: { fallbackUsed: { increment: input.units }, state: 'FALLBACK', version: { increment: 1 } },
            });
            if (fallback.count === 1) fallbackUnits = input.units;
          }
        }

        if (primaryUnits + fallbackUnits !== input.units) {
          const current = await tx.quotaAccount.findUniqueOrThrow({ where: { id: account.id } });
          throw this.exhausted(current, cycle.endsAt, input.feature);
        }

        // The successful allocation is the only operation allowed to advance
        // quota state.  A rejected concurrent attempt must remain read-only:
        // writing BLOCKED after a rejected transaction both churns the same row
        // and can race with the request consuming the final unit.
        await this.recalculateState(tx, account.id);

        const reservation = await tx.quotaReservation.create({
          data: {
            userId: input.userId, resource: input.resource, feature: input.feature,
            requestedUnits: input.units, idempotencyKey: input.idempotencyKey,
            cycleId: cycle.id, accountId: account.id, primaryUnits, fallbackUnits,
          },
        });
        await tx.usageLedger.create({
          data: {
            reservationId: reservation.id, userId: input.userId, cycleId: cycle.id,
            resource: input.resource, event: 'RESERVE', primaryDelta: primaryUnits,
            fallbackDelta: fallbackUnits, idempotencyKey: `${input.userId}:${input.idempotencyKey}:reserve`,
          },
        });
        return reservation;
      }, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: QUOTA_TRANSACTION_MAX_WAIT_MS,
        timeout: QUOTA_TRANSACTION_TIMEOUT_MS,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const existing = await this.prisma.quotaReservation.findUnique({ where: { userId_idempotencyKey: { userId: input.userId, idempotencyKey: input.idempotencyKey } } });
        if (existing) return existing;
      }
      throw error;
    }
  }

  async finalize(reservationId: string, actualUnits?: number): Promise<QuotaReservation> {
    const existing = await this.prisma.quotaReservation.findUniqueOrThrow({ where: { id: reservationId } });
    if (existing.status !== 'RESERVED') return existing;
    const actual = actualUnits === undefined ? existing.requestedUnits : Math.max(0, Math.min(existing.requestedUnits, Math.trunc(actualUnits)));
    const release = existing.requestedUnits - actual;
    return this.prisma.$transaction(async (tx) => {
      const changed = await tx.quotaReservation.updateMany({ where: { id: reservationId, status: 'RESERVED' }, data: { status: 'FINALIZED', actualUnits: actual, completedAt: new Date() } });
      if (changed.count === 0) return tx.quotaReservation.findUniqueOrThrow({ where: { id: reservationId } });
      let releasePrimary = Math.min(existing.primaryUnits, release);
      let releaseFallback = release - releasePrimary;
      if (releasePrimary) await tx.quotaAccount.updateMany({ where: { id: existing.accountId, primaryUsed: { gte: releasePrimary } }, data: { primaryUsed: { decrement: releasePrimary }, version: { increment: 1 } } });
      if (releaseFallback) await tx.quotaAccount.updateMany({ where: { id: existing.accountId, fallbackUsed: { gte: releaseFallback } }, data: { fallbackUsed: { decrement: releaseFallback }, version: { increment: 1 } } });
      if (release) await this.recalculateState(tx, existing.accountId);
      await tx.usageLedger.create({
        data: { reservationId, userId: existing.userId, cycleId: existing.cycleId, resource: existing.resource, event: 'FINALIZE', primaryDelta: -releasePrimary, fallbackDelta: -releaseFallback, actualUnits: actual, idempotencyKey: `${existing.userId}:${existing.idempotencyKey}:finalize` },
      });
      return tx.quotaReservation.findUniqueOrThrow({ where: { id: reservationId } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async release(reservationId: string, reason: string): Promise<QuotaReservation> {
    const existing = await this.prisma.quotaReservation.findUniqueOrThrow({ where: { id: reservationId } });
    if (existing.status !== 'RESERVED') return existing;
    return this.prisma.$transaction(async (tx) => {
      const changed = await tx.quotaReservation.updateMany({ where: { id: reservationId, status: 'RESERVED' }, data: { status: 'RELEASED', actualUnits: 0, completedAt: new Date() } });
      if (changed.count === 0) return tx.quotaReservation.findUniqueOrThrow({ where: { id: reservationId } });
      if (existing.primaryUnits) await tx.quotaAccount.updateMany({ where: { id: existing.accountId, primaryUsed: { gte: existing.primaryUnits } }, data: { primaryUsed: { decrement: existing.primaryUnits }, version: { increment: 1 } } });
      if (existing.fallbackUnits) await tx.quotaAccount.updateMany({ where: { id: existing.accountId, fallbackUsed: { gte: existing.fallbackUnits } }, data: { fallbackUsed: { decrement: existing.fallbackUnits }, version: { increment: 1 } } });
      await this.recalculateState(tx, existing.accountId);
      await tx.usageLedger.create({ data: { reservationId, userId: existing.userId, cycleId: existing.cycleId, resource: existing.resource, event: 'RELEASE', primaryDelta: -existing.primaryUnits, fallbackDelta: -existing.fallbackUnits, reason, idempotencyKey: `${existing.userId}:${existing.idempotencyKey}:release` } });
      return tx.quotaReservation.findUniqueOrThrow({ where: { id: reservationId } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  private async ensureAccount(userId: string, resource: QuotaResource): Promise<{ cycle: Awaited<ReturnType<QuotaService['ensureCycle']>>; account: QuotaAccount }> {
    const cycle = await this.ensureCycle(userId);
    const plan = await this.prisma.plan.findUniqueOrThrow({ where: { slug: cycle.planSlug } });
    const version = await this.prisma.planVersion.findUnique({ where: { planId_version: { planId: plan.id, version: cycle.planVersion } } });
    const quotaKey = RESOURCE_QUOTA_KEY[resource];
    const versionLimit = quotaKey ? ((version?.quotas ?? plan.quotas) as Record<string, number>)[quotaKey] : undefined;
    const effectiveLimit = quotaKey && this.entitlements ? await this.entitlements.quota(userId, quotaKey) : versionLimit;
    const rawLimit = effectiveLimit === null ? -1 : effectiveLimit;
    // The historic voice quota is stored in minutes; the v1 commercial unit is seconds.
    const primaryLimit = rawLimit === undefined || rawLimit < 0 ? null : resource === 'VOICE_SECONDS' ? rawLimit * 60 : rawLimit;
    const ratio = version?.fallbackRatio ?? plan.fallbackRatio;
    let fallbackLimit = 0;
    if (plan.slug !== 'free' && primaryLimit !== null) {
      const free = await this.prisma.plan.findUniqueOrThrow({ where: { slug: 'free' } });
      const freeVersion = await this.prisma.planVersion.findUnique({
        where: { planId_version: { planId: free.id, version: free.configurationVersion } },
      });
      const freeLimit = quotaKey
        ? ((freeVersion?.quotas ?? free.quotas) as Record<string, number>)[quotaKey]
        : undefined;
      if (freeLimit !== undefined && freeLimit >= 0) {
        const correspondingFreeLimit = resource === 'VOICE_SECONDS' ? freeLimit * 60 : freeLimit;
        fallbackLimit = Math.floor(correspondingFreeLimit * ratio);
      }
    }
    const account = await this.prisma.quotaAccount.upsert({
      where: { cycleId_resource: { cycleId: cycle.id, resource } },
      create: { cycleId: cycle.id, resource, primaryLimit, fallbackLimit },
      update: {},
    });
    return { cycle, account };
  }

  private async ensureCycle(userId: string) {
    const now = new Date();
    const current = await this.prisma.quotaCycle.findFirst({ where: { userId, status: 'ACTIVE', startsAt: { lte: now }, endsAt: { gt: now } }, orderBy: { createdAt: 'asc' } });
    const sub = await this.subscriptions.resolveForUser(userId);
    const plan = await this.prisma.plan.findUniqueOrThrow({ where: { id: sub.planId } });
    const paidWindow = plan.slug !== 'free' && sub.currentPeriodStart && sub.currentPeriodEnd;
    if (current) {
      // Downgrades (paid -> Free) and same-period paid-plan changes retain the
      // existing reference cycle, preventing a second allocation. A provider
      // period rollover is the sole reason to close it and allocate a successor.
      if (!paidWindow) return current;
      const sameWindow = current.startsAt.getTime() === sub.currentPeriodStart!.getTime() &&
        current.endsAt.getTime() === sub.currentPeriodEnd!.getTime();
      if (sameWindow) return current;
      await this.prisma.quotaCycle.update({
        where: { id: current.id },
        data: { status: 'CLOSED', closedAt: now },
      });
    }
    const startsAt = paidWindow ? sub.currentPeriodStart! : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const endsAt = paidWindow ? sub.currentPeriodEnd! : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    return this.prisma.quotaCycle.upsert({
      where: { userId_startsAt_endsAt: { userId, startsAt, endsAt } },
      create: { userId, subscriptionId: sub.id, planSlug: plan.slug, planVersion: sub.planVersion ?? plan.configurationVersion, startsAt, endsAt, source: paidWindow ? 'SUBSCRIPTION' : 'FREE', predecessorId: current?.id },
      update: {},
    });
  }

  private exhausted(account: QuotaAccount, resetAt: Date, feature: string): ForbiddenException {
    return new ForbiddenException({
      code: 'QUOTA_EXHAUSTED', error: 'quota_exceeded', resource: account.resource,
      feature, state: 'BLOCKED', primary: { used: account.primaryUsed, limit: account.primaryLimit },
      fallback: { used: account.fallbackUsed, limit: account.fallbackLimit },
      resetAt: resetAt.toISOString(), retryable: false,
    });
  }

  private async recalculateState(tx: Prisma.TransactionClient, accountId: string): Promise<void> {
    const account = await tx.quotaAccount.findUniqueOrThrow({ where: { id: accountId } });
    const primaryAvailable = account.primaryLimit === null || account.primaryUsed < account.primaryLimit;
    const fallbackAvailable = account.fallbackUsed < account.fallbackLimit;
    await tx.quotaAccount.update({
      where: { id: accountId },
      data: { state: primaryAvailable ? 'PRIMARY' : fallbackAvailable ? 'FALLBACK' : 'BLOCKED', version: { increment: 1 } },
    });
  }

  private isRetryableConflict(error: unknown): boolean {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
    if (error.code === 'P2034' || error.code === 'P2002' || error.code === 'P2024') return true;
    // P2028 is not universally retryable: only the known "could not start"
    // form means no transaction began and no mutation can have happened.
    return error.code === 'P2028' && /Unable to start a transaction in the given time/i.test(error.message);
  }
}
