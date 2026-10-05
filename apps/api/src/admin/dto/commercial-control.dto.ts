import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const PUBLIC_PLAN_SLUGS = ['free', 'pro', 'pro_max'] as const;
const COMMERCIAL_RANGES = ['today', '7d', '30d', '90d'] as const;

/** Bounded pagination for the commercial control-center tables. */
export class CommercialPaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 25;
}

/** Filters only durable, non-secret commercial attribution dimensions. */
export class CommercialUsageQueryDto extends CommercialPaginationQueryDto {
  @IsOptional()
  @IsIn(COMMERCIAL_RANGES)
  range: (typeof COMMERCIAL_RANGES)[number] = '30d';

  @IsOptional()
  @IsIn(PUBLIC_PLAN_SLUGS)
  plan?: (typeof PUBLIC_PLAN_SLUGS)[number];

  @IsOptional()
  @IsString()
  @MaxLength(120)
  feature?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  provider?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  model?: string;

  /** Internal opaque user id, never an email search field. */
  @IsOptional()
  @IsString()
  @MaxLength(128)
  userId?: string;
}

export class CommercialSubscriptionQueryDto extends CommercialPaginationQueryDto {
  @IsOptional()
  @IsIn(PUBLIC_PLAN_SLUGS)
  plan?: (typeof PUBLIC_PLAN_SLUGS)[number];
}

export class CommercialAuditQueryDto extends CommercialPaginationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  action?: string;
}

/** Prices are whole minor currency units; USD cents are never accepted as floats. */
export class UpdatePlanPricingDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10_000_000)
  priceMonthly!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100_000_000)
  priceYearly!: number;

  /** Optimistic concurrency guard against a stale administrative screen. */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}
