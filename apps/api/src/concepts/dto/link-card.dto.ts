import { IsNotEmpty, IsString } from 'class-validator';
import type { LinkCardRequest } from '@second-brain/shared';

export class LinkCardDto implements LinkCardRequest {
  @IsString()
  @IsNotEmpty()
  cardId!: string;
}
