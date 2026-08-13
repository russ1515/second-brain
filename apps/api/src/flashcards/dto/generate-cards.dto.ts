import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import type { GenerateCardsRequest } from '@second-brain/shared';

export class GenerateCardsDto implements GenerateCardsRequest {
  @IsOptional()
  @IsString()
  deckId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  count?: number;
}
