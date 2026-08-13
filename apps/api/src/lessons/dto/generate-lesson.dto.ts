import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import type { GenerateLessonRequest } from '@second-brain/shared';

export class GenerateLessonDto implements GenerateLessonRequest {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  topic?: string;

  @IsOptional()
  @IsString()
  conceptId?: string;

  @IsOptional()
  @IsString()
  tutorSessionId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  language?: string;

  @IsOptional()
  @IsIn(['beginner', 'intermediate', 'advanced'])
  level?: 'beginner' | 'intermediate' | 'advanced';

  @IsOptional()
  @IsBoolean()
  flashcards?: boolean;
}
