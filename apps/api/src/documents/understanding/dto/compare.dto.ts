import { IsString, MinLength } from 'class-validator';
import type { CompareRequest } from '@second-brain/shared';

export class CompareDto implements CompareRequest {
  @IsString()
  @MinLength(1)
  otherDocumentId!: string;
}
