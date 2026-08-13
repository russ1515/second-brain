import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import {
  CEFR_LEVELS,
  LANGUAGE_MODES,
  type CefrLevel,
  type LanguageMode,
  type UpdateLanguageProfileRequest,
} from '@second-brain/shared';

export class UpdateLanguageProfileDto implements UpdateLanguageProfileRequest {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  nativeLanguage?: string;

  @IsOptional()
  @IsIn(LANGUAGE_MODES as readonly string[])
  mode?: LanguageMode;

  @IsOptional()
  @IsIn(CEFR_LEVELS as readonly string[])
  cefrLevel?: CefrLevel;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  goal?: string;
}
