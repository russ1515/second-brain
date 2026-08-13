import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import type { CorrectEssayRequest } from '@second-brain/shared';

export class CorrectEssayDto implements CorrectEssayRequest {
  @IsString()
  @IsNotEmpty()
  @MaxLength(6000)
  text!: string;
}
