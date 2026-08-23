import { IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import type { GenerateAssessmentRequest } from '@second-brain/shared';

/** Ask for a short diagnostic on one subject (UI/UX Sprint 2, task 2.12). */
export class GenerateAssessmentDto implements GenerateAssessmentRequest {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  subject!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  count?: number;
}
