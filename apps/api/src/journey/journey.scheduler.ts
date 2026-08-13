import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notifications/notification.service';
import { MentorService } from '../mentor/mentor.service';
import { DailyPlanService } from './daily-plan.service';
import { localDate, localHour, slotForLocalHour } from './local-time';

/** How many learners one tick handles per batch. */
const BATCH = 200;

/** Registry name for the hourly sweep. */
export const JOURNEY_CRON = 'journey-hourly';

export interface TickResult {
  /** Learners whose local hour matched a slot. */
  matched: number;
  /** Nudges actually delivered (deduped ones are not counted). */
  sent: number;
}

/**
 * Drives the daily journey on the clock.
 *
 * The cron itself does nothing but call `tick(now)`. Every decision lives in
 * `tick` and in the pure helpers in local-time.ts, which is what makes this
 * verifiable: a test can drive `tick` at any instant with the real database and
 * real transports, instead of waiting for 7am to come around.
 */
@Injectable()
export class JourneyScheduler {
  private readonly logger = new Logger(JourneyScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly plans: DailyPlanService,
    private readonly notifications: NotificationService,
    private readonly mentor: MentorService,
  ) {}

  /** Runs hourly; every learner's slots are local, so an hourly sweep is enough
   *  to catch each timezone as it reaches 07/14/19/21. Named so it can be found
   *  in SchedulerRegistry (and asserted on) rather than getting a random UUID. */
  @Cron(CronExpression.EVERY_HOUR, { name: JOURNEY_CRON })
  async hourly(): Promise<void> {
    const result = await this.tick(new Date());
    if (result.matched > 0) {
      this.logger.log(
        `Journey tick: ${result.matched} learner(s) in a slot, ${result.sent} nudge(s) sent.`,
      );
    }
  }

  /**
   * One sweep at `now`: for each learner whose LOCAL hour lands on a slot,
   * make sure the day is planned and nudge them about what is outstanding.
   */
  async tick(now: Date): Promise<TickResult> {
    let matched = 0;
    let sent = 0;
    let cursor: string | undefined;

    for (;;) {
      const users = await this.prisma.user.findMany({
        take: BATCH,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        orderBy: { id: 'asc' },
        select: { id: true, profile: { select: { timezone: true } } },
      });
      if (users.length === 0) break;
      cursor = users[users.length - 1].id;

      for (const user of users) {
        const timezone = user.profile?.timezone ?? 'UTC';
        const slot = slotForLocalHour(localHour(now, timezone));
        if (!slot) continue;
        matched++;
        try {
          if (await this.nudge(user.id, timezone, now, slot)) sent++;
        } catch (error) {
          // One learner's failure must not stop the sweep.
          this.logger.error(
            `Journey tick failed for ${user.id}: ${(error as Error).message}`,
          );
        }
      }

      if (users.length < BATCH) break;
    }

    return { matched, sent };
  }

  private async nudge(
    userId: string,
    timezone: string,
    now: Date,
    slot: ReturnType<typeof slotForLocalHour> & string,
  ): Promise<boolean> {
    const date = localDate(now, timezone);
    // Adapt, don't merely ensure: work that appeared since the last slot must
    // make it into today's plan rather than waiting for tomorrow.
    const plan = await this.plans.refreshForDay(userId, timezone, date);
    const outstanding = this.plans.itemsForSlot(plan, slot);
    return this.notifications.sendSlotNudge(
      userId,
      date,
      slot,
      outstanding.map((i) => i.title),
      await this.streakLine(userId, now),
    );
  }

  /** The Mentor's voice on the nudge ("encourages consistency"). Best-effort and
   *  only when there is something true to say — a fabricated or absent streak
   *  must never block the nudge itself. */
  private async streakLine(
    userId: string,
    now: Date,
  ): Promise<string | undefined> {
    try {
      const streak = await this.mentor.streak(userId, now);
      if (streak.current < 2) return undefined;
      return streak.studiedToday
        ? `${streak.current}-day streak — today is already in the bag.`
        : `${streak.current}-day streak on the line — don't break it today.`;
    } catch (error) {
      this.logger.warn(
        `Streak line failed for ${userId}: ${(error as Error).message}`,
      );
      return undefined;
    }
  }
}
