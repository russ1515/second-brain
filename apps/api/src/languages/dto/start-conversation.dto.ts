import { IsOptional, IsString, MaxLength } from 'class-validator';
import type { StartConversationRequest } from '@second-brain/shared';

export class StartConversationDto implements StartConversationRequest {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  scenario?: string;
}
