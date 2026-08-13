import { IsOptional, IsString, MaxLength } from 'class-validator';
import type { StartSessionRequest } from '@second-brain/shared';

export class StartSessionDto implements StartSessionRequest {
  @IsOptional()
  @IsString()
  conceptId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  topic?: string;
}
