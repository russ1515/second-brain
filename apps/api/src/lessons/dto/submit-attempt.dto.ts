import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import type { SubmitAttemptRequest } from '@second-brain/shared';

export class SubmitAttemptDto implements SubmitAttemptRequest {
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  answer!: string;
}
