import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import type { StartRlleLessonRequest } from '@second-brain/shared';

export class StartRlleLessonDto implements StartRlleLessonRequest {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  unitId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  lessonId?: string;

  @IsOptional()
  @IsIn(['text', 'voice', 'mixed'])
  inputModality?: 'text' | 'voice' | 'mixed';

  @IsOptional()
  @IsString()
  @MaxLength(200)
  idempotencyKey?: string;
}
