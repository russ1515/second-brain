import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const ACCOUNT_STATUSES = ['active', 'suspended', 'banned', 'deletion_pending'] as const;
const PLAN_SLUGS = ['free', 'pro', 'pro_max'] as const;
const SUBSCRIPTION_STATUSES = [
  'free', 'payment_pending', 'active', 'trialing', 'past_due',
  'canceled', 'incomplete', 'expired', 'payment_failed',
] as const;
const QUOTA_STATES = ['PRIMARY', 'FALLBACK', 'BLOCKED'] as const;
const QUOTA_RESOURCES = [
  'AI_TEXT', 'VOICE_SECONDS', 'DOCUMENT_PAGES', 'OCR_PAGES',
  'EMBEDDING_UNITS', 'WEB_SEARCH', 'DEEP_RESEARCH', 'ACADEMIC_AI',
] as const;

/** Bounded offset pagination.  The admin directory never hydrates all users. */
export class AdminPaginationQueryDto {
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

export class UserDirectoryQueryDto extends AdminPaginationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  search?: string;

  @IsOptional()
  @IsIn(ACCOUNT_STATUSES)
  accountStatus?: (typeof ACCOUNT_STATUSES)[number];

  @IsOptional()
  @IsIn(PLAN_SLUGS)
  plan?: (typeof PLAN_SLUGS)[number];

  @IsOptional()
  @IsIn(SUBSCRIPTION_STATUSES)
  subscriptionStatus?: (typeof SUBSCRIPTION_STATUSES)[number];

  @IsOptional()
  @IsIn(QUOTA_STATES)
  quotaState?: (typeof QUOTA_STATES)[number];

  @IsOptional()
  @IsIn(['createdAt', 'lastActiveAt', 'email', 'accountStatus', 'plan', 'subscriptionStatus'])
  sortBy: 'createdAt' | 'lastActiveAt' | 'email' | 'accountStatus' | 'plan' | 'subscriptionStatus' = 'createdAt';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDirection: 'asc' | 'desc' = 'desc';
}

export class LearnerProfileQueryDto {
  @IsOptional()
  @IsIn(['standard', 'restricted', 'highly_restricted'])
  access: 'standard' | 'restricted' | 'highly_restricted' = 'standard';

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason?: string;
}

/** Elevated learner-profile access is body-based so the reason is never put in
 * a URL, proxy log, browser history, or analytics query string. */
export class LearnerProfileAccessDto {
  @IsIn(['restricted', 'highly_restricted'])
  access!: 'restricted' | 'highly_restricted';

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason?: string;
}

export class PlanOverrideDto {
  @IsIn(['pro', 'pro_max'])
  plan!: 'pro' | 'pro_max';

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;

  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

export class BetaAccessDto extends PlanOverrideDto {
  @IsDateString()
  declare startsAt: string;

  @IsDateString()
  declare expiresAt: string;
}

export class QuotaAdjustmentDto {
  @IsIn(QUOTA_RESOURCES)
  resource!: (typeof QUOTA_RESOURCES)[number];

  /** A positive credit only.  Debits and resets are intentionally not exposed. */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1_000_000_000)
  amount!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  cycleId?: string;
}

export class CreateSupportNoteDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(4_000)
  body!: string;

  /** Why an internal note is necessary; recorded separately from its body. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}

export class ProfileReviewDto {
  @IsIn(['MARK_REVIEWED', 'REQUEST_USER_UPDATE'])
  action!: 'MARK_REVIEWED' | 'REQUEST_USER_UPDATE';

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}

export { ACCOUNT_STATUSES, PLAN_SLUGS, QUOTA_RESOURCES, QUOTA_STATES, SUBSCRIPTION_STATUSES };
