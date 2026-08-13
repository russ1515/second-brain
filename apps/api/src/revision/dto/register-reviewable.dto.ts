import { IsIn, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import type {
  RegisterReviewableRequest,
  ReviewableKind,
} from '@second-brain/shared';

const KINDS: ReviewableKind[] = [
  'lesson',
  'exercise',
  'quiz',
  'language',
  'practical',
  'homework',
  'report',
  'flashcard',
  'concept',
];

export class RegisterReviewableDto implements RegisterReviewableRequest {
  @IsIn(KINDS)
  kind!: ReviewableKind;

  @IsString()
  @IsNotEmpty()
  refId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;
}
