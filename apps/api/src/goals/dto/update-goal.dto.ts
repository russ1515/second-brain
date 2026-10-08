import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import type { GoalPeriod, UpdateGoalRequest } from '@second-brain/shared';

const PERIODS: GoalPeriod[] = ['daily', 'weekly', 'monthly'];

export class UpdateGoalDto implements UpdateGoalRequest {
  @IsOptional()
  @IsIn(PERIODS)
  period?: GoalPeriod;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title?: string;
}
