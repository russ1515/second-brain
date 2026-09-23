import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import {
  IMMERSION_INTENSITIES,
  LANGUAGE_CORRECTION_INTENSITIES,
  type StartConversationRequest,
} from '@second-brain/shared';

export class StartConversationDto implements StartConversationRequest {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  scenario?: string;

  @IsOptional()
  @IsIn(IMMERSION_INTENSITIES)
  immersionIntensity?: StartConversationRequest['immersionIntensity'];

  @IsOptional()
  @IsIn(LANGUAGE_CORRECTION_INTENSITIES)
  correctionIntensity?: StartConversationRequest['correctionIntensity'];

  @IsOptional()
  @IsIn(['text', 'voice'])
  inputModality?: StartConversationRequest['inputModality'];

  @IsOptional()
  @IsString()
  @MaxLength(200)
  courseSessionId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  unitId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  lessonId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  courseStage?: string;
}
