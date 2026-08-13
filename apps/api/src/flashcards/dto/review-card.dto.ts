import { IsIn, IsInt } from 'class-validator';
import type { ReviewCardRequest, ReviewRating } from '@second-brain/shared';

export class ReviewCardDto implements ReviewCardRequest {
  /** 1=Again, 2=Hard, 3=Good, 4=Easy. */
  @IsInt()
  @IsIn([1, 2, 3, 4])
  rating!: ReviewRating;
}
