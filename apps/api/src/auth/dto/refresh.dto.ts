import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import type { RefreshRequest } from '@second-brain/shared';

export class RefreshDto implements RefreshRequest {
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  refreshToken!: string;
}
