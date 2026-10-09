import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsString, MaxLength } from 'class-validator';
import type { SubmitRlleAutonomyRequest } from '@second-brain/shared';

export class SubmitRlleAutonomyDto implements SubmitRlleAutonomyRequest {
  @IsString()
  @MaxLength(200)
  experienceSessionId!: string;

  @IsString()
  @MaxLength(200)
  lessonId!: string;

  @IsString()
  @MaxLength(200)
  assessmentId!: string;

  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(8_000, { each: true })
  answers!: string[];
}
