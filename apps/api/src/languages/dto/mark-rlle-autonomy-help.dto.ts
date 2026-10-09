import { IsString, MaxLength } from 'class-validator';
import type { MarkRlleAutonomyHelpRequest } from '@second-brain/shared';

export class MarkRlleAutonomyHelpDto implements MarkRlleAutonomyHelpRequest {
  @IsString()
  @MaxLength(200)
  experienceSessionId!: string;

  @IsString()
  @MaxLength(200)
  lessonId!: string;

  @IsString()
  @MaxLength(200)
  assessmentId!: string;
}
