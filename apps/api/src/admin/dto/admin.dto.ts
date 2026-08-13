import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
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
}

export class UpdateIncidentStatusDto implements UpdateIncidentStatusRequest {
  @IsIn(INCIDENT_STATUSES as readonly string[])
  status!: IncidentStatus;
}

export class SetUserPlanDto implements SetUserPlanRequest {
  @IsIn(PLAN_SLUGS as readonly string[])
  slug!: PlanSlug;
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
