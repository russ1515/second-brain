import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsString,
  MaxLength,
} from 'class-validator';
import type {
  RlleScopedMasteryKind,
  SubmitRlleScopedMasteryRequest,
} from '@second-brain/shared';

export class SubmitRlleScopedMasteryDto implements SubmitRlleScopedMasteryRequest {
  @IsString()
  @MaxLength(200)
  experienceSessionId!: string;

  @IsString()
  @MaxLength(200)
  lessonId!: string;

  @IsIn(['milestone', 'pillar_exam'])
  scopeKind!: RlleScopedMasteryKind;

  @IsString()
  @MaxLength(240)
  attemptId!: string;

  @IsString()
  @MaxLength(200)
  assessmentId!: string;

  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(8_000, { each: true })
  answers!: string[];
}
