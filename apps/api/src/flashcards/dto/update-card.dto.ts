import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import type { UpdateCardRequest } from '@second-brain/shared';

export class UpdateCardDto implements UpdateCardRequest {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  front?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  back?: string;
}
