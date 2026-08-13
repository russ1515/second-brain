import { IsIn, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import type { CreateGoalRequest, GoalPeriod } from '@second-brain/shared';

const PERIODS: GoalPeriod[] = ['daily', 'weekly', 'monthly'];

export class CreateGoalDto implements CreateGoalRequest {
  @IsIn(PERIODS)
  period!: GoalPeriod;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;
}
