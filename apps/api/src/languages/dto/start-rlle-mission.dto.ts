import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import type { StartRlleMissionRequest } from '@second-brain/shared';

export class StartRlleMissionDto implements StartRlleMissionRequest {
  @IsString()
  @MaxLength(120)
  missionId!: string;

  @IsOptional()
  @IsIn(['text', 'voice', 'mixed'])
  inputModality?: 'text' | 'voice' | 'mixed';

  @IsOptional()
  @IsString()
  @MaxLength(200)
  idempotencyKey?: string;
}
