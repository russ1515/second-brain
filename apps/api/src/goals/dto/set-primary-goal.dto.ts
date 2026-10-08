import { IsNotEmpty, IsString } from 'class-validator';
import type { SetPrimaryGoalRequest } from '@second-brain/shared';

export class SetPrimaryGoalDto implements SetPrimaryGoalRequest {
  @IsString()
  @IsNotEmpty()
  experienceSessionId!: string;
}
