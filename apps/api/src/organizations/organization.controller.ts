import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import type {
  OrgGroupView,
  OrgInsights,
  OrgMemberView,
  OrganizationDetail,
  OrganizationSummary,
} from '@second-brain/shared';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { OrganizationService } from './organization.service';
import {
  AddGroupMemberDto,
  AddMemberDto,
  CreateGroupDto,
  CreateOrganizationDto,
} from './dto/organization.dto';

/** Organizations & multi-tenancy (Sprint 8.4). Every route is scoped to the
 *  caller's memberships — a non-member gets 404, so tenants are isolated. */
@UseGuards(JwtAccessGuard)
@Controller('organizations')
export class OrganizationController {
  constructor(private readonly orgs: OrganizationService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateOrganizationDto,
  ): Promise<OrganizationSummary> {
    return this.orgs.create(user.userId, dto);
  }

  @Get()
  listMine(@CurrentUser() user: AuthenticatedUser): Promise<OrganizationSummary[]> {
    return this.orgs.listMine(user.userId);
  }

  @Get(':id')
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<OrganizationDetail> {
    return this.orgs.get(user.userId, id);
  }

  @Get(':id/members')
  members(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<OrgMemberView[]> {
    return this.orgs.listMembers(user.userId, id);
  }

  @Post(':id/members')
  @HttpCode(HttpStatus.CREATED)
  addMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AddMemberDto,
  ): Promise<OrgMemberView> {
    return this.orgs.addMember(user.userId, id, dto);
  }

  @Delete(':id/members/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('userId') targetUserId: string,
  ): Promise<void> {
    await this.orgs.removeMember(user.userId, id, targetUserId);
  }

  @Get(':id/insights')
  insights(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<OrgInsights> {
    return this.orgs.insights(user.userId, id);
  }

  @Get(':id/groups')
  groups(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<OrgGroupView[]> {
    return this.orgs.listGroups(user.userId, id);
  }

  @Post(':id/groups')
  @HttpCode(HttpStatus.CREATED)
  createGroup(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CreateGroupDto,
  ): Promise<OrgGroupView> {
    return this.orgs.createGroup(user.userId, id, dto);
  }

  @Post(':id/groups/:groupId/members')
  @HttpCode(HttpStatus.NO_CONTENT)
  async addGroupMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('groupId') groupId: string,
    @Body() dto: AddGroupMemberDto,
  ): Promise<void> {
    await this.orgs.addGroupMember(user.userId, id, groupId, dto);
  }
}
