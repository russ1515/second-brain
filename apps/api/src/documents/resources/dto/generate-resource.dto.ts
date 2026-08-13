import { IsIn } from 'class-validator';
import type {
  GenerateResourceRequest,
  StudyResourceType,
} from '@second-brain/shared';

const TYPES: StudyResourceType[] = [
  'summary',
  'revision_sheet',
  'flashcards',
  'quiz',
  'exercises',
  'open_questions',
  'course_plan',
];

export class GenerateResourceDto implements GenerateResourceRequest {
  @IsIn(TYPES)
  type!: StudyResourceType;
}
