import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

/** No reference text, scores or mastery flags are accepted from the client. */
export class CreatePhoneticAttemptDto {
  @IsString()
  @MaxLength(200)
  lessonId!: string;

  @IsString()
  @MaxLength(12)
  @Matches(/^(0|[1-9]\d{0,2})$/)
  exerciseIndex!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(200)
  idempotencyKey!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  locale?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  parentAttemptId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(12)
  @Matches(/^(0|[1-9]\d{0,2})$/)
  targetWordIndex?: string;
}
