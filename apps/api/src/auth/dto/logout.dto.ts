import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import type { LogoutRequest } from '@second-brain/shared';

export class LogoutDto implements LogoutRequest {
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  refreshToken!: string;
}
