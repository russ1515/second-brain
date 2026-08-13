/**
 * Streak arithmetic for the Mentor role ("encourages consistency, keeps
 * streaks").
 *
 * Pure and dependency-free on purpose: streaks are the kind of thing that is
 * quietly wrong at midnight, across timezones, and around the "I haven't
 * studied YET today" case. Keeping the arithmetic pure means it can be tested
 * exhaustively without a clock or a database.
 *
 * Inputs are LOCAL calendar days (`YYYY-MM-DD`) already resolved in the
 * learner's timezone — see journey/local-time.ts.
 */

export interface Streak {
  /** Consecutive active days up to and including today. */
  current: number;
  /** The best run the learner has ever had. */
  longest: number;
  studiedToday: boolean;
  /** Most recent active local day, or null if they never studied. */
  lastActiveDate: string | null;
  /** Total distinct days with any activity. */
  totalActiveDays: number;
}

const DAY_MS = 86_400_000;

/** `YYYY-MM-DD` → epoch day number. Safe because the input is a UTC-anchored
 *  local day string (no DST inside it). */
function dayNumber(date: string): number {
  return Math.round(Date.parse(`${date}T00:00:00Z`) / DAY_MS);
}

function toDateString(day: number): string {
  return new Date(day * DAY_MS).toISOString().slice(0, 10);
}

/**
 * @param activeDates local `YYYY-MM-DD` days with any study activity (any order,
 *   duplicates fine)
 * @param today the learner's local day right now
 */
export function computeStreak(activeDates: string[], today: string): Streak {
  const days = [...new Set(activeDates)].map(dayNumber).sort((a, b) => a - b);

  if (days.length === 0) {
    return {
      current: 0,
      longest: 0,
      studiedToday: false,
      lastActiveDate: null,
      totalActiveDays: 0,
    };
  }

  // Longest run anywhere in history.
  let longest = 1;
  let run = 1;
  for (let i = 1; i < days.length; i++) {
    run = days[i] === days[i - 1] + 1 ? run + 1 : 1;
    if (run > longest) longest = run;
  }

  const todayNum = dayNumber(today);
  const last = days[days.length - 1];
  const studiedToday = days.includes(todayNum);

  // Activity can land in the "future" — a learner changes their profile
  // timezone, or clocks skew. Such days cannot belong to a run ending today, and
  // letting them anchor the walk would silently report a broken streak to
  // someone whose streak is fine. Count the current run over past days only.
  const upToToday = days.filter((d) => d <= todayNum);
  const lastPast = upToToday[upToToday.length - 1];

  // A streak survives until the day is over: if they studied yesterday but not
  // yet today, the streak is still alive — killing it at midnight would punish
  // someone who simply hasn't got to it yet. Anything older is broken.
  let current = 0;
  if (lastPast === todayNum || lastPast === todayNum - 1) {
    current = 1;
    for (let i = upToToday.length - 2; i >= 0; i--) {
      if (upToToday[i] !== upToToday[i + 1] - 1) break;
      current++;
    }
  }

  return {
    current,
    longest,
    studiedToday,
    lastActiveDate: toDateString(last),
    totalActiveDays: days.length,
  };
}
