import { IsNotEmpty, IsString } from 'class-validator';
import type { LinkDocumentRequest } from '@second-brain/shared';

export class LinkDocumentDto implements LinkDocumentRequest {
  @IsString()
  @IsNotEmpty()
  documentId!: string;
}
