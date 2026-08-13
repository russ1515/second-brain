import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import type { ExtractVocabularyRequest } from '@second-brain/shared';

export class ExtractVocabularyDto implements ExtractVocabularyRequest {
  @IsOptional()
  @IsString()
  @MaxLength(50_000)
  text?: string;

  @IsOptional()
  @IsString()
  documentId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(40)
  count?: number;
}
