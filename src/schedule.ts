import type { CronSpec } from "./parse.js";
import { dayMatches, daysInMonth } from "./match.js";
import { zonedParts, zonedToInstant, type WallClock } from "./zoned.js";

/** A computed run: its wall-clock fields plus the absolute instant (epoch ms). */
export interface Run extends WallClock {
  ms: number;
}

/** Advance the wall-clock by one day, rolling over month and year. */
function nextDay(w: WallClock): void {
  w.day += 1;
  if (w.day > daysInMonth(w.year, w.month)) {
    w.day = 1;
    w.month += 1;
    if (w.month > 12) {
      w.month = 1;
      w.year += 1;
    }
  }
}

/**
 * The next `count` run instants strictly after `fromMs`, in `timeZone`. Stops
 * early (returning fewer) if no further run exists within `maxYears` — for
 * example an impossible date like Feb 30.
 */
export function nextRuns(
  spec: CronSpec,
  fromMs: number,
  count: number,
  timeZone: string,
  maxYears = 5,
): Run[] {
  const runs: Run[] = [];
  // Start at the first whole minute strictly after `fromMs`.
  const startMs = (Math.floor(fromMs / 60000) + 1) * 60000;
  const w = zonedParts(new Date(startMs), timeZone);
  const limitYear = zonedParts(new Date(fromMs), timeZone).year + maxYears;

  let guard = 0;
  while (runs.length < count && w.year <= limitYear) {
    if (++guard > 5_000_000) {
      break;
    }
    if (!spec.months.has(w.month)) {
      w.month += 1;
      if (w.month > 12) {
        w.month = 1;
        w.year += 1;
      }
      w.day = 1;
      w.hour = 0;
      w.minute = 0;
      continue;
    }
    if (!dayMatches(spec, w.year, w.month, w.day)) {
      nextDay(w);
      w.hour = 0;
      w.minute = 0;
      continue;
    }
    if (!spec.hours.has(w.hour)) {
      w.hour += 1;
      if (w.hour > 23) {
        w.hour = 0;
        nextDay(w);
      }
      w.minute = 0;
      continue;
    }
    if (!spec.minutes.has(w.minute)) {
      w.minute += 1;
      if (w.minute > 59) {
        w.minute = 0;
        w.hour += 1;
        if (w.hour > 23) {
          w.hour = 0;
          nextDay(w);
        }
      }
      continue;
    }

    // All fields match: record the run, then step one minute to find the next.
    runs.push({ ...w, ms: zonedToInstant(timeZone, w).getTime() });
    w.minute += 1;
    if (w.minute > 59) {
      w.minute = 0;
      w.hour += 1;
      if (w.hour > 23) {
        w.hour = 0;
        nextDay(w);
      }
    }
  }
  return runs;
}
