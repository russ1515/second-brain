import { IsString, Matches } from 'class-validator';

export class VerifyOtpDto {
  /** The 6-digit email OTP code. */
  @IsString()
  @Matches(/^\d{6}$/, { message: 'code must be 6 digits' })
  code!: string;
}
