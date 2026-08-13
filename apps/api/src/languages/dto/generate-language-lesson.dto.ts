import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import type { GenerateLanguageLessonRequest } from '@second-brain/shared';

export class GenerateLanguageLessonDto implements GenerateLanguageLessonRequest {
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  topic!: string;
}
