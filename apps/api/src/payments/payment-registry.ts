import {
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { PaymentProviderName } from '@second-brain/shared';
import type { PaymentProvider } from './payment-provider.interface';
import { FakePaymentProvider } from './providers/fake-payment.provider';
import { StripePaymentProvider } from './providers/stripe-payment.provider';
import {
  AppleIapProvider,
  GooglePlayProvider,
} from './providers/store-payment.providers';

/**
 * Holds every payment provider and hands the right one to the BillingService.
 * The default WEB checkout provider is chosen by `PAYMENT_PROVIDER` (stripe |
 * fake, default fake in dev); webhooks and mobile verification pick their
 * provider explicitly by name. Business code never touches a concrete SDK.
 */
@Injectable()
export class PaymentRegistry {
  private readonly providers: Map<PaymentProviderName, PaymentProvider>;
  readonly fake: FakePaymentProvider;

  constructor() {
    this.fake = new FakePaymentProvider();
    this.providers = new Map<PaymentProviderName, PaymentProvider>([
      ['fake', this.fake],
      ['stripe', new StripePaymentProvider()],
      ['apple', new AppleIapProvider()],
      ['google', new GooglePlayProvider()],
    ]);
  }

  /** Fake checkout is a local development/test tool, never a production seam. */
  get fakeAllowed(): boolean {
    return process.env.NODE_ENV !== 'production';
  }

  get(name: PaymentProviderName): PaymentProvider {
    if (name === 'fake' && !this.fakeAllowed) {
      throw new NotFoundException('The fake payment provider is disabled.');
    }
    const provider = this.providers.get(name);
    if (!provider) throw new NotFoundException(`Unknown payment provider "${name}".`);
    return provider;
  }

  /** The provider used for hosted web checkout. */
  get defaultWebProviderName(): PaymentProviderName {
    const configured = process.env.PAYMENT_PROVIDER as PaymentProviderName | undefined;
    if (configured === 'stripe') return 'stripe';
    if ((configured === 'fake' || !configured) && this.fakeAllowed) return 'fake';
    if (!configured) {
      throw new ServiceUnavailableException(
        'PAYMENT_PROVIDER must be configured explicitly in production.',
      );
    }
    throw new ServiceUnavailableException(
      `Payment provider "${configured}" cannot be used for web checkout.`,
    );
  }

  defaultWebProvider(): PaymentProvider {
    return this.get(this.defaultWebProviderName);
  }
}
