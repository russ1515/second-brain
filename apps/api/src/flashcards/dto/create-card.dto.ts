import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import type { CreateCardRequest } from '@second-brain/shared';

export class CreateCardDto implements CreateCardRequest {
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  front!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  back!: string;
}
