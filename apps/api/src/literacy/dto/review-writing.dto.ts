import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import {
  WRITING_TYPES,
  type ReviewWritingRequest,
  type WritingType,
} from '@second-brain/shared';

export class ReviewWritingDto implements ReviewWritingRequest {
  @IsIn(WRITING_TYPES as readonly string[])
  type!: WritingType;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50_000)
  text!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1_000)
  instructions?: string;
}
