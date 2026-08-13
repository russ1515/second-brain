import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import type { CreateConceptRequest } from '@second-brain/shared';

export class CreateConceptDto implements CreateConceptRequest {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;
}
