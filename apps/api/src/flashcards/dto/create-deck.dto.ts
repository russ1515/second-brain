import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import type { CreateDeckRequest } from '@second-brain/shared';

export class CreateDeckDto implements CreateDeckRequest {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;
}
