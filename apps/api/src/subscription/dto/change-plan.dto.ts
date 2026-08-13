import { IsIn } from 'class-validator';
import { PLAN_SLUGS, type ChangePlanRequest, type PlanSlug } from '@second-brain/shared';

export class ChangePlanDto implements ChangePlanRequest {
  @IsIn(PLAN_SLUGS as readonly string[])
  slug!: PlanSlug;
}
