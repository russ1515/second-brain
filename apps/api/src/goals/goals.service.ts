import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Goal as GoalRow } from '@prisma/client';
import type {
  CreateGoalRequest,
  Goal,
  GoalPeriod,
} from '@second-brain/shared';
import { PrismaService } from '../prisma/prisma.service';

const PERIODS: GoalPeriod[] = ['daily', 'weekly', 'monthly'];

/** Goals (Sprint 5): the learner's daily / weekly / monthly objectives. */
@Injectable()
export class GoalsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string): Promise<Goal[]> {
    const goals = await this.prisma.goal.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return goals.map((g) => this.toView(g));
  }

  async create(userId: string, dto: CreateGoalRequest): Promise<Goal> {
    if (!PERIODS.includes(dto.period)) {
      throw new BadRequestException('Unsupported goal period.');
    }
    const goal = await this.prisma.goal.create({
      data: { userId, period: dto.period, title: dto.title.slice(0, 200) },
    });
    return this.toView(goal);
  }

  /** Toggle a goal between pending and done. */
  async toggle(userId: string, id: string): Promise<Goal> {
    const goal = await this.requireOwned(userId, id);
    const done = goal.status !== 'done';
    const updated = await this.prisma.goal.update({
      where: { id },
      data: { status: done ? 'done' : 'pending', completedAt: done ? new Date() : null },
    });
    return this.toView(updated);
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.requireOwned(userId, id);
    await this.prisma.goal.delete({ where: { id } });
  }

  private async requireOwned(userId: string, id: string): Promise<GoalRow> {
    const goal = await this.prisma.goal.findUnique({ where: { id } });
    if (!goal || goal.userId !== userId) {
      throw new NotFoundException('Goal not found.');
    }
    return goal;
  }

  private toView(g: GoalRow): Goal {
    return {
      id: g.id,
      period: g.period as GoalPeriod,
      title: g.title,
      status: g.status as Goal['status'],
      createdAt: g.createdAt.toISOString(),
      completedAt: g.completedAt?.toISOString() ?? null,
    };
  }
}
