import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  BugStatus,
  ErrorEventSource,
  ErrorSeverity,
  IncidentSeverity,
  IncidentStatus,
  SupportCasePriority,
  SupportCaseStatus,
} from '@prisma/client';

const SAFE_IDENTIFIER = /^[A-Za-z0-9._:/-]{1,128}$/;

/** Untrusted, bounded client telemetry. Identity and entitlement are inferred server-side. */
export class CreateClientErrorEventDto {
  @IsEnum(ErrorEventSource)
  source!: ErrorEventSource;

  @IsOptional()
  @IsString()
  @Matches(SAFE_IDENTIFIER)
  errorCode?: string;

  /** Mobile compact alias; normalized on the server. */
  @IsOptional()
  @IsString()
  @Matches(SAFE_IDENTIFIER)
  code?: string;

  @IsOptional()
  @IsString()
  @Matches(SAFE_IDENTIFIER)
  errorType?: string;

  /** Mobile compact alias; normalized on the server. */
  @IsOptional()
  @IsString()
  @Matches(SAFE_IDENTIFIER)
  type?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1_024)
  message?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4_096)
  stack?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  route?: string;

  @IsOptional()
  @IsString()
  @Matches(SAFE_IDENTIFIER)
  feature?: string;

  @IsOptional()
  @IsString()
  @Matches(SAFE_IDENTIFIER)
  provider?: string;

  @IsOptional()
  @IsString()
  @Matches(SAFE_IDENTIFIER)
  model?: string;

  @IsOptional()
  @IsString()
  @Matches(SAFE_IDENTIFIER)
  appVersion?: string;

  /** Mobile compact alias; normalized on the server. */
  @IsOptional()
  @IsString()
  @Matches(SAFE_IDENTIFIER)
  version?: string;

  @IsOptional()
  @IsString()
  @Matches(SAFE_IDENTIFIER)
  buildVersion?: string;

  @IsOptional()
  @IsString()
  @Matches(SAFE_IDENTIFIER)
  platform?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  deviceMetadata?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @Matches(SAFE_IDENTIFIER)
  ingestId?: string;

  @IsOptional()
  @IsDateString()
  occurredAt?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10)
  retryAttempt?: number;
}

export class BugListQueryDto {
  @IsOptional()
  @IsEnum(BugStatus)
  status?: BugStatus;

  @IsOptional()
  @IsEnum(ErrorSeverity)
  severity?: ErrorSeverity;

  @IsOptional()
  @IsEnum(ErrorEventSource)
  source?: ErrorEventSource;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  feature?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  provider?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  model?: string;

  /** Plan attribution comes from immutable ErrorEvent context, never the client. */
  @IsOptional()
  @IsString()
  @MaxLength(128)
  plan?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  planSlug?: string;

  /** Matches either appVersion or buildVersion on an attributed ErrorEvent. */
  @IsOptional()
  @IsString()
  @MaxLength(128)
  version?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  platform?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  environment?: string;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  assignedToId?: string;

  @IsOptional()
  @IsIn(['lastSeen', 'firstSeen', 'occurrenceCount', 'affectedUsersCount', 'severity', 'status', 'createdAt'])
  sortBy?: 'lastSeen' | 'firstSeen' | 'occurrenceCount' | 'affectedUsersCount' | 'severity' | 'status' | 'createdAt';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';

  /** Search is deliberately limited to sanitized BugGroup metadata. */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  open?: boolean;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  hasDiagnostics?: boolean;

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

export class UpdateBugStatusDto {
  @IsEnum(BugStatus)
  status!: BugStatus;

  @IsOptional()
  @IsString()
  @MaxLength(1_024)
  reason?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  fixReference?: string;

  @IsOptional()
  @IsString()
  @Matches(SAFE_IDENTIFIER)
  targetRelease?: string;
}

export class AssignBugDto {
  @IsOptional()
  @IsString()
  @MaxLength(128)
  assignedToId?: string;

