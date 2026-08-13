import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Prisma, type Invoice } from '@prisma/client';
import { randomUUID } from 'node:crypto';
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
    return { provider: provider.name, url: result.url, sessionId: result.sessionId };
  }

  /** Complete a FAKE checkout in dev (stands in for the provider callback). */
  async devConfirm(userId: string, sessionId: string): Promise<void> {
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
    if (event) await this.applyEvent(provider, event);
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
      await this.downgradeToFree(userId);
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
  ): Promise<void> {
    // Idempotency: record the event first; a duplicate (re-delivery) is ignored.
    try {
      await this.prisma.webhookEvent.create({
        data: { provider, eventId: event.eventId, type: event.type },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        this.logger.debug(`Duplicate event ${provider}/${event.eventId} ignored.`);
        return;
      }
      throw e;
    }

    await this.subscriptions.resolveForUser(event.userId); // ensure a row exists

    switch (event.type) {
      case 'subscription_activated':
      case 'subscription_renewed':
      case 'subscription_updated': {
        const plan = event.planSlug
          ? await this.plans.bySlug(event.planSlug)
          : null;
        await this.prisma.subscription.update({
          where: { userId: event.userId },
          data: {
            ...(plan ? { planId: plan.id } : {}),
            status: 'active',
            provider,
            interval: event.interval ?? undefined,
            providerCustomerId: event.providerCustomerId ?? undefined,
            providerSubscriptionId: event.providerSubscriptionId ?? undefined,
            currentPeriodStart: event.currentPeriodStart ?? undefined,
            currentPeriodEnd: event.currentPeriodEnd ?? undefined,
            cancelAtPeriodEnd: false,
          },
        });
        await this.recordPaymentAndInvoice(provider, event);
        break;
      }
      case 'payment_failed':
        await this.prisma.subscription.update({
          where: { userId: event.userId },
          data: { status: 'past_due' },
        });
        await this.prisma.payment.create({
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
        await this.downgradeToFree(event.userId);
        break;
    }
  }

  private async recordPaymentAndInvoice(
    provider: PaymentProviderName,
    event: NormalizedBillingEvent,
  ): Promise<void> {
    const amount = event.amount ?? 0;
    const currency = event.currency ?? 'usd';
    await this.prisma.payment.create({
      data: {
        userId: event.userId,
        provider,
        providerRef: event.providerSubscriptionId,
        amount,
        currency,
        status: 'succeeded',
        purpose: event.type === 'subscription_renewed' ? 'renewal' : 'subscription',
      },
    });
    await this.prisma.invoice.create({
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

  private async downgradeToFree(userId: string): Promise<void> {
    const free = await this.plans.bySlug('free');
    if (!free) return;
    await this.prisma.subscription.update({
      where: { userId },
      data: {
        planId: free.id,
        status: 'active',
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
