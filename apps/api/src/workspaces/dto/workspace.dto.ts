import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import type {
  CreateWorkspaceRequest,
  PersistentWorkspaceAssistRequest,
  UpdateWorkspaceRequest,
  WorkspaceAutosaveRequest,
  WorkspacePlanItem,
  WorkspaceProgress,
  WorkspaceSourceReference,
} from '@second-brain/shared';
import {
  WORKSPACE_ASSIST_ACTIONS,
  WORKSPACE_TEMPLATES,
} from '@second-brain/shared';

export class CreateWorkspaceDto implements CreateWorkspaceRequest {
  @IsString() @MinLength(1) @MaxLength(200)
  title!: string;

  @IsIn(WORKSPACE_TEMPLATES)
  template!: CreateWorkspaceRequest['template'];

  @IsString() @MaxLength(2_000)
  objective!: string;

  @IsOptional() @IsDateString()
  dueAt?: string;

  @IsOptional() @IsArray() @ArrayMaxSize(50)
  sources?: WorkspaceSourceReference[];

  @IsOptional() @IsArray() @ArrayMaxSize(100)
  plan?: WorkspacePlanItem[];

  @IsOptional() @IsString() @MaxLength(200_000)
  initialContent?: string;
}

export class UpdateWorkspaceDto implements UpdateWorkspaceRequest {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(200)
  title?: string;

  @IsOptional() @IsString() @MaxLength(2_000)
  objective?: string;

  @IsOptional() @IsDateString()
  dueAt?: string | null;

  @IsOptional() @IsIn(['active', 'paused', 'completed', 'archived'])
  status?: UpdateWorkspaceRequest['status'];

  @IsOptional() @IsIn(['guide', 'accompany', 'solve'])
  mode?: UpdateWorkspaceRequest['mode'];

  @IsOptional() @IsArray() @ArrayMaxSize(50)
  sources?: WorkspaceSourceReference[];

  @IsOptional() @IsArray() @ArrayMaxSize(100)
  plan?: WorkspacePlanItem[];

  @IsOptional() @IsObject()
  progress?: WorkspaceProgress;
}

export class WorkspaceAutosaveDto implements WorkspaceAutosaveRequest {
  @IsString()
  workspaceId!: string;

  @IsInt() @Min(0)
  expectedRevision!: number;

  @IsObject()
  draft!: WorkspaceAutosaveRequest['draft'];
}

export class WorkspaceAssistDto implements PersistentWorkspaceAssistRequest {
  @IsIn(WORKSPACE_ASSIST_ACTIONS)
  action!: PersistentWorkspaceAssistRequest['action'];

  @IsOptional() @IsString() @MaxLength(2_000)
  message?: string;

  @IsOptional() @IsString() @MaxLength(8_000)
  selectedText?: string;
}
