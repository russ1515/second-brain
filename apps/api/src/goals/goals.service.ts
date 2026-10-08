import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type {
  CreateGoalRequest,
  Goal,
  GoalLearningLink,
  GoalPeriod,
  LearningDeletionPreview,
  SetPrimaryGoalRequest,
  UpdateGoalRequest,
} from '@second-brain/shared';
import { PrismaService } from '../prisma/prisma.service';
import { LearningDataDeletionService } from '../experience-sessions/learning-data-deletion.service';

const PERIODS: GoalPeriod[] = ['daily', 'weekly', 'monthly'];

type GoalWithLearning = Prisma.GoalGetPayload<{
  include: {
    learningLinks: {
      include: {
        experienceSession: { select: { id: true; title: true; type: true; status: true } };
      };
    };
  };
}>;

/** Goals (Sprint 5): the learner's daily / weekly / monthly objectives. */
@Injectable()
export class GoalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly learningDeletions: LearningDataDeletionService,
  ) {}

  async list(userId: string): Promise<Goal[]> {
    const goals = await this.prisma.goal.findMany({
      // Legacy standalone goals are preserved, but are not presented as
      // learning goals until the learner explicitly attaches them.
      where: { userId, learningLinks: { some: { userId } } },
      include: {
        learningLinks: {
          include: {
            experienceSession: { select: { id: true, title: true, type: true, status: true } },
          },
          orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return goals
      .sort((a, b) => Number(b.learningLinks.some((link) => link.isPrimary)) - Number(a.learningLinks.some((link) => link.isPrimary)))
      .map((g) => this.toView(g));
  }

  async create(userId: string, dto: CreateGoalRequest): Promise<Goal> {
    if (!PERIODS.includes(dto.period)) {
      throw new BadRequestException('Unsupported goal period.');
    }
    const goal = await this.prisma.$transaction(async (tx) => {
      const session = await tx.experienceSession.findFirst({
        where: {
          id: dto.experienceSessionId,
          userId,
          type: { in: ['learning', 'language'] },
          status: { notIn: ['abandoned', 'failed'] },
        },
        select: { id: true },
      });
      if (!session) throw new BadRequestException('A started learning journey is required.');

      const hasPrimary = await tx.learningGoalLink.findFirst({
        where: { userId, experienceSessionId: session.id, isPrimary: true },
        select: { id: true },
      });
      const created = await tx.goal.create({
        data: { userId, period: dto.period, title: dto.title.trim().slice(0, 200) },
      });
      const isPrimary = !hasPrimary;
      await tx.learningGoalLink.create({
        data: {
          userId,
          experienceSessionId: session.id,
          goalId: created.id,
          isPrimary,
        },
      });
      if (isPrimary) {
        await tx.experienceSession.update({
          where: { id: session.id },
          data: { goalId: created.id, version: { increment: 1 } },
        });
      }
      return tx.goal.findUniqueOrThrow({
        where: { id: created.id },
        include: {
          learningLinks: {
            include: {
              experienceSession: { select: { id: true, title: true, type: true, status: true } },
            },
          },
        },
      });
    });
    return this.toView(goal);
  }

  async update(userId: string, id: string, dto: UpdateGoalRequest): Promise<Goal> {
    await this.requireOwned(userId, id);
    if (dto.period !== undefined && !PERIODS.includes(dto.period)) {
      throw new BadRequestException('Unsupported goal period.');
    }
    if (dto.title === undefined && dto.period === undefined) {
      throw new BadRequestException('No goal change supplied.');
    }
    const updated = await this.prisma.goal.update({
      where: { id },
      data: {
        ...(dto.period === undefined ? {} : { period: dto.period }),
        ...(dto.title === undefined ? {} : { title: dto.title.trim().slice(0, 200) }),
      },
      include: {
        learningLinks: {
          include: {
            experienceSession: { select: { id: true, title: true, type: true, status: true } },
          },
        },
      },
    });
    return this.toView(updated);
  }

  async setPrimary(userId: string, id: string, dto: SetPrimaryGoalRequest): Promise<Goal> {
    const updated = await this.prisma.$transaction(async (tx) => {
      const link = await tx.learningGoalLink.findFirst({
        where: { userId, goalId: id, experienceSessionId: dto.experienceSessionId },
        select: { id: true },
      });
      if (!link) throw new NotFoundException('Learning goal link not found.');
      await tx.learningGoalLink.updateMany({
        where: { userId, experienceSessionId: dto.experienceSessionId, isPrimary: true },
        data: { isPrimary: false },
      });
      await tx.learningGoalLink.update({ where: { id: link.id }, data: { isPrimary: true } });
      await tx.experienceSession.update({
        where: { id: dto.experienceSessionId },
        data: { goalId: id, version: { increment: 1 } },
      });
      return tx.goal.findUniqueOrThrow({
        where: { id },
        include: {
          learningLinks: {
            include: {
              experienceSession: { select: { id: true, title: true, type: true, status: true } },
            },
          },
        },
      });
    });
    return this.toView(updated);
  }

  /** Toggle a goal between pending and done. */
  async toggle(userId: string, id: string): Promise<Goal> {
    const goal = await this.requireOwned(userId, id);
    const done = goal.status !== 'done';
    const updated = await this.prisma.goal.update({
      where: { id },
      data: { status: done ? 'done' : 'pending', completedAt: done ? new Date() : null },
      include: {
        learningLinks: {
          include: {
            experienceSession: { select: { id: true, title: true, type: true, status: true } },
          },
        },
      },
    });
    return this.toView(updated);
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.learningDeletions.deleteGoal(userId, id);
  }

  previewRemoval(userId: string, id: string): Promise<LearningDeletionPreview> {
    return this.learningDeletions.previewGoal(userId, id);
  }

  private async requireOwned(userId: string, id: string) {
    const goal = await this.prisma.goal.findUnique({ where: { id } });
    if (!goal || goal.userId !== userId) {
      throw new NotFoundException('Goal not found.');
    }
    return goal;
  }

  private toView(g: GoalWithLearning): Goal {
    return {
      id: g.id,
      period: g.period as GoalPeriod,
      title: g.title,
      status: g.status as Goal['status'],
      createdAt: g.createdAt.toISOString(),
      completedAt: g.completedAt?.toISOString() ?? null,
      learningLinks: g.learningLinks.map((link): GoalLearningLink => ({
        experienceSessionId: link.experienceSession.id,
        learningTitle: link.experienceSession.title,
        // Links are created only for the two canonical learning journey types
        // (see the ownership/type guard in create). Keep the narrower shared
        // contract explicit after Prisma widens the selected enum.
        learningType: link.experienceSession.type as GoalLearningLink['learningType'],
        learningStatus: link.experienceSession.status,
        isPrimary: link.isPrimary,
      })),
    };
  }
}
