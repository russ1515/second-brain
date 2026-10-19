import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  Matches,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import type {
  CreateWorkspaceRequest,
  PersistentWorkspaceAssistRequest,
  WorkspaceProfessorTransitionRequest,
  UpdateWorkspaceRequest,
  WorkspaceAutosaveRequest,
  WorkspacePlanItem,
  WorkspaceProgress,
  WorkspaceSourceReference,
  WorkspaceSourceQueryRequest,
  WorkspaceToolApplyRequest,
  WorkspaceToolExecuteRequest,
  WorkspaceToolRejectRequest,
  WorkspaceArchiveRequest,
  WorkspaceExportRequest,
  WorkspaceFinalizeRequest,
  WorkspaceRestoreRequest,
  WorkspaceAutopilotRequest,
} from '@second-brain/shared';
import {
  WORKSPACE_EXPORT_FORMATS,
  WORKSPACE_ASSIST_ACTIONS,
  WORKSPACE_PROFESSOR_PHASES,
  WORKSPACE_TEMPLATES,
  WORKSPACE_AUTOPILOT_ACTIONS,
} from '@second-brain/shared';

export class CreateWorkspaceDto implements CreateWorkspaceRequest {
  @IsOptional() @IsString() @MinLength(8) @MaxLength(128) @Matches(/^[A-Za-z0-9_-]+$/)
  requestId?: string;

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

  @IsOptional() @IsObject()
  brief?: CreateWorkspaceRequest['brief'];

  @IsOptional() @IsString() @MaxLength(200_000)
  initialContent?: string;

  @IsOptional() @IsBoolean()
  autopilotConsent?: boolean;
}

export class WorkspaceAutopilotDto implements WorkspaceAutopilotRequest {
  @IsString() @MinLength(8) @MaxLength(128) @Matches(/^[A-Za-z0-9_-]+$/)
  requestId!: string;

  @IsInt() @Min(0)
  expectedRevision!: number;

  @IsIn(WORKSPACE_AUTOPILOT_ACTIONS)
  action!: WorkspaceAutopilotRequest['action'];

  @IsOptional() @IsBoolean()
  consent?: boolean;
}

export class UpdateWorkspaceDto implements UpdateWorkspaceRequest {
  @IsOptional() @IsInt() @Min(0)
  expectedRevision?: number;

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
  brief?: UpdateWorkspaceRequest['brief'];

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
  @IsOptional() @IsString() @MinLength(8) @MaxLength(128) @Matches(/^[A-Za-z0-9_-]+$/)
  requestId?: string;

  @IsOptional() @IsIn(WORKSPACE_PROFESSOR_PHASES)
  expectedPhase?: PersistentWorkspaceAssistRequest['expectedPhase'];

  @IsOptional() @IsInt() @Min(0)
  expectedRevision?: number;

  @IsIn(WORKSPACE_ASSIST_ACTIONS)
  action!: PersistentWorkspaceAssistRequest['action'];

  @IsOptional() @IsString() @MaxLength(2_000)
  message?: string;

  @IsOptional() @IsString() @MaxLength(8_000)
  selectedText?: string;
}

export class WorkspaceProfessorTransitionDto implements WorkspaceProfessorTransitionRequest {
  @IsString() @MinLength(8) @MaxLength(128) @Matches(/^[A-Za-z0-9_-]+$/)
  requestId!: string;

  @IsIn(WORKSPACE_PROFESSOR_PHASES)
  expectedPhase!: WorkspaceProfessorTransitionRequest['expectedPhase'];

  @IsIn(WORKSPACE_PROFESSOR_PHASES)
  requestedPhase!: WorkspaceProfessorTransitionRequest['requestedPhase'];

  @IsInt() @Min(0)
  expectedRevision!: number;
}

export class WorkspaceSourceQueryDto implements WorkspaceSourceQueryRequest {
  @IsString() @MinLength(2) @MaxLength(2_000)
  query!: string;

  @IsOptional() @IsInt() @Min(1) @Max(20)
  limit?: number;
}

export class WorkspaceToolExecuteDto implements WorkspaceToolExecuteRequest {
  @IsString() @MinLength(8) @MaxLength(128) @Matches(/^[A-Za-z0-9_-]+$/)
  requestId!: string;

  @IsInt() @Min(0)
  expectedRevision!: number;

  @IsOptional() @IsString() @MaxLength(8_000)
  selectedText?: string;

  @IsOptional() @IsString() @MaxLength(2_000)
  message?: string;
}

export class WorkspaceToolApplyDto implements WorkspaceToolApplyRequest {
  @IsString() @MinLength(8) @MaxLength(128) @Matches(/^[A-Za-z0-9_-]+$/)
  requestId!: string;

  @IsInt() @Min(0)
  expectedRevision!: number;

  @IsObject()
  draft!: WorkspaceToolApplyRequest['draft'];
}

export class WorkspaceToolRejectDto implements WorkspaceToolRejectRequest {
  @IsString() @MinLength(8) @MaxLength(128) @Matches(/^[A-Za-z0-9_-]+$/)
  requestId!: string;
}

export class WorkspaceFinalizeDto implements WorkspaceFinalizeRequest {
  @IsString() @MinLength(8) @MaxLength(128) @Matches(/^[A-Za-z0-9_-]+$/)
  requestId!: string;

  @IsInt() @Min(0)
  expectedRevision!: number;

  @IsOptional() @IsObject()
  draft?: WorkspaceFinalizeRequest['draft'];
}

export class WorkspaceExportDto implements WorkspaceExportRequest {
  @IsString() @MinLength(8) @MaxLength(128) @Matches(/^[A-Za-z0-9_-]+$/)
  requestId!: string;

  @IsString() @MinLength(1) @MaxLength(128)
  snapshotId!: string;

  @IsIn(WORKSPACE_EXPORT_FORMATS)
  format!: WorkspaceExportRequest['format'];

  @IsOptional() @IsString() @MaxLength(64)
  locale?: string;
}

export class WorkspaceArchiveDto implements WorkspaceArchiveRequest {
  @IsString() @MinLength(8) @MaxLength(128) @Matches(/^[A-Za-z0-9_-]+$/)
  requestId!: string;

  @IsInt() @Min(0)
  expectedRevision!: number;
}

export class WorkspaceRestoreDto implements WorkspaceRestoreRequest {
  @IsString() @MinLength(8) @MaxLength(128) @Matches(/^[A-Za-z0-9_-]+$/)
  requestId!: string;

  @IsInt() @Min(0)
  expectedRevision!: number;
}
