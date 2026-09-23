import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import type {
  ActionDestination,
  ContextItemInput,
  ExperienceProduction,
  ExperienceProgress,
  ExperienceSourceReference,
  ExperienceStep,
  NextBestAction,
  TwinImpact,
  UpdateExperienceSessionRequest,
} from '@second-brain/shared';
import { INPUT_MODALITIES, PERFORMANCE_BUDGETS } from '@second-brain/shared';

export class UpdateExperienceSessionDto implements UpdateExperienceSessionRequest {
  @IsOptional()
  @IsIn(['abandoned', 'failed'])
  status?: 'abandoned' | 'failed';

  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  intent?: string;

  @IsOptional()
  @IsIn(INPUT_MODALITIES)
  inputModality?: UpdateExperienceSessionRequest['inputModality'];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(PERFORMANCE_BUDGETS.maxContextItems)
  activeContexts?: ContextItemInput[];

  @IsOptional()
  @IsObject()
  currentStep?: ExperienceStep | null;

  @IsOptional()
  @IsObject()
  progress?: ExperienceProgress | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(PERFORMANCE_BUDGETS.maxSessionProductions)
  productions?: ExperienceProduction[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(PERFORMANCE_BUDGETS.maxSessionSourceReferences)
  sourceReferences?: ExperienceSourceReference[];

  @IsOptional()
  @IsObject()
  twinImpact?: TwinImpact | null;

  @IsOptional()
  @IsObject()
  resumeTarget?: ActionDestination | null;

  @IsOptional()
  @IsObject()
  nextBestAction?: NextBestAction | null;
}
