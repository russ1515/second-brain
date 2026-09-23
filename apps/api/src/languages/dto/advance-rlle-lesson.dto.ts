import { IsIn, IsString, MaxLength } from 'class-validator';
import {
  RLLE_LESSON_STAGES,
  type RlleLessonStageKind,
} from '@second-brain/shared';

export class AdvanceRlleLessonDto {
  @IsString()
  @MaxLength(200)
  experienceSessionId!: string;

  @IsString()
  @MaxLength(200)
  lessonId!: string;

  @IsIn(RLLE_LESSON_STAGES as readonly string[])
  completedStage!: RlleLessonStageKind;
}
