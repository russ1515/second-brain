import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import {
  SUPPORTED_LANGUAGE_CODES,
  toSupportedLanguage,
  type RegisterRequest,
  type SupportedLanguageCode,
} from '@second-brain/shared';

export class RegisterDto implements RegisterRequest {
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  displayName?: string;

  @IsOptional()
  @Transform(({ value }) => typeof value === 'string' ? (toSupportedLanguage(value) ?? value) : value)
  @IsIn(SUPPORTED_LANGUAGE_CODES)
  preferredLanguage?: SupportedLanguageCode;
}
