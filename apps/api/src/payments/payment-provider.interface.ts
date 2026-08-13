import type {
  BillingInterval,
  PaymentProviderName,
  PlanSlug,
} from '@second-brain/shared';

/** What a checkout needs to know to send the user to the right paid flow. */
export interface CheckoutParams {
  userId: string;
  planSlug: PlanSlug;
  planName: string;
  interval: BillingInterval;
}

export interface CheckoutResult {
  /** Hosted redirect URL the client opens to complete payment. */
  url: string;
  /** Provider session id, when applicable. */
  sessionId: string | null;
}

/** A provider event, NORMALISED into the vocabulary the backend acts on. Every
 *  provider (Stripe webhook, Apple/Google receipt) is mapped to one of these;
 *  the BillingService is the only thing that mutates subscription state, and only
 *  from one of these — never from the client. */
export interface NormalizedBillingEvent {
  /** Idempotency key, unique per provider. */
  eventId: string;
  type:
    | 'subscription_activated'
    | 'subscription_renewed'
    | 'subscription_updated'
    | 'subscription_canceled'
    | 'payment_failed';
  /** Resolved subscriber (from provider metadata / customer mapping). */
  userId: string;
  planSlug?: PlanSlug;
  interval?: BillingInterval;
  providerCustomerId?: string;
  providerSubscriptionId?: string;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  /** Minor currency units for the associated charge, when any. */
  amount?: number;
  currency?: string;
}

export interface MobileVerifyParams {
  userId: string;
  receipt: string;
  planSlug: PlanSlug;
  interval: BillingInterval;
}

/**
 * The contract every payment provider satisfies. Business code (BillingService)
 * depends on this only — never on Stripe/Apple/Google SDKs directly. Adding a
 * provider means writing one class here and registering it; nothing else changes.
 *
 * `verifyMobilePurchase` is OPTIONAL: only store providers (Apple/Google) have
 * it; `createCheckout` is what hosted web providers (Stripe) use.
 */
export interface PaymentProvider {
  readonly name: PaymentProviderName;

  /** Start a hosted checkout (web). */
  createCheckout(params: CheckoutParams): Promise<CheckoutResult>;

  /** Cancel at the provider. `atPeriodEnd=false` cancels immediately. */
  cancel(providerSubscriptionId: string | null, atPeriodEnd: boolean): Promise<void>;

  /** Verify + normalise an inbound webhook. Returns null if it is not a billing
   *  event we care about. Throws if the signature is invalid. */
  parseWebhook(
    rawBody: string,
    signature: string | undefined,
  ): Promise<NormalizedBillingEvent | null>;

  /** Verify a completed mobile purchase and normalise it (Apple/Google only). */
  verifyMobilePurchase?(params: MobileVerifyParams): Promise<NormalizedBillingEvent>;
}
