import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Exam as ExamRow } from '@prisma/client';
import type {
  CreateExamRequest,
  ExamPriority,
  ExamView,
} from '@second-brain/shared';
import { PrismaService } from '../prisma/prisma.service';
import { MasteryService } from '../concepts/mastery.service';

const PRIORITIES: ExamPriority[] = ['low', 'medium', 'high'];
const DAY_MS = 86_400_000;

/**
 * Exams (Sprint 5): subject, date, priority. The "preparation level" is NOT
 * stored — it's DERIVED at read time from the learner's mastery of the concept
 * matching the exam subject (engine communication: Exams ← ConceptMastery).
 */
@Injectable()
export class ExamsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mastery: MasteryService,
  ) {}

  /** Upcoming exams, soonest first, each with a derived preparation level. */
  async list(userId: string): Promise<ExamView[]> {
    const now = new Date();
    const [exams, twin] = await Promise.all([
      this.prisma.exam.findMany({ where: { userId }, orderBy: { date: 'asc' } }),
      this.mastery.twin(userId).catch(() => null),
    ]);

    return exams.map((e) => {
      const days = Math.ceil((this.startOfDay(e.date).getTime() - this.startOfDay(now).getTime()) / DAY_MS);
      return {
        id: e.id,
        subject: e.subject,
        date: this.dayKey(e.date),
        priority: e.priority as ExamPriority,
        daysUntil: days,
        preparation: this.preparation(e, twin),
      };
    });
  }

  async create(userId: string, dto: CreateExamRequest): Promise<ExamView> {
    if (!PRIORITIES.includes(dto.priority)) {
      throw new BadRequestException('Unsupported priority.');
    }
    const date = new Date(`${dto.date}T12:00:00`);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('Invalid date.');
    }
    // Link a concept matching the subject, so preparation can be derived.
    const concept = await this.prisma.concept.findFirst({
      where: { userId, name: { equals: dto.subject.trim(), mode: 'insensitive' } },
      select: { id: true },
    });
    const exam = await this.prisma.exam.create({
      data: {
        userId,
        subject: dto.subject.slice(0, 200),
        date,
        priority: dto.priority,
        conceptId: concept?.id ?? null,
      },
    });
    const twin = await this.mastery.twin(userId).catch(() => null);
    const days = Math.ceil((this.startOfDay(date).getTime() - this.startOfDay(new Date()).getTime()) / DAY_MS);
    return {
      id: exam.id,
      subject: exam.subject,
      date: this.dayKey(exam.date),
      priority: exam.priority as ExamPriority,
      daysUntil: days,
      preparation: this.preparation(exam, twin),
    };
  }

  async remove(userId: string, id: string): Promise<void> {
    const exam = await this.prisma.exam.findUnique({ where: { id } });
    if (!exam || exam.userId !== userId) {
      throw new NotFoundException('Exam not found.');
    }
    await this.prisma.exam.delete({ where: { id } });
  }

  // ── internals ─────────────────────────────────────────────────────────────

  /** Preparation % from mastery of the linked/matching concept, else null. */
  private preparation(
    exam: ExamRow,
    twin: Awaited<ReturnType<MasteryService['twin']>> | null,
  ): number | null {
    if (!twin) return null;
    const byId = exam.conceptId
      ? twin.concepts.find((c) => c.conceptId === exam.conceptId)
      : undefined;
    const byName =
      byId ??
      twin.concepts.find(
        (c) => c.name.toLowerCase() === exam.subject.trim().toLowerCase(),
      );
    if (!byName || byName.mastery === null) return null;
    return Math.round(byName.mastery * 100);
  }

  private startOfDay(d: Date): Date {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  private dayKey(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
}
