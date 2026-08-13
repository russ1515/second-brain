import { IsOptional, IsString, MaxLength } from 'class-validator';
import type { CreateTutorSessionRequest } from '@second-brain/shared';

export class CreateTutorSessionDto implements CreateTutorSessionRequest {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  focusConceptId?: string;
}
