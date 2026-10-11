import { IsIn, IsInt, IsString, Max, MaxLength, Min } from 'class-validator';
import {
  LANGUAGE_TRAINING_FORMATS,
  type LanguageTrainingFormat,
  type RecordRlleRemediationExerciseRequest,
} from '@second-brain/shared';

export class RecordRlleRemediationExerciseDto
implements RecordRlleRemediationExerciseRequest {
  @IsString()
  @MaxLength(200)
  remediationPlanId!: string;

  @IsString()
  @MaxLength(240)
  failedAttemptId!: string;

  @IsString()
  @MaxLength(200)
  lessonId!: string;

  @IsString()
  @MaxLength(200)
  exerciseAttemptId!: string;

  @IsInt()
  @Min(0)
  @Max(500)
  exerciseIndex!: number;

  @IsIn(LANGUAGE_TRAINING_FORMATS)
  trainingFormat!: LanguageTrainingFormat;
}
