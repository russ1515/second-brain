import { IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';
import type { CreateUrlDocumentRequest } from '@second-brain/shared';

export class CreateUrlDocumentDto implements CreateUrlDocumentRequest {
  @IsString()
  @IsUrl({ require_protocol: true, protocols: ['http', 'https'] })
  @MaxLength(2048)
  url!: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  title?: string;
}
