import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import type { CreateTextDocumentRequest } from '@second-brain/shared';

export class CreateTextDocumentDto implements CreateTextDocumentRequest {
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  title!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1_000_000)
  content!: string;
}
