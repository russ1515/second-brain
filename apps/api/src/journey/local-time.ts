import type { PlanSlot } from '@second-brain/shared';

/**
 * Local-day arithmetic for the daily journey.
 *
 * Pure and dependency-free on purpose: "morning" is a property of the LEARNER's
 * clock, not the server's, and this is the piece most likely to be quietly wrong
 * (DST, day boundaries, half-hour offsets). Keeping it pure means it can be
 * tested exhaustively without a database or a running clock.
 *
 * Uses Intl (Node ships full ICU) rather than a date library.
 */

/** Hour at which each slot fires, in the learner's local time. */
const SLOT_HOURS: Record<number, PlanSlot> = {
  7: 'morning',
  14: 'afternoon',
  19: 'evening',
  21: 'night',
};

/** The slot a given local hour belongs to, or null if no nudge is due then. */
export function slotForLocalHour(hour: number): PlanSlot | null {
  return SLOT_HOURS[hour] ?? null;
}

export function isValidTimezone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

/** Fall back to UTC rather than throwing: a bad stored timezone must not stop a
 *  learner's whole journey from being planned. */
function safeZone(timezone: string): string {
  return isValidTimezone(timezone) ? timezone : 'UTC';
}

interface LocalParts {
  year: number;
  month: number;
  day: number;
  hour: number;
}

function partsIn(instant: Date, timezone: string): LocalParts {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: safeZone(timezone),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(instant).map((p) => [p.type, p.value]),
  );
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
  };
}

/** The learner's local hour (0-23) at `instant`. */
export function localHour(instant: Date, timezone: string): number {
  return partsIn(instant, timezone).hour;
}

/**
 * The learner's local calendar day at `instant`, as a UTC-midnight Date.
 *
 * Postgres `date` columns carry no zone, and Prisma maps them through UTC — so
 * the local day must be pinned to UTC midnight or a learner in Tokyo would have
 * their plan filed under the previous day.
 */
export function localDate(instant: Date, timezone: string): Date {
  const { year, month, day } = partsIn(instant, timezone);
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
}

/** `YYYY-MM-DD` for the learner's local day — the wire format. */
export function localDateString(instant: Date, timezone: string): string {
  return localDate(instant, timezone).toISOString().slice(0, 10);
}
