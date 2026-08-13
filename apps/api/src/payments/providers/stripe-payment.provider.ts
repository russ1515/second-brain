import { Logger, ServiceUnavailableException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { PaymentProviderName, PlanSlug } from '@second-brain/shared';
import type {
  CheckoutParams,
  CheckoutResult,
  NormalizedBillingEvent,
  PaymentProvider,
} from '../payment-provider.interface';

/**
 * Stripe provider — real integration shape, SDK-free (Stripe REST + webhook
 * signature verified with node crypto). It NEVER sees card data: it creates a
 * hosted Checkout Session and the learner pays on Stripe's page.
 *
 * It is credential-gated: without `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET`
 * and a price id per (plan, interval) it raises a clear "not configured" error.
 * Everything below is the correct wire shape to go live once those exist.
 */
export class StripePaymentProvider implements PaymentProvider {
  readonly name: PaymentProviderName = 'stripe';
  private readonly logger = new Logger(StripePaymentProvider.name);

  private get secretKey(): string | undefined {
    return process.env.STRIPE_SECRET_KEY;
  }
  private get webhookSecret(): string | undefined {
    return process.env.STRIPE_WEBHOOK_SECRET;
  }
  private priceId(slug: PlanSlug, interval: string): string | undefined {
    return process.env[`STRIPE_PRICE_${slug.toUpperCase()}_${interval.toUpperCase()}`];
  }

  async createCheckout(params: CheckoutParams): Promise<CheckoutResult> {
    if (!this.secretKey) {
      throw new ServiceUnavailableException(
        'Stripe is not configured (STRIPE_SECRET_KEY missing).',
      );
    }
    const price = this.priceId(params.planSlug, params.interval);
    if (!price) {
      throw new ServiceUnavailableException(
        `No Stripe price configured for ${params.planSlug}/${params.interval}.`,
      );
    }
    const appUrl = process.env.APP_PUBLIC_URL ?? 'http://localhost:8081';
    const body = new URLSearchParams({
      mode: 'subscription',
      'line_items[0][price]': price,
      'line_items[0][quantity]': '1',
      success_url: `${appUrl}/subscription?checkout=success`,
      cancel_url: `${appUrl}/subscription?checkout=cancel`,
      client_reference_id: params.userId,
      'metadata[userId]': params.userId,
      'metadata[planSlug]': params.planSlug,
      'metadata[interval]': params.interval,
    });
    const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });
    if (!res.ok) {
      this.logger.error(`Stripe checkout failed: ${res.status} ${await res.text()}`);
      throw new ServiceUnavailableException('Could not start Stripe checkout.');
    }
    const session = (await res.json()) as { id: string; url: string };
    return { url: session.url, sessionId: session.id };
  }

  async cancel(providerSubscriptionId: string | null, atPeriodEnd: boolean): Promise<void> {
    if (!this.secretKey || !providerSubscriptionId) return;
    const url = `https://api.stripe.com/v1/subscriptions/${providerSubscriptionId}`;
    if (atPeriodEnd) {
      await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ cancel_at_period_end: 'true' }),
      });
    } else {
      await fetch(url, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${this.secretKey}` },
      });
    }
  }

  parseWebhook(
    rawBody: string,
    signature: string | undefined,
  ): Promise<NormalizedBillingEvent | null> {
    if (!this.webhookSecret) {
      throw new ServiceUnavailableException(
        'Stripe webhooks not configured (STRIPE_WEBHOOK_SECRET missing).',
      );
    }
    if (!signature || !this.verifySignature(rawBody, signature)) {
      throw new ServiceUnavailableException('Invalid Stripe webhook signature.');
    }
    const event = JSON.parse(rawBody) as {
      id: string;
      type: string;
      data: { object: Record<string, unknown> };
    };
    return Promise.resolve(this.normalize(event));
  }

  /** Verify Stripe's `t=…,v1=…` signature scheme with HMAC-SHA256. */
  private verifySignature(payload: string, header: string): boolean {
    const parts = Object.fromEntries(
      header.split(',').map((kv) => kv.split('=') as [string, string]),
    );
    const timestamp = parts.t;
    const expected = parts.v1;
    if (!timestamp || !expected) return false;
    const signed = createHmac('sha256', this.webhookSecret as string)
      .update(`${timestamp}.${payload}`)
      .digest('hex');
    try {
      return timingSafeEqual(Buffer.from(signed), Buffer.from(expected));
    } catch {
      return false;
    }
  }

  private normalize(event: {
    id: string;
    type: string;
    data: { object: Record<string, unknown> };
  }): NormalizedBillingEvent | null {
    const obj = event.data.object;
    const metadata = (obj.metadata ?? {}) as Record<string, string>;
    const userId = metadata.userId ?? (obj.client_reference_id as string);
    if (!userId) return null;
    const base = {
      eventId: event.id,
      userId,
      planSlug: metadata.planSlug as PlanSlug | undefined,
      interval: metadata.interval as NormalizedBillingEvent['interval'],
      providerCustomerId: obj.customer as string | undefined,
      providerSubscriptionId: obj.subscription as string | undefined,
    };
    switch (event.type) {
      case 'checkout.session.completed':
        return { ...base, type: 'subscription_activated' };
      case 'invoice.paid':
        return { ...base, type: 'subscription_renewed' };
      case 'customer.subscription.updated':
        return { ...base, type: 'subscription_updated' };
      case 'customer.subscription.deleted':
        return { ...base, type: 'subscription_canceled' };
      case 'invoice.payment_failed':
        return { ...base, type: 'payment_failed' };
      default:
        return null;
    }
  }
}
