import { IsIn, IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';
import type { CreateExamRequest, ExamPriority } from '@second-brain/shared';

const PRIORITIES: ExamPriority[] = ['low', 'medium', 'high'];

export class CreateExamDto implements CreateExamRequest {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  subject!: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date must be YYYY-MM-DD' })
  date!: string;

  @IsIn(PRIORITIES)
  priority!: ExamPriority;
}
