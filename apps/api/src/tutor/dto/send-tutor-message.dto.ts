import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import type { SendTutorMessageRequest, TutorPace } from '@second-brain/shared';

export class SendTutorMessageDto implements SendTutorMessageRequest {
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  content!: string;

  @IsOptional()
  @IsIn(['slower', 'faster'])
  pace?: TutorPace;
}
