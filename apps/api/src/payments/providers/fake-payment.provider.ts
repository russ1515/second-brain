import { Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { PaymentProviderName } from '@second-brain/shared';
import type {
  CheckoutParams,
  CheckoutResult,
  NormalizedBillingEvent,
  MobileVerifyParams,
  PaymentProvider,
} from '../payment-provider.interface';

/**
 * Development payment provider — the honest stand-in that lets the WHOLE billing
 * lifecycle be exercised without real Stripe/Apple/Google credentials, exactly
 * like the `fake` LLM/Speech providers. It performs no real charge.
 *
 * The "checkout URL" it returns encodes the intended purchase; completing it (via
 * `POST /billing/dev/confirm`) or posting a JSON event to the webhook produces a
 * normalised event the BillingService applies — so subscribe → renew → cancel →
 * change all work end-to-end in dev.
 */
export class FakePaymentProvider implements PaymentProvider {
  readonly name: PaymentProviderName = 'fake';
  private readonly logger = new Logger(FakePaymentProvider.name);

  createCheckout(params: CheckoutParams): Promise<CheckoutResult> {
    const sessionId = Buffer.from(
      JSON.stringify({
        userId: params.userId,
        planSlug: params.planSlug,
        interval: params.interval,
      }),
    ).toString('base64url');
    // A dev "hosted" URL. In dev the client completes it via /billing/dev/confirm.
    return Promise.resolve({
      url: `fake-checkout://confirm?session=${sessionId}`,
      sessionId,
    });
  }

  /** Turn a fake checkout session back into an activation event. */
  activation(sessionId: string): NormalizedBillingEvent {
    const decoded = JSON.parse(
      Buffer.from(sessionId, 'base64url').toString('utf8'),
    ) as { userId: string; planSlug: string; interval: string };
    const now = new Date();
    const end = new Date(now);
    if (decoded.interval === 'year') end.setFullYear(end.getFullYear() + 1);
    else end.setMonth(end.getMonth() + 1);
    return {
      eventId: `fake_${randomUUID()}`,
      type: 'subscription_activated',
      userId: decoded.userId,
      planSlug: decoded.planSlug as NormalizedBillingEvent['planSlug'],
      interval: decoded.interval as NormalizedBillingEvent['interval'],
      providerCustomerId: `fake_cus_${decoded.userId.slice(0, 8)}`,
      providerSubscriptionId: `fake_sub_${randomUUID().slice(0, 8)}`,
      currentPeriodStart: now,
      currentPeriodEnd: end,
      amount: 0,
      currency: 'usd',
    };
  }

  cancel(): Promise<void> {
    // Nothing to call remotely; the BillingService updates our source of truth.
    return Promise.resolve();
  }

  /** In dev the webhook body IS a normalised event (JSON) — no signature. */
  parseWebhook(rawBody: string): Promise<NormalizedBillingEvent | null> {
    try {
      const evt = JSON.parse(rawBody) as NormalizedBillingEvent;
      if (!evt.eventId || !evt.type || !evt.userId) return Promise.resolve(null);
      return Promise.resolve(evt);
    } catch {
      this.logger.warn('Fake webhook body was not valid JSON.');
      return Promise.resolve(null);
    }
  }

  verifyMobilePurchase(params: MobileVerifyParams): Promise<NormalizedBillingEvent> {
    const now = new Date();
    const end = new Date(now);
    if (params.interval === 'year') end.setFullYear(end.getFullYear() + 1);
    else end.setMonth(end.getMonth() + 1);
    return Promise.resolve({
      eventId: `fake_iap_${randomUUID()}`,
      type: 'subscription_activated',
      userId: params.userId,
      planSlug: params.planSlug,
      interval: params.interval,
      providerSubscriptionId: `fake_iap_${randomUUID().slice(0, 8)}`,
      currentPeriodStart: now,
      currentPeriodEnd: end,
      amount: 0,
      currency: 'usd',
    });
  }
}
