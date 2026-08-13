import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import type { TwoFactorCodeRequest } from '@second-brain/shared';

/** A single TOTP or recovery code, used to enable or disable 2FA. */
export class TwoFactorCodeDto implements TwoFactorCodeRequest {
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  code!: string;
}
