import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import type { VerifyEmailRequest } from '@second-brain/shared';

export class VerifyEmailDto implements VerifyEmailRequest {
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  token!: string;
}
