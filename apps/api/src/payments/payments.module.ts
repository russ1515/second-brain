import { Module } from '@nestjs/common';
import { SubscriptionModule } from '../subscription/subscription.module';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { PaymentRegistry } from './payment-registry';

/** Billing & Payments (Sprint 8.2). Provider-agnostic engine: Stripe (hosted
 *  checkout), Apple IAP & Google Play (server-verified receipts), and a fully
 *  working `fake` provider for dev. Reuses the Subscription engine (8.1) — the
 *  backend is the single source of truth. */
@Module({
  imports: [SubscriptionModule],
  controllers: [BillingController],
  providers: [BillingService, PaymentRegistry],
  exports: [BillingService],
})
export class PaymentsModule {}
