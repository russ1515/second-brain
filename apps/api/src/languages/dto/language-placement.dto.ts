import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsString, MaxLength } from 'class-validator';
import { LANGUAGE_PLACEMENT_SELF_ESTIMATES, type LanguagePlacementSelfEstimate,
  type StartLanguagePlacementRequest, type SubmitLanguagePlacementRequest } from '@second-brain/shared';

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