  /** Compatibility alias used by the first Admin control-center client. */
  @IsOptional()
  @IsString()
  @MaxLength(128)
  assigneeId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1_024)
  reason?: string;
}

export class MarkDuplicateDto {
  @IsOptional()
  @IsString()
  @MaxLength(128)
  duplicateOfId?: string;

  /** Compatibility alias for clients predating the explicit DTO field. */
  @IsOptional()
  @IsString()
  @MaxLength(128)
  duplicateOf?: string;

  @IsString()
  @MaxLength(1_024)
  reason!: string;
}

export class CreateSupportCaseDto {
  @IsString()
  @MaxLength(128)
  userId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  reportId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  bugGroupId?: string;

  @IsOptional()
  @IsEnum(SupportCasePriority)
  priority?: SupportCasePriority;
}

export class UpdateSupportCaseDto {
  @IsOptional()
  @IsEnum(SupportCaseStatus)
  status?: SupportCaseStatus;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  assignedToId?: string;

  @IsOptional()
  @IsEnum(SupportCasePriority)
  priority?: SupportCasePriority;

  @IsOptional()
  @IsString()
  @MaxLength(1_024)
  note?: string;

  /** Compatibility alias; rendered as an internal sanitized note. */
  @IsOptional()
  @IsString()
  @MaxLength(1_024)
  reason?: string;
}

export class CreateIncidentControlDto {
  @IsString()
  @MaxLength(180)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2_000)
  description?: string;

  @IsEnum(IncidentSeverity)
  severity!: IncidentSeverity;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  assignedToId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(128, { each: true })
  bugGroupIds?: string[];
}

export class UpdateIncidentStatusControlDto {
  @IsEnum(IncidentStatus)
  status!: IncidentStatus;

  @IsOptional()
  @IsString()
  @MaxLength(1_024)
  note?: string;

  /** Compatibility alias; the service never interprets it as an instruction. */
  @IsOptional()
  @IsString()
  @MaxLength(1_024)
  reason?: string;
}

export class CreateUserReportDto {
  @IsString()
  @MaxLength(40)
  category!: string;

  /** Untrusted free text. It is redacted before persistence and never executed. */
  @IsString()
  @MaxLength(2_000)
  message!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  route?: string;

  @IsOptional()
  @IsString()
  @Matches(SAFE_IDENTIFIER)
  feature?: string;

  /** Legacy observed-failure alias, kept only for existing mobile clients. */
  @IsOptional()
  @IsString()
  @Matches(SAFE_IDENTIFIER)
  requestId?: string;

  /** Opaque request of the preceding observed error, never a server operation. */
  @IsOptional()
  @IsString()
  @Matches(SAFE_IDENTIFIER)
  observedRequestId?: string;

  @IsOptional()
  @IsString()
  @Matches(SAFE_IDENTIFIER)
  appVersion?: string;

  @IsOptional()
  @IsString()
  @Matches(SAFE_IDENTIFIER)
  buildVersion?: string;

  @IsOptional()
  @IsString()
  @Matches(SAFE_IDENTIFIER)
  platform?: string;

  /** Opt-in only; no attachment, document, conversation or audio is captured. */
  @IsOptional()
  @IsBoolean()
  consentAdditionalDiagnostics?: boolean;
}

export class SupportCaseListQueryDto {
  @IsOptional()
  @IsIn(['open', 'in_progress', 'waiting_for_user', 'waiting_for_engineering', 'resolved', 'closed', 'reviewed', 'dismissed'])
  status?: string;

  /** `reports` exposes only sanitized, explicitly untrusted report records. */
  @IsOptional()
  @IsIn(['cases', 'reports'])
  view?: 'cases' | 'reports';

  @IsOptional()
  @IsIn(['me'])
  assignee?: 'me';

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

export class RunDiagnosticDto {
  @IsOptional()
  @IsIn(['rule_based', 'ai_assisted'])
  kind?: 'rule_based' | 'ai_assisted';

  /** Human review context only; it is sanitized into the audit trail. */
  @IsOptional()
  @IsString()
  @MaxLength(1_024)
  reason?: string;
}
