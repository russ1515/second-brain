import { Injectable } from '@nestjs/common';
import type { HealthState } from '@second-brain/shared';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PrismaHealthIndicator {
  constructor(private readonly prisma: PrismaService) {}

  async check(): Promise<{ status: HealthState; message?: string }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'up' };
    } catch {
      // Health is public: driver messages can contain hostnames, connection
      // strings, or other operational details. The component status is enough.
      return { status: 'down' };
    }
  }
}
