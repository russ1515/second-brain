import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import type {
  GradeReviewSessionItemRequest,
  ReviewRating,
  StartReviewSessionRequest,
} from '@second-brain/shared';
import { REVIEW_SESSION_SIZES } from '@second-brain/shared';

export class ReviewContextDto {
  @IsOptional() @IsString() @MaxLength(200) conceptId?: string;
  @IsOptional() @IsString() @MaxLength(200) documentId?: string;
  @IsOptional() @IsString() @MaxLength(200) goalId?: string;
  @IsOptional() @IsString() @MaxLength(200) examId?: string;
  @IsOptional() @IsString() @MaxLength(200) sourceSessionId?: string;
  @IsOptional() @IsString() @MaxLength(200) languageProfileId?: string;
}

export class StartReviewSessionDto extends ReviewContextDto implements StartReviewSessionRequest {
  @IsOptional() @IsIn(REVIEW_SESSION_SIZES)
  size?: StartReviewSessionRequest['size'];

  @IsOptional() @IsString() @MaxLength(200)
  idempotencyKey?: string;
}

export class GradeReviewSessionItemDto implements GradeReviewSessionItemRequest {
  @IsString() @MaxLength(240)
  itemReference!: string;

  @IsIn([1, 2, 3, 4])
  rating!: ReviewRating;
}
