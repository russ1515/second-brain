/** Billing & Payments (Sprint 8.2). Provider-agnostic contracts. The backend is
 *  the single source of truth: subscription state changes only from a verified
 *  provider event (webhook / server-verified receipt), never from the client. No
 *  card data ever reaches this app — Stripe uses hosted Checkout, Apple/Google
 *  use their native purchase UIs with server-side verification. */

import type { PlanSlug } from './subscription';

export type PaymentProviderName = 'stripe' | 'apple' | 'google' | 'fake';

export const PAYMENT_PROVIDERS: readonly PaymentProviderName[] = [
  'stripe',
  'apple',
  'google',
  'fake',
] as const;

export type BillingInterval = 'month' | 'year';

export type PaymentStatus = 'pending' | 'succeeded' | 'failed' | 'refunded';

/** Start a hosted checkout for a paid plan. */
export interface CheckoutRequest {
  slug: PlanSlug;
  interval: BillingInterval;
}

/** Where to send the user to complete payment. For hosted providers this is a
 *  redirect URL; the subscription only activates once the provider confirms. */
export interface CheckoutResponse {
  provider: PaymentProviderName;
  /** Redirect URL (Stripe Checkout, or the dev-confirm page for the fake provider). */
  url: string;
  /** Provider session id, when applicable. */
  sessionId: string | null;
}

export interface CancelSubscriptionRequest {
  /** Cancel at period end (default) vs immediately. */
  atPeriodEnd?: boolean;
}

/** Verify a completed mobile purchase (Apple IAP / Google Play). The client
 *  sends the receipt/token; the backend verifies it with the store and only then
 *  activates the subscription. */
export interface MobileVerifyRequest {
  provider: 'apple' | 'google';
  /** Apple receipt data or Google purchase token. */
  receipt: string;
  slug: PlanSlug;
  interval?: BillingInterval;
}

export interface InvoiceView {
  id: string;
  number: string;
  provider: PaymentProviderName;
  amount: number;
  currency: string;
  status: string;
  periodStart: string | null;
  periodEnd: string | null;
  url: string | null;
  createdAt: string;
}
