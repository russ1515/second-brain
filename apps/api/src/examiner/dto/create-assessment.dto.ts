import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  ASSESSMENT_TYPES,
  type AssessmentDifficulty,
  type AssessmentType,
  type CreateAssessmentRequest,
} from '@second-brain/shared';

const DIFFICULTIES = ['beginner', 'intermediate', 'advanced'] as const;

export class CreateAssessmentDto implements CreateAssessmentRequest {
  @IsIn(ASSESSMENT_TYPES as readonly string[])
  type!: AssessmentType;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  topic!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  questionCount?: number;

  @IsOptional()
  @IsIn(DIFFICULTIES as readonly string[])
  difficulty?: AssessmentDifficulty;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  conceptId?: string;
}
