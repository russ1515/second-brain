import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class RlleMissionTurnDto {
  @IsString()
  @MaxLength(200)
  experienceSessionId!: string;

  @IsString()
  @MaxLength(4_000)
  message!: string;

  @IsOptional()
  @IsBoolean()
  viaVoice?: boolean;
}
