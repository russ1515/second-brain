import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import type { RecordUsageRequest } from '@second-brain/shared';

export class RecordUsageDto implements RecordUsageRequest {
  @IsString()
  @MaxLength(40)
  metric!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100_000)
  amount?: number;
}
