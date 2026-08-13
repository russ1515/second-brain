import { IsIn, IsNumber, IsOptional, Max, Min } from 'class-validator';
import type { ReviewReviewableRequest } from '@second-brain/shared';

export class ReviewReviewableDto implements ReviewReviewableRequest {
  @IsOptional()
  @IsIn([1, 2, 3, 4])
  rating?: 1 | 2 | 3 | 4;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  score?: number;
}
