import { IsBoolean, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import type {
  CoachDifficulty,
  CoachMethod,
  CoachPace,
  UpdateCoachRequest,
} from '@second-brain/shared';

const PACES: CoachPace[] = ['gentle', 'steady', 'intensive'];
const DIFFICULTIES: CoachDifficulty[] = ['beginner', 'intermediate', 'advanced'];
const METHODS: CoachMethod[] = ['practice', 'reading', 'socratic', 'mixed'];

/** A learner override of the coach's guidance (Sprint 9.2). */
export class UpdateCoachDto implements UpdateCoachRequest {
  @IsOptional()
  @IsIn(PACES)
  pace?: CoachPace;

  @IsOptional()
  @IsIn(DIFFICULTIES)
  difficulty?: CoachDifficulty;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(120)
  sessionMinutes?: number;

  @IsOptional()
  @IsIn(METHODS)
  method?: CoachMethod;

  @IsOptional()
  @IsBoolean()
  reset?: boolean;
}
