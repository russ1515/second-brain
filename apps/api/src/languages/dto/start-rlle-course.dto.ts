import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import {
  CEFR_LEVELS,
  IMMERSION_INTENSITIES,
  LANGUAGE_CORRECTION_INTENSITIES,
  RLLE_GOAL_DOMAINS,
  type CefrLevel,
  type ImmersionIntensity,
  type LanguageCorrectionIntensity,
  type RlleGoalDomain,
  type StartRlleCourseRequest,
} from '@second-brain/shared';

export class StartRlleCourseDto implements StartRlleCourseRequest {
  @IsIn(['zero', 'declared-level'])
  startFrom!: 'zero' | 'declared-level';

  @IsOptional()
  @IsIn(CEFR_LEVELS as readonly string[])
  targetLevel?: CefrLevel;

  @IsOptional()
  @IsIn(RLLE_GOAL_DOMAINS as readonly string[])
  goalDomain?: RlleGoalDomain;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  goal?: string;

  @IsOptional()
  @IsIn(IMMERSION_INTENSITIES as readonly string[])
  immersionIntensity?: ImmersionIntensity;

  @IsOptional()
  @IsIn(LANGUAGE_CORRECTION_INTENSITIES as readonly string[])
  correctionIntensity?: LanguageCorrectionIntensity;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  idempotencyKey?: string;
}
