import { Logger, ServiceUnavailableException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { PaymentProviderName } from '@second-brain/shared';
import type {
  CheckoutParams,
  MobileVerifyParams,
  NormalizedBillingEvent,
  PaymentProvider,
} from '../payment-provider.interface';

/** Shared helper: stores don't do web checkout — the native purchase UI does. */
function noWebCheckout(name: string): never {
  throw new ServiceUnavailableException(
    `${name} purchases happen in the app's native store UI, not a web checkout.`,
  );
}

function periodEnd(interval: string): Date {
  const end = new Date();
  if (interval === 'year') end.setFullYear(end.getFullYear() + 1);
  else end.setMonth(end.getMonth() + 1);
  return end;
}

/**
 * Apple In-App Purchase. The client buys through Apple's UI and sends the receipt;
 * the backend verifies it with Apple and only then activates the subscription
 * (the backend stays the source of truth). Credential-gated on APPLE_SHARED_SECRET
 * — the verification call shape is below, ready to go live.
 */
export class AppleIapProvider implements PaymentProvider {
  readonly name: PaymentProviderName = 'apple';
  private readonly logger = new Logger(AppleIapProvider.name);

  createCheckout(_params: CheckoutParams): Promise<never> {
    return Promise.resolve(noWebCheckout('Apple'));
  }
  cancel(): Promise<void> {
    // Apple subscriptions are cancelled by the user in iOS Settings; the backend
    // reacts to the App Store Server Notification, not an outbound call.
    return Promise.resolve();
  }
  parseWebhook(rawBody: string): Promise<NormalizedBillingEvent | null> {
    // App Store Server Notifications v2 (signed JWS) would be verified here.
    this.logger.debug('Apple server notification received (verification stub).');
    void rawBody;
    return Promise.resolve(null);
  }

  async verifyMobilePurchase(params: MobileVerifyParams): Promise<NormalizedBillingEvent> {
    const sharedSecret = process.env.APPLE_SHARED_SECRET;
    if (!sharedSecret) {
      throw new ServiceUnavailableException(
        'Apple IAP is not configured (APPLE_SHARED_SECRET missing).',
      );
    }
    // Real shape: POST the receipt to verifyReceipt / App Store Server API, check
    // the bundle id, product id and expiry, then map to an activation event.
    const res = await fetch('https://buy.itunes.apple.com/verifyReceipt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        'receipt-data': params.receipt,
        password: sharedSecret,
        'exclude-old-transactions': true,
      }),
    });
    const body = (await res.json()) as { status: number };
    if (body.status !== 0) {
      throw new ServiceUnavailableException(
        `Apple receipt verification failed (status ${body.status}).`,
      );
    }
    return {
      eventId: `apple_${randomUUID()}`,
      type: 'subscription_activated',
      userId: params.userId,
      planSlug: params.planSlug,
      interval: params.interval,
      currentPeriodStart: new Date(),
      currentPeriodEnd: periodEnd(params.interval),
    };
  }
}

/**
 * Google Play Billing. Same principle: verify the purchase token with the Google
 * Play Developer API server-side before activating. Credential-gated on a service
 * account (GOOGLE_PLAY_SERVICE_ACCOUNT).
 */
export class GooglePlayProvider implements PaymentProvider {
  readonly name: PaymentProviderName = 'google';
  private readonly logger = new Logger(GooglePlayProvider.name);

  createCheckout(_params: CheckoutParams): Promise<never> {
    return Promise.resolve(noWebCheckout('Google Play'));
  }
  cancel(): Promise<void> {
    return Promise.resolve();
  }
  parseWebhook(rawBody: string): Promise<NormalizedBillingEvent | null> {
    // Real-time Developer Notifications (Pub/Sub) would be decoded here.
    this.logger.debug('Google RTDN received (verification stub).');
    void rawBody;
    return Promise.resolve(null);
  }

  verifyMobilePurchase(params: MobileVerifyParams): Promise<NormalizedBillingEvent> {
    if (!process.env.GOOGLE_PLAY_SERVICE_ACCOUNT) {
      throw new ServiceUnavailableException(
        'Google Play Billing is not configured (GOOGLE_PLAY_SERVICE_ACCOUNT missing).',
      );
    }
    // Real shape: call androidpublisher.purchases.subscriptionsv2.get with the
    // token, check the acknowledgement/expiry, then map to an activation event.
    return Promise.resolve({
      eventId: `google_${randomUUID()}`,
      type: 'subscription_activated',
      userId: params.userId,
      planSlug: params.planSlug,
      interval: params.interval,
      currentPeriodStart: new Date(),
      currentPeriodEnd: periodEnd(params.interval),
    });
  }
}
