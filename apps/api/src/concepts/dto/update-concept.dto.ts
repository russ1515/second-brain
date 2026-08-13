import {
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import type { UpdateConceptRequest } from '@second-brain/shared';

export class UpdateConceptDto implements UpdateConceptRequest {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;
}
