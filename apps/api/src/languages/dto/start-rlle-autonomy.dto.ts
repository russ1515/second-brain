import { IsString, MaxLength, MinLength } from 'class-validator';
import type { StartRlleAutonomyRequest } from '@second-brain/shared';

export class StartRlleAutonomyDto implements StartRlleAutonomyRequest {
  @IsString()
  @MaxLength(200)
  experienceSessionId!: string;

  @IsString()
  @MaxLength(200)
  lessonId!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(200)
  idempotencyKey!: string;
}
