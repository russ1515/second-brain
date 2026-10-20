import { ArrayMaxSize, IsArray, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class LanguageCoreKeyDto {
  @IsString()
  @MaxLength(200)
  idempotencyKey!: string;
}
export class LanguageCoreAnswersDto {
  @IsOptional()
  @IsIn(['teaching', 'assessment'])
  phase?: 'teaching' | 'assessment';
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(3)
  teachingStep?: number;
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @MaxLength(4000, { each: true })
  answers!: string[];
}
export class LanguageCoreSubmitDto extends LanguageCoreAnswersDto {
  @IsString()
  @MaxLength(200)
  idempotencyKey!: string;
}
export class LanguageCoreAssessmentDto extends LanguageCoreKeyDto {
  @IsIn(['module', 'level'])
  scope!: 'module' | 'level';
  @IsString()
  @MaxLength(240)
  targetId!: string;
}
export class LanguageCoreHelpDto extends LanguageCoreKeyDto {
  @IsString()
  @MaxLength(2000)
  message!: string;
}
