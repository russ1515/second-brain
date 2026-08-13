import { IsInt, IsOptional, Max, Min } from 'class-validator';
import type { ExtractConceptsRequest } from '@second-brain/shared';

export class ExtractConceptsDto implements ExtractConceptsRequest {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  maxConcepts?: number;
}
