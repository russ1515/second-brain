import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { PERFORMANCE_BUDGETS } from '@second-brain/shared';

export class ListExperienceSessionsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(PERFORMANCE_BUDGETS.maxListPageSize)
  limit = PERFORMANCE_BUDGETS.defaultListPageSize;

  @IsOptional()
  @IsString()
  cursor?: string;
}
