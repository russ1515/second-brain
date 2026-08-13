import { ArrayNotEmpty, IsArray, IsString } from 'class-validator';
import type { SubmitAssessmentRequest } from '@second-brain/shared';

export class SubmitAssessmentDto implements SubmitAssessmentRequest {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  answers!: string[];
}
