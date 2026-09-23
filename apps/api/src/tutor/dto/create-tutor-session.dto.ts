import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import type { ContextItemInput, CreateTutorSessionRequest } from '@second-brain/shared';
import { INPUT_MODALITIES } from '@second-brain/shared';

export class CreateTutorSessionDto implements CreateTutorSessionRequest {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  focusConceptId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  objective?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  intent?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  mode?: string;

  @IsOptional()
  @IsIn(INPUT_MODALITIES)
  inputModality?: CreateTutorSessionRequest['inputModality'];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(32)
  @IsObject({ each: true })
  activeContexts?: ContextItemInput[];

  @IsOptional()
  @IsString()
  @MaxLength(200)
  documentId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  goalId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  languageProfileId?: string;
}
