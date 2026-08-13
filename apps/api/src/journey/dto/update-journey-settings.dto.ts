import { IsString, MaxLength } from 'class-validator';
import type { UpdateJourneySettingsRequest } from '@second-brain/shared';

export class UpdateJourneySettingsDto implements UpdateJourneySettingsRequest {
  @IsString()
  @MaxLength(64)
  timezone!: string;
}
