import {
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  RLLE_GAP_KINDS,
  type RecordRlleEvidenceRequest,
  type RlleGapKind,
} from '@second-brain/shared';

class RlleGapDto {
  @IsIn(RLLE_GAP_KINDS as readonly string[])
  kind!: RlleGapKind;

  @IsString()
  @MaxLength(300)
  label!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  learnerExample?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1_000)
  correction?: string;
}

export class RecordRlleEvidenceDto implements RecordRlleEvidenceRequest {
  @IsString()
  @MaxLength(120)
  canDoId!: string;

  @IsIn(['mission', 'assessment', 'controlled-activity'])
  source!: RecordRlleEvidenceRequest['source'];

  @IsString()
  @MaxLength(200)
  sourceId!: string;

  @IsIn(['demonstrated', 'not-demonstrated'])
  result!: RecordRlleEvidenceRequest['result'];

  @IsString()
  @IsNotEmpty()
  @MaxLength(1_000)
  observation!: string;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => RlleGapDto)
  gap?: RlleGapDto;
}
