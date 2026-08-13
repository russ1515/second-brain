import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import type {
  WorkspaceAssistRequest,
  WorkspaceMessage,
  WorkspaceMode,
} from '@second-brain/shared';

const MODES: WorkspaceMode[] = ['guide', 'accompany', 'solve'];

class WorkspaceMessageDto implements WorkspaceMessage {
  @IsIn(['user', 'assistant'])
  role!: 'user' | 'assistant';

  @IsString()
  @MaxLength(8000)
  content!: string;
}

export class AssistDto implements WorkspaceAssistRequest {
  @IsIn(MODES)
  mode!: WorkspaceMode;

  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => WorkspaceMessageDto)
  messages!: WorkspaceMessageDto[];
}
