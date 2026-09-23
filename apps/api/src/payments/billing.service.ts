import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Prisma, type Invoice } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { createHash } from 'node:crypto';
import type {
  BillingInterval,
  CheckoutResponse,
  InvoiceView,
  MobileVerifyRequest,
  PaymentProviderName,
  PlanSlug,
} from '@second-brain/shared';
import { PrismaService } from '../prisma/prisma.service';
import { PlanService } from '../subscription/plan.service';
import { SubscriptionService } from '../subscription/subscription.service';
import { PaymentRegistry } from './payment-registry';
import type { NormalizedBillingEvent } from './payment-provider.interface';

/**
 * The billing brain and the SOURCE OF TRUTH. It orchestrates checkout across
 * providers, but the only thing that ever mutates subscription state is
 * `applyEvent`, fed exclusively by VERIFIED provider events (webhook signature or
 * server-verified receipt) — never by the client. Every inbound event is
 * de-duplicated so provider re-delivery is processed exactly once.
 */
@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly plans: PlanService,
    private readonly subscriptions: SubscriptionService,
    private readonly registry: PaymentRegistry,
  ) {}

  /** Begin a hosted checkout for a PAID plan. Free needs no payment (use cancel). */
  async startCheckout(
    userId: string,
    slug: PlanSlug,
    interval: BillingInterval,
  ): Promise<CheckoutResponse> {
    if (slug === 'free') {
      throw new BadRequestException(
        'The Free plan needs no checkout — cancel a paid plan to return to Free.',
      );
    }
    const plan = await this.plans.bySlug(slug);
    if (!plan || !plan.isActive) throw new BadRequestException(`Unknown plan "${slug}".`);

    const provider = this.registry.defaultWebProvider();
    const result = await provider.createCheckout({
      userId,
      planSlug: slug,
      planName: plan.name,
      interval,
    });
    const sub = await this.subscriptions.resolveForUser(userId);
    if (sub.plan.slug === 'free') {
      await this.prisma.subscription.update({ where: { userId }, data: { status: 'payment_pending' } });
    }
    return { provider: provider.name, url: result.url, sessionId: result.sessionId };
  }

  /** Complete a FAKE checkout in dev (stands in for the provider callback). */
  async devConfirm(userId: string, sessionId: string): Promise<void> {
    if (!this.registry.fakeAllowed) {
      throw new BadRequestException(
        'Fake checkout confirmation is disabled in production.',
      );
    }
    const event = this.registry.fake.activation(sessionId);
    if (event.userId !== userId) {
      throw new BadRequestException('This checkout session belongs to another user.');
    }
    await this.applyEvent('fake', event);
  }

  /** Verify + apply a webhook (called from the raw, unauthenticated endpoint). */
  async handleWebhook(
    provider: PaymentProviderName,
    rawBody: string,
    signature: string | undefined,
  ): Promise<void> {
    const event = await this.registry.get(provider).parseWebhook(rawBody, signature);
    if (event) await this.applyEvent(provider, event, createHash('sha256').update(rawBody).digest('hex'));
  }

  /** Verify a mobile purchase (Apple/Google) and apply it. */
  async verifyMobile(userId: string, req: MobileVerifyRequest): Promise<void> {
    const provider = this.registry.get(req.provider);
    if (!provider.verifyMobilePurchase) {
      throw new BadRequestException(`${req.provider} cannot verify mobile purchases.`);
    }
    const event = await provider.verifyMobilePurchase({
      userId,
      receipt: req.receipt,
      planSlug: req.slug,
      interval: req.interval ?? 'month',
    });
    await this.applyEvent(req.provider, event);
  }

  /** Cancel the current paid subscription. */
  async cancel(userId: string, atPeriodEnd: boolean): Promise<void> {
    const sub = await this.subscriptions.resolveForUser(userId);
    await this.registry
      .get((sub.provider as PaymentProviderName) ?? 'fake')
      .cancel(sub.providerSubscriptionId, atPeriodEnd);

    if (atPeriodEnd) {
      await this.prisma.subscription.update({
        where: { userId },
        data: { cancelAtPeriodEnd: true },
      });
    } else {
      throw new BadRequestException({
        code: 'BUSINESS_DECISION_REQUIRED',
        message: 'Immediate paid-plan cancellation needs an explicit refund/proration policy.',
      });
    }
  }

  async listInvoices(userId: string): Promise<InvoiceView[]> {
    const rows = await this.prisma.invoice.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((i) => this.toInvoiceView(i));
  }

  // ── the ONE place subscription state changes ──────────────────────────────

  private async applyEvent(
    provider: PaymentProviderName,
    event: NormalizedBillingEvent,
    payloadHash?: string,
  ): Promise<void> {
    const registry = await this.prisma.webhookEvent.upsert({
      where: { provider_eventId: { provider, eventId: event.eventId } },
      create: { provider, eventId: event.eventId, type: event.type, payloadHash, status: 'received' },
      update: {},
    });
    if (registry.status === 'processed') {
      this.logger.debug('Duplicate webhook event ignored.');
      return;
    }
    if (registry.payloadHash && payloadHash && registry.payloadHash !== payloadHash) {
      throw new BadRequestException('Webhook event id was reused with a different payload.');
    }
    const claimed = await this.prisma.webhookEvent.updateMany({
      where: { id: registry.id, status: { in: ['received', 'failed'] } },
      data: { status: 'processing', attemptCount: { increment: 1 }, lastError: null },
    });
    // Another delivery already owns this event. It will either commit processed
    // or mark failed, in which case a later provider retry may claim it again.
    if (claimed.count === 0) return;

    try {
      await this.prisma.$transaction(async (tx) => {
        let existing = await tx.subscription.findUnique({ where: { userId: event.userId } });
        if (!existing) {
          const free = await tx.plan.findUniqueOrThrow({ where: { slug: 'free' } });
          existing = await tx.subscription.create({ data: { userId: event.userId, planId: free.id, status: 'free', planVersion: free.configurationVersion } });
        }

        const outOfOrder = !!(
          existing.currentPeriodStart && event.currentPeriodStart &&
          event.currentPeriodStart.getTime() < existing.currentPeriodStart.getTime()
        );

        if (!outOfOrder) switch (event.type) {
      case 'subscription_activated':
      case 'subscription_renewed':
      case 'subscription_updated': {
        const plan = event.planSlug
          ? await tx.plan.findUnique({ where: { slug: event.planSlug } })
          : null;
        if (!plan && event.planSlug) throw new BadRequestException(`Unknown plan "${event.planSlug}" in verified event.`);
        await tx.subscription.update({
          where: { userId: event.userId },
          data: {
            ...(plan ? { planId: plan.id } : {}),
            status: 'active',
            ...(plan ? { planVersion: plan.configurationVersion } : {}),
            provider,
            interval: event.interval ?? undefined,
            providerCustomerId: event.providerCustomerId ?? undefined,
            providerSubscriptionId: event.providerSubscriptionId ?? undefined,
            currentPeriodStart: event.currentPeriodStart ?? undefined,
            currentPeriodEnd: event.currentPeriodEnd ?? undefined,
            cancelAtPeriodEnd: false,
          },
        });
        if (event.amount !== undefined && event.currency) {
          await this.recordPaymentAndInvoice(tx, provider, event);
        }
        break;
      }
      case 'payment_failed':
        await tx.subscription.update({
          where: { userId: event.userId },
          data: { status: 'payment_failed' },
        });
        await tx.payment.create({
          data: {
            userId: event.userId,
            provider,
            amount: event.amount ?? 0,
            currency: event.currency ?? 'usd',
            status: 'failed',
            purpose: 'renewal',
          },
        });
        break;
      case 'subscription_canceled':
        const sub = await tx.subscription.findUniqueOrThrow({ where: { userId: event.userId } });
        if (sub.currentPeriodEnd && sub.currentPeriodEnd > new Date()) {
          await tx.subscription.update({ where: { userId: event.userId }, data: { status: 'canceled', cancelAtPeriodEnd: true } });
        } else {
          await this.downgradeToFree(event.userId, tx);
        }
        break;
        }
        await tx.auditLog.create({
          data: {
            action: outOfOrder ? 'billing.webhook.ignored_out_of_order' : `billing.webhook.${event.type}`,
            targetType: 'User',
            targetId: event.userId,
            result: outOfOrder ? 'ignored' : 'success',
            metadata: { provider, eventId: event.eventId, type: event.type },
          },
        });
        await tx.webhookEvent.update({ where: { id: registry.id }, data: { status: 'processed', processedAt: new Date() } });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      await this.prisma.webhookEvent.update({
        where: { id: registry.id },
        data: { status: 'failed', lastError: error instanceof Error ? error.message.slice(0, 500) : 'Unknown processing error' },
      }).catch(() => undefined);
      throw error;
    }
  }

  private async recordPaymentAndInvoice(
    tx: Prisma.TransactionClient,
    provider: PaymentProviderName,
    event: NormalizedBillingEvent,
  ): Promise<void> {
    const amount = event.amount ?? 0;
    const currency = event.currency ?? 'usd';
    await tx.payment.create({
      data: {
        userId: event.userId,
        provider,
        providerRef: event.eventId,
        amount,
        currency,
        status: 'succeeded',
        purpose: event.type === 'subscription_renewed' ? 'renewal' : 'subscription',
      },
    });
    await tx.invoice.create({
      data: {
        userId: event.userId,
        number: `INV-${new Date().getFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`,
        provider,
        amount,
        currency,
        status: 'paid',
        periodStart: event.currentPeriodStart,
        periodEnd: event.currentPeriodEnd,
      },
    });
  }

  private async downgradeToFree(userId: string, tx: Prisma.TransactionClient = this.prisma): Promise<void> {
    const free = await tx.plan.findUnique({ where: { slug: 'free' } });
    if (!free) return;
    await tx.subscription.update({
      where: { userId },
      data: {
        planId: free.id,
        status: 'free',
        planVersion: free.configurationVersion,
        interval: null,
        provider: null,
        providerSubscriptionId: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
      },
    });
  }

  private toInvoiceView(i: Invoice): InvoiceView {
    return {
      id: i.id,
      number: i.number,
      provider: i.provider as PaymentProviderName,
      amount: i.amount,
      currency: i.currency,
      status: i.status,
      periodStart: i.periodStart?.toISOString() ?? null,
      periodEnd: i.periodEnd?.toISOString() ?? null,
      url: i.url,
      createdAt: i.createdAt.toISOString(),
    };
  }
}
