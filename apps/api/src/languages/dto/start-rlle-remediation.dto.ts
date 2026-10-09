import { IsString, MaxLength, MinLength } from 'class-validator';
import type { StartRlleRemediationRequest } from '@second-brain/shared';

export class StartRlleRemediationDto implements StartRlleRemediationRequest {
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
