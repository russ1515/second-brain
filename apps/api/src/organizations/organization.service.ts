import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Membership } from '@prisma/client';
import type {
  AddGroupMemberRequest,
  AddMemberRequest,
  CreateGroupRequest,
  CreateOrganizationRequest,
  OrgGroupView,
  OrgInsights,
  OrgMemberView,
  OrgRole,
  OrganizationDetail,
  OrganizationSummary,
  OrganizationType,
  SubjectDifficulty,
} from '@second-brain/shared';
import { PrismaService } from '../prisma/prisma.service';

const ROLE_RANK: Record<OrgRole, number> = { student: 1, teacher: 2, admin: 3 };

/**
 * Organizations & multi-tenancy (Sprint 8.4). Tenant isolation is enforced HERE:
 * every method that touches an org first calls `requireMember`, which resolves
 * the caller's membership and 404s if they don't belong — so one org's data is
 * unreachable from another. All queries are scoped by `organizationId`.
 */
@Injectable()
export class OrganizationService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    userId: string,
    dto: CreateOrganizationRequest,
  ): Promise<OrganizationSummary> {
    const org = await this.prisma.organization.create({
      data: {
        name: dto.name.trim(),
        type: dto.type,
        // The creator is the first admin.
        memberships: { create: { userId, role: 'admin' } },
      },
      include: { _count: { select: { memberships: true } } },
    });
    return {
      id: org.id,
      name: org.name,
      type: org.type as OrganizationType,
      role: 'admin',
      memberCount: org._count.memberships,
      createdAt: org.createdAt.toISOString(),
    };
  }

  /** Only the organizations the caller belongs to — the isolation boundary. */
  async listMine(userId: string): Promise<OrganizationSummary[]> {
    const memberships = await this.prisma.membership.findMany({
      where: { userId },
      include: {
        organization: {
          include: { _count: { select: { memberships: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return memberships.map((m) => ({
      id: m.organization.id,
      name: m.organization.name,
      type: m.organization.type as OrganizationType,
      role: m.role as OrgRole,
      memberCount: m.organization._count.memberships,
      createdAt: m.organization.createdAt.toISOString(),
    }));
  }

  async get(userId: string, orgId: string): Promise<OrganizationDetail> {
    const membership = await this.requireMember(userId, orgId);
    const [org, members, groups] = await Promise.all([
      this.prisma.organization.findUniqueOrThrow({ where: { id: orgId } }),
      this.listMembers(userId, orgId),
      this.listGroups(userId, orgId),
    ]);
    return {
      id: org.id,
      name: org.name,
      type: org.type as OrganizationType,
      role: membership.role as OrgRole,
      memberCount: members.length,
      createdAt: org.createdAt.toISOString(),
      members,
      groups,
    };
  }

  async listMembers(userId: string, orgId: string): Promise<OrgMemberView[]> {
    await this.requireMember(userId, orgId);
    const rows = await this.prisma.membership.findMany({
      where: { organizationId: orgId },
      include: { user: { select: { email: true, profile: { select: { displayName: true } } } } },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((m) => ({
      userId: m.userId,
      email: m.user.email,
      displayName: m.user.profile?.displayName ?? null,
      role: m.role as OrgRole,
      createdAt: m.createdAt.toISOString(),
    }));
  }

  async addMember(
    userId: string,
    orgId: string,
    dto: AddMemberRequest,
  ): Promise<OrgMemberView> {
    await this.requireMember(userId, orgId, 'admin');
    const target = await this.prisma.user.findUnique({
      where: { email: dto.email.trim().toLowerCase() },
      select: { id: true, email: true, profile: { select: { displayName: true } } },
    });
    if (!target) {
      throw new NotFoundException('No Second Brain user with that email.');
    }
    const membership = await this.prisma.membership.upsert({
      where: { organizationId_userId: { organizationId: orgId, userId: target.id } },
      create: { organizationId: orgId, userId: target.id, role: dto.role },
      update: { role: dto.role },
    });
    return {
      userId: target.id,
      email: target.email,
      displayName: target.profile?.displayName ?? null,
      role: membership.role as OrgRole,
      createdAt: membership.createdAt.toISOString(),
    };
  }

  async removeMember(
    userId: string,
    orgId: string,
    targetUserId: string,
  ): Promise<void> {
    await this.requireMember(userId, orgId, 'admin');
    const admins = await this.prisma.membership.count({
      where: { organizationId: orgId, role: 'admin' },
    });
    const target = await this.prisma.membership.findUnique({
      where: { organizationId_userId: { organizationId: orgId, userId: targetUserId } },
    });
    if (!target) throw new NotFoundException('That user is not a member.');
    if (target.role === 'admin' && admins <= 1) {
      throw new BadRequestException('An organization must keep at least one admin.');
    }
    await this.prisma.membership.delete({ where: { id: target.id } });
  }

  // ── groups / classes ──────────────────────────────────────────────────────

  async createGroup(
    userId: string,
    orgId: string,
    dto: CreateGroupRequest,
  ): Promise<OrgGroupView> {
    await this.requireMember(userId, orgId, 'teacher');
    const group = await this.prisma.orgGroup.create({
      data: { organizationId: orgId, name: dto.name.trim(), kind: dto.kind },
    });
    return {
      id: group.id,
      name: group.name,
      kind: group.kind as OrgGroupView['kind'],
      memberCount: 0,
      createdAt: group.createdAt.toISOString(),
    };
  }

  async listGroups(userId: string, orgId: string): Promise<OrgGroupView[]> {
    await this.requireMember(userId, orgId);
    const groups = await this.prisma.orgGroup.findMany({
      where: { organizationId: orgId },
      include: { _count: { select: { members: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return groups.map((g) => ({
      id: g.id,
      name: g.name,
      kind: g.kind as OrgGroupView['kind'],
      memberCount: g._count.members,
      createdAt: g.createdAt.toISOString(),
    }));
  }

  async addGroupMember(
    userId: string,
    orgId: string,
    groupId: string,
    dto: AddGroupMemberRequest,
  ): Promise<void> {
    await this.requireMember(userId, orgId, 'teacher');
    // Isolation: the group must belong to this org.
    const group = await this.prisma.orgGroup.findUnique({ where: { id: groupId } });
    if (!group || group.organizationId !== orgId) {
      throw new NotFoundException('Group not found.');
    }
    const target = await this.prisma.user.findUnique({
      where: { email: dto.email.trim().toLowerCase() },
      select: { id: true },
    });
    if (!target) throw new NotFoundException('No Second Brain user with that email.');
    // The target must already be a member of the organization.
    const member = await this.prisma.membership.findUnique({
      where: { organizationId_userId: { organizationId: orgId, userId: target.id } },
    });
    if (!member) {
      throw new BadRequestException('Add the user to the organization first.');
    }
    await this.prisma.groupMember.upsert({
      where: { groupId_userId: { groupId, userId: target.id } },
      create: { groupId, userId: target.id, role: dto.role },
      update: { role: dto.role },
    });
  }

  // ── Tenant Intelligence Engine (8.7 ⭐) ──────────────────────────────────

  /** Aggregated, ANONYMISED insights for the organisation: which subjects the
   *  cohort struggles with, how many students are at risk, and pedagogical
   *  recommendations. Only counts and averages leave this method — never an
   *  individual learner's data. Admin/teacher only. */
  async insights(userId: string, orgId: string): Promise<OrgInsights> {
    await this.requireMember(userId, orgId, 'teacher');

    const members = await this.prisma.membership.findMany({
      where: { organizationId: orgId },
      select: { userId: true, role: true },
    });
    const counts = { admins: 0, teachers: 0, students: 0 };
    const studentIds: string[] = [];
    for (const m of members) {
      if (m.role === 'admin') counts.admins++;
      else if (m.role === 'teacher') counts.teachers++;
      else {
        counts.students++;
        studentIds.push(m.userId);
      }
    }

    if (studentIds.length === 0) {
      return {
        members: counts,
        activeStudents7d: 0,
        difficultSubjects: [],
        strugglingStudents: 0,
        recommendations: ['Add students to start seeing cohort insights.'],
      };
    }

    const weekAgo = new Date(Date.now() - 7 * 86_400_000);
    const [activeStudents7d, bySubject, byStudent] = await Promise.all([
      this.prisma.user.count({
        where: { id: { in: studentIds }, lastActiveAt: { gte: weekAgo } },
      }),
      this.prisma.studySession.groupBy({
        by: ['subject'],
        where: { userId: { in: studentIds }, masteryAfter: { not: null } },
        _avg: { masteryAfter: true },
        _count: { _all: true },
      }),
      this.prisma.studySession.groupBy({
        by: ['userId'],
        where: { userId: { in: studentIds }, masteryAfter: { not: null } },
        _avg: { masteryAfter: true },
      }),
    ]);

    const difficultSubjects: SubjectDifficulty[] = bySubject
      .map((s) => ({
        subject: s.subject,
        avgMastery: round2(s._avg.masteryAfter ?? 0),
        sessions: s._count._all,
      }))
      .filter((s) => s.avgMastery < 0.6)
      .sort((a, b) => a.avgMastery - b.avgMastery)
      .slice(0, 5);

    const strugglingStudents = byStudent.filter(
      (s) => (s._avg.masteryAfter ?? 1) < 0.5,
    ).length;

    const recommendations: string[] = [];
    for (const s of difficultSubjects.slice(0, 3)) {
      recommendations.push(
        `Revisit “${s.subject}”: cohort average mastery is ${Math.round(s.avgMastery * 100)}%.`,
      );
    }
    if (strugglingStudents > 0) {
      recommendations.push(
        `${strugglingStudents} student(s) are below 50% mastery and may need support.`,
      );
    }
    if (recommendations.length === 0) {
      recommendations.push('The cohort is on track — no struggling subjects detected.');
    }

    return {
      members: counts,
      activeStudents7d,
      difficultSubjects,
      strugglingStudents,
      recommendations,
    };
  }

  // ── isolation core ──────────────────────────────────────────────────────

  /** Resolve the caller's membership of an org, or 404 (never reveal existence
   *  to non-members). Optionally require a minimum role. */
  async requireMember(
    userId: string,
    orgId: string,
    minRole?: OrgRole,
  ): Promise<Membership> {
    const membership = await this.prisma.membership.findUnique({
      where: { organizationId_userId: { organizationId: orgId, userId } },
    });
    if (!membership) throw new NotFoundException('Organization not found.');
    if (minRole && ROLE_RANK[membership.role as OrgRole] < ROLE_RANK[minRole]) {
      throw new ForbiddenException(
        `This action requires the ${minRole} role in this organization.`,
      );
    }
    return membership;
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
