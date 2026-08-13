import { IsOptional, IsString, MaxLength } from 'class-validator';
import type { GenerateDialogueRequest } from '@second-brain/shared';

export class GenerateDialogueDto implements GenerateDialogueRequest {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  scenario?: string;
}
