import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import type { LoginRequest } from '@second-brain/shared';

export class LoginDto implements LoginRequest {
  @IsEmail()
  @MaxLength(254)
  email!: string;

  // Only presence is validated on login — never leak the password policy here.
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password!: string;
}
