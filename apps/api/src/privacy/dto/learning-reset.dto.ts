import { Equals, IsString, MaxLength, MinLength } from 'class-validator';
import type { ResetLearningRequest } from '@second-brain/shared';

export class ResetLearningDto implements ResetLearningRequest {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  password!: string;

  @IsString()
  @Equals('RÉINITIALISER')
  confirmation!: 'RÉINITIALISER';
}
