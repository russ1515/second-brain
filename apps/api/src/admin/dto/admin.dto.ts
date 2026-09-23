import { Type } from 'class-transformer';
import { IsArray, IsDateString, IsDefined, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import type { AdminRole } from '@prisma/client';
import {
  INCIDENT_SEVERITIES,
  INCIDENT_STATUSES,
  PLAN_SLUGS,
  type CreateIncidentRequest,
  type CreateReportRequest,
  type IncidentSeverity,
  type IncidentStatus,
  type PlanSlug,
  type ResolveReportRequest,
  type SetUserPlanRequest,
  type UpdateIncidentStatusRequest,
} from '@second-brain/shared';

export class CreateIncidentDto implements CreateIncidentRequest {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsIn(INCIDENT_SEVERITIES as readonly string[])
  severity!: IncidentSeverity;

  /** Explicit human linkage; only the incident workflow can attach bugs. */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(128, { each: true })
  bugGroupIds?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(128)
  assignedToId?: string;
}

export class UpdateIncidentStatusDto implements UpdateIncidentStatusRequest {
  @IsIn(INCIDENT_STATUSES as readonly string[])
  status!: IncidentStatus;
}

/** Safe, server-side filters for the Incident Control Center. */
export class IncidentListQueryDto {
  @IsOptional()
  @IsIn(['open', 'investigating', 'identified', 'monitoring', 'resolved'])
  status?: string;

  @IsOptional()
  @IsIn(INCIDENT_SEVERITIES as readonly string[])
  severity?: IncidentSeverity;

  /** Source is matched only against linked BugGroup metadata. */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  source?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

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

export class SetUserPlanDto implements SetUserPlanRequest {
  @IsIn(PLAN_SLUGS as readonly string[])
  slug!: PlanSlug;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}

export class AdminReasonDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}

export class BanUserDto extends AdminReasonDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  internalNote?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  reference?: string;
}

export class AssignAdminRoleDto extends AdminReasonDto {
  @IsIn(['SUPER_ADMIN', 'TECH_OPS', 'SUPPORT', 'FINANCE', 'SECURITY', 'ANALYTICS'])
  role!: AdminRole;
}

export class EntitlementOverrideDto extends AdminReasonDto {
  @IsIn(['quota', 'feature'])
  kind!: 'quota' | 'feature';

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  key!: string;

  @IsDefined()
  value!: unknown;

  @IsOptional()
  @IsDateString()
  endsAt?: string;
}

export class ResolveReportDto implements ResolveReportRequest {
  @IsIn(['reviewed', 'dismissed'])
  status!: 'reviewed' | 'dismissed';
}

export class CreateReportDto implements CreateReportRequest {
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  category!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  message!: string;
}
