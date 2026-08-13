import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import type { SynthesizeRequest } from '@second-brain/shared';

export class SynthesizeDto implements SynthesizeRequest {
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  text!: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  language?: string;
}
