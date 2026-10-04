import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import {
  CEFR_LEVELS,
  KNOWN_LANGUAGE_LEVELS,
  LEARNING_CATEGORIES,
  SUPPORTED_LANGUAGE_CODES,
  type KycEducation,
  type KycLanguageLearner,
  type KycTeacher,
  type KnownLanguage,
  type LearnerAgeBand,
  type SupportedLanguageCode,
  type UpdateLearnerPassportRequest,
} from '@second-brain/shared';

const AGE_BANDS: LearnerAgeBand[] = [
  'under12', '12to15', '16to18', '18to25', '25to40', 'over40',
];

class PassportIdentityDto {
  @IsOptional()
  @IsIn(AGE_BANDS)
  ageBand?: LearnerAgeBand | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  countryOfOrigin?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  currentCountry?: string | null;
}

class KnownLanguageDto implements KnownLanguage {
  @IsIn(SUPPORTED_LANGUAGE_CODES as readonly string[])
  language!: SupportedLanguageCode;

  @IsOptional()
  @IsIn(KNOWN_LANGUAGE_LEVELS as readonly string[])
  level?: KnownLanguage['level'];
}

class PassportLanguagesDto {
  @IsOptional()
  @IsIn(SUPPORTED_LANGUAGE_CODES as readonly string[])
  nativeOrPrimaryLanguage?: SupportedLanguageCode | null;

  @IsOptional()
  @IsIn(SUPPORTED_LANGUAGE_CODES as readonly string[])
  explanationLanguage?: SupportedLanguageCode | null;

  @IsOptional()
  @IsIn(SUPPORTED_LANGUAGE_CODES as readonly string[])
  teachingLanguage?: SupportedLanguageCode | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => KnownLanguageDto)
  knownLanguages?: KnownLanguageDto[];
}

class PassportEducationDto implements Partial<KycEducation> {
  @IsOptional()
  @IsIn(LEARNING_CATEGORIES)
  category?: KycEducation['category'];

  @IsOptional() @IsString() @MaxLength(120) level?: string;
  @IsOptional() @IsString() @MaxLength(120) system?: string;
  @IsOptional() @IsString() @MaxLength(120) field?: string;
  @IsOptional() @IsString() @MaxLength(120) domain?: string;
  @IsOptional() @IsString() @MaxLength(120) specialty?: string;
  @IsOptional() @IsString() @MaxLength(80) year?: string;
}

class PassportLanguageGoalsDto implements Partial<KycLanguageLearner> {
  @IsOptional()
  @IsIn(SUPPORTED_LANGUAGE_CODES as readonly string[])
  targetLanguage?: string;

  @IsOptional() @IsIn(CEFR_LEVELS as readonly string[]) currentLevel?: string;
  @IsOptional() @IsIn(CEFR_LEVELS as readonly string[]) targetLevel?: string;
  @IsOptional() @IsString() @MaxLength(300) mainGoal?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  skills?: string[];
}

class PassportTeacherDto implements KycTeacher {
  @IsOptional() @IsBoolean() automaticAdaptation?: boolean;
  @IsOptional() @IsIn(['guided', 'balanced', 'demanding']) learningSupport?: KycTeacher['learningSupport'];
  @IsOptional() @IsIn(['training', 'assessed']) conversationMode?: KycTeacher['conversationMode'];
  @IsOptional() @IsIn(['standard', 'strict']) examRigor?: KycTeacher['examRigor'];
  @IsOptional() @IsBoolean() sessionSummary?: boolean;
  @IsOptional() @IsIn(['measured', 'supportive']) encouragement?: KycTeacher['encouragement'];
  @IsOptional() @IsIn(['supportive', 'balanced', 'demanding']) tone?: KycTeacher['tone'];
  @IsOptional() @IsIn(['short', 'balanced', 'detailed']) explanations?: KycTeacher['explanations'];
  @IsOptional() @IsIn(['let_me_think', 'guide_me', 'interactive']) intervention?: KycTeacher['intervention'];
  @IsOptional() @IsIn(['immediate', 'let_me_finish', 'adaptive']) correction?: KycTeacher['correction'];
}

export class UpdateLearnerPassportDto implements UpdateLearnerPassportRequest {
  @IsOptional() @IsObject() @ValidateNested() @Type(() => PassportIdentityDto)
  identity?: PassportIdentityDto;

  @IsOptional() @IsObject() @ValidateNested() @Type(() => PassportLanguagesDto)
  languages?: PassportLanguagesDto;

  @IsOptional() @IsObject() @ValidateNested() @Type(() => PassportEducationDto)
  education?: PassportEducationDto;

  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) @MaxLength(120, { each: true })
  subjects?: string[];

  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) @MaxLength(160, { each: true })
  academicGoals?: string[];

  @IsOptional() @IsObject() @ValidateNested() @Type(() => PassportLanguageGoalsDto)
  languageGoals?: PassportLanguageGoalsDto;

  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) @MaxLength(60, { each: true })
  learningPreferences?: string[];

  @IsOptional() @IsObject() @ValidateNested() @Type(() => PassportTeacherDto)
  teacher?: PassportTeacherDto;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  timezone?: string;
}
