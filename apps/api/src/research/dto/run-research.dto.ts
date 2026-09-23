import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  RESEARCH_DEPTHS,
  type ResearchRunRequest,
  type ResearchScope,
} from '@second-brain/shared';

export class RunResearchDto implements ResearchRunRequest {
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
