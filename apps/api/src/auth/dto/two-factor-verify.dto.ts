import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import type { TwoFactorVerifyRequest } from '@second-brain/shared';

export class TwoFactorVerifyDto implements TwoFactorVerifyRequest {
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  challengeToken!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  code!: string;
}
