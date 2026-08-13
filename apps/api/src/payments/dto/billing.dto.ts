import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import {
  PLAN_SLUGS,
  type BillingInterval,
  type CheckoutRequest,
  type CancelSubscriptionRequest,
  type MobileVerifyRequest,
  type PlanSlug,
} from '@second-brain/shared';

const INTERVALS = ['month', 'year'] as const;

export class CheckoutDto implements CheckoutRequest {
  @IsIn(PLAN_SLUGS as readonly string[])
  slug!: PlanSlug;

  @IsIn(INTERVALS as readonly string[])
  interval!: BillingInterval;
}

export class CancelDto implements CancelSubscriptionRequest {
  @IsOptional()
  @IsBoolean()
  atPeriodEnd?: boolean;
}

export class MobileVerifyDto implements MobileVerifyRequest {
  @IsIn(['apple', 'google'])
  provider!: 'apple' | 'google';

  @IsString()
  @MaxLength(20_000)
  receipt!: string;

  @IsIn(PLAN_SLUGS as readonly string[])
  slug!: PlanSlug;

  @IsOptional()
  @IsIn(INTERVALS as readonly string[])
  interval?: BillingInterval;
}

export class DevConfirmDto {
  @IsString()
  @MaxLength(2000)
  sessionId!: string;
}
