import {
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import {
  READING_LEVELS,
  type GenerateReadingRequest,
  type ReadingLevel,
  type SubmitReadingRequest,
} from '@second-brain/shared';

export class GenerateReadingDto implements GenerateReadingRequest {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  topic?: string;

  @IsOptional()
  @IsIn(READING_LEVELS as readonly string[])
  level?: ReadingLevel;
}

export class SubmitReadingDto implements SubmitReadingRequest {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  answers!: string[];
}
