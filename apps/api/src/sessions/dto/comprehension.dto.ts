import { IsString, MaxLength, MinLength } from 'class-validator';
import type { ComprehensionRequest } from '@second-brain/shared';

export class ComprehensionDto implements ComprehensionRequest {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  question!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  answer!: string;
}
