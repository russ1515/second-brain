import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsInt, IsString, Max, MaxLength, Min } from 'class-validator';
import { LANGUAGE_PLACEMENT_SELF_ESTIMATES, type LanguagePlacementSelfEstimate,
  type SaveLanguagePlacementProgressRequest, type StartLanguagePlacementRequest, type SubmitLanguagePlacementRequest } from '@second-brain/shared';

export class SaveLanguagePlacementProgressDto implements SaveLanguagePlacementProgressRequest {
  @IsString()
  @MaxLength(200)
  assessmentId!: string;

  @IsArray()
  @ArrayMinSize(4)
  @ArrayMaxSize(4)
  @IsString({ each: true })
  @MaxLength(4_000, { each: true })
  answers!: string[];

  @IsInt()
  @Min(0)
  @Max(3)
  currentQuestionIndex!: number;

  @IsInt()
  @Min(0)
  @Max(2_147_483_647)
  expectedVersion!: number;
}

export class StartLanguagePlacementDto implements StartLanguagePlacementRequest {
  @IsIn(LANGUAGE_PLACEMENT_SELF_ESTIMATES)
  selfEstimate!: LanguagePlacementSelfEstimate;

  @IsString()
  @MaxLength(200)
  idempotencyKey!: string;
}

export class SubmitLanguagePlacementDto implements SubmitLanguagePlacementRequest {
  @IsString()
  @MaxLength(200)
  assessmentId!: string;

  @IsArray()
  @ArrayMinSize(4)
  @ArrayMaxSize(4)
  @IsString({ each: true })
  @MaxLength(4_000, { each: true })
  answers!: string[];

  @IsString()
  @MaxLength(200)
  idempotencyKey!: string;
}
