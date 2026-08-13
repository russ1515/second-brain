import { IsEmail, IsIn, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import {
  ORG_ROLES,
  ORGANIZATION_TYPES,
  type AddGroupMemberRequest,
  type AddMemberRequest,
  type CreateGroupRequest,
  type CreateOrganizationRequest,
  type OrgGroupKind,
  type OrgRole,
  type OrganizationType,
} from '@second-brain/shared';

export class CreateOrganizationDto implements CreateOrganizationRequest {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsIn(ORGANIZATION_TYPES as readonly string[])
  type!: OrganizationType;
}

export class AddMemberDto implements AddMemberRequest {
  @IsEmail()
  @MaxLength(200)
  email!: string;

  @IsIn(ORG_ROLES as readonly string[])
  role!: OrgRole;
}

export class CreateGroupDto implements CreateGroupRequest {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsIn(['class', 'group'])
  kind!: OrgGroupKind;
}

export class AddGroupMemberDto implements AddGroupMemberRequest {
  @IsEmail()
  @MaxLength(200)
  email!: string;

  @IsIn(ORG_ROLES as readonly string[])
  role!: OrgRole;
}
