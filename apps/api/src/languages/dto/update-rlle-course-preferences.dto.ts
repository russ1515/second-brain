import { IsIn, IsOptional } from 'class-validator';
import {
  IMMERSION_INTENSITIES,
  LANGUAGE_CORRECTION_INTENSITIES,
  type UpdateRlleCoursePreferencesRequest,
} from '@second-brain/shared';

export class UpdateRlleCoursePreferencesDto
  implements UpdateRlleCoursePreferencesRequest
{
  @IsOptional()
  @IsIn(IMMERSION_INTENSITIES as readonly string[])
  immersionIntensity?: UpdateRlleCoursePreferencesRequest['immersionIntensity'];

  @IsOptional()
  @IsIn(LANGUAGE_CORRECTION_INTENSITIES as readonly string[])
  correctionIntensity?: UpdateRlleCoursePreferencesRequest['correctionIntensity'];
}
