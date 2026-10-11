import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import type {
  RlleScopedMasteryKind,
  StartRlleScopedMasteryRequest,
} from '@second-brain/shared';

export class StartRlleScopedMasteryDto implements StartRlleScopedMasteryRequest {
  @IsString()
  @MaxLength(200)
  experienceSessionId!: string;

  @IsString()
  @MaxLength(200)
  lessonId!: string;

  @IsIn(['milestone', 'pillar_exam'])
  scopeKind!: RlleScopedMasteryKind;

  @IsString()
  @MaxLength(400)
  targetId!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(200)
  idempotencyKey!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  remediationPlanId?: string;
}
