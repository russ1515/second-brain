import { Logger, ServiceUnavailableException } from '@nestjs/common';
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

  verifyMobilePurchase(params: MobileVerifyParams): Promise<NormalizedBillingEvent> {
    void params;
    // A status-only verifyReceipt call is not sufficient proof: it must also
    // validate the signed transaction, bundle id, product-to-plan mapping,
    // ownership and provider expiry. Until that complete verifier is wired, fail
    // closed so an unrelated valid receipt can never activate a paid plan.
    throw new ServiceUnavailableException(
      'Apple purchase verification is not enabled yet; no subscription was changed.',
    );
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
    void params;
    // Presence of service-account JSON is not verification. A real verifier must
    // call subscriptionsv2.get and validate package, product/base plan,
    // ownership, acknowledgement, state and expiry. Never synthesize a success.
    throw new ServiceUnavailableException(
      'Google Play purchase verification is not enabled yet; no subscription was changed.',
    );
  }
}
