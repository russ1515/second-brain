import { IsString, MaxLength, MinLength } from 'class-validator';

export class AskBrainDto {
  @IsString()
  @MinLength(2)
  @MaxLength(300)
  question!: string;
}
