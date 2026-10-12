import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/** Multipart fields for the dedicated native-acoustic mastery route. */
export class AssessRlleAcousticMasteryDto {
  @IsString()
  @MaxLength(200)
  experienceSessionId!: string;

  @IsString()
  @MaxLength(200)
  lessonId!: string;

  @IsString()
  @MaxLength(400)
  targetId!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(200)
  idempotencyKey!: string;

  @IsString()
  @MaxLength(12)
  exerciseIndex!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  remediationPlanId?: string;
}
