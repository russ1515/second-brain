import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  RESEARCH_DEPTHS,
  type ResearchRunRequest,
  type ResearchScope,
} from '@second-brain/shared';

export class RunResearchDto implements ResearchRunRequest {
  @IsOptional()
  @IsString()
  @MaxLength(128)
  @Matches(/^[A-Za-z0-9_-]+$/)
  experienceSessionId?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(1_000)
  question!: string;

  @IsIn(RESEARCH_DEPTHS)
  depth!: ResearchRunRequest['depth'];

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(4)
  scopes!: ResearchScope[];
}
