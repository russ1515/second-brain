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
  ContextItemInput,
  CreateExperienceSessionRequest,
  ExperienceProduction,
  ExperienceProgress,
  ExperienceSessionLinks,
  ExperienceSourceReference,
  ExperienceStep,
  NextBestAction,
  ActionDestination,
} from '@second-brain/shared';
import {
  EXPERIENCE_SESSION_TYPES,
  INPUT_MODALITIES,
  PERFORMANCE_BUDGETS,
} from '@second-brain/shared';

export class CreateExperienceSessionDto implements CreateExperienceSessionRequest {
  @IsIn(EXPERIENCE_SESSION_TYPES)
  type!: CreateExperienceSessionRequest['type'];

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
  inputModality?: CreateExperienceSessionRequest['inputModality'];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(PERFORMANCE_BUDGETS.maxContextItems)
  activeContexts?: ContextItemInput[];

  @IsOptional()
  @IsObject()
  currentStep?: ExperienceStep;

  @IsOptional()
  @IsObject()
  progress?: ExperienceProgress;

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
  resumeTarget?: ActionDestination;

  @IsOptional()
  @IsObject()
  nextBestAction?: NextBestAction;

  @IsOptional()
  @IsObject()
  links?: Partial<ExperienceSessionLinks>;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  idempotencyKey?: string;
}
