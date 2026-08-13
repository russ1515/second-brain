import { IsOptional, IsString, MaxLength } from 'class-validator';
import type {
  ConjugationRequest,
  LanguageSkillRequest,
} from '@second-brain/shared';

export class LanguageSkillDto implements LanguageSkillRequest {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  topic?: string;
}

export class ConjugationDto implements ConjugationRequest {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  verb?: string;
}
