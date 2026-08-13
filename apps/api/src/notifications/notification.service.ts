import { Inject, Injectable, Logger } from '@nestjs/common';
import type { PlanSlot } from '@second-brain/shared';
import { PrismaService } from '../prisma/prisma.service';
import { NOTIFIER } from './notification.constants';
import type { Notifier } from './notifier.interface';

/** Nudge copy per slot, mirroring the Educational Engine's daily rhythm. */
const SLOT_COPY: Record<PlanSlot, { title: string; lead: string }> = {
  morning: {
    title: 'Your morning review is ready',
    lead: 'Start the day by bringing yesterday back:',
  },
  afternoon: {
    title: "Today's lesson is waiting",
    lead: 'Time for something new:',
  },
  evening: {
    title: 'Time to practise',
    lead: 'Practice beats re-reading:',
  },
  night: {
    title: 'One quick pass before sleep',
    lead: 'A short revision locks the day in:',
  },
};

/**
 * Sends the daily journey's nudges.
 *
 * Dedup is enforced by the database, not by bookkeeping in memory: the
 * `Notification` row's unique (userId, date, slot) key means a learner gets at
 * most one nudge per slot per local day even if the scheduler ticks repeatedly,
 * runs on several instances, or is replayed.
 */
@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(NOTIFIER) private readonly notifier: Notifier,
  ) {}

  get activeChannel(): string {
    return this.notifier.name;
  }

  /**
   * Send the slot's nudge once. Returns true if it was sent, false if it had
   * already gone out for this learner/day/slot.
   */
  async sendSlotNudge(
    userId: string,
    date: Date,
    slot: PlanSlot,
    lines: string[],
    /** Optional Mentor closing line (e.g. the streak). Never a reason to send. */
    mentorLine?: string,
  ): Promise<boolean> {
    if (lines.length === 0) {
      return false; // nothing outstanding — don't nag.
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    if (!user) return false;

    const copy = SLOT_COPY[slot];
    const body = [
      copy.lead,
      ...lines.map((l) => `• ${l}`),
      ...(mentorLine ? ['', mentorLine] : []),
    ].join('\n');

    // Claim the slot FIRST: on a unique-key clash another tick already sent it,
    // so we must not deliver a duplicate.
    try {
      await this.prisma.notification.create({
        data: {
          userId,
          date,
          slot,
          channel: this.notifier.name,
          title: copy.title,
          body,
        },
      });
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') {
        return false;
      }
      throw error;
    }

    try {
      await this.notifier.send({
        email: user.email,
        title: copy.title,
        body,
      });
      return true;
    } catch (error) {
      // Delivery failed after the claim: drop the claim so a later tick can
      // retry, rather than silently swallowing the learner's nudge.
      await this.prisma.notification
        .delete({ where: { userId_date_slot: { userId, date, slot } } })
        .catch(() => undefined);
      this.logger.error(
        `Nudge delivery failed for ${userId} (${slot}): ${(error as Error).message}`,
      );
      return false;
    }
  }
}
