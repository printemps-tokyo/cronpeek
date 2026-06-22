import type { CronSpec } from "./parse.js";

/** Number of days in a given month (1-12), accounting for leap years. */
export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Day of week for a calendar date, 0 = Sunday (timezone-independent). */
export function weekday(year: number, month: number, day: number): number {
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

/**
 * Whether a calendar date satisfies the day rule. Cron's quirk: when BOTH
 * day-of-month and day-of-week are restricted, a date matches if EITHER does;
 * otherwise only the restricted one (if any) applies.
 */
export function dayMatches(spec: CronSpec, year: number, month: number, day: number): boolean {
  const domOk = spec.doms.has(day);
  const dowOk = spec.dows.has(weekday(year, month, day));
  if (spec.domRestricted && spec.dowRestricted) {
    return domOk || dowOk;
  }
  if (spec.domRestricted) {
    return domOk;
  }
  if (spec.dowRestricted) {
    return dowOk;
  }
  return true;
}

/** Whether full wall-clock fields match the spec (minute/hour/month/day). */
export function matches(
  spec: CronSpec,
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
): boolean {
  return (
    spec.minutes.has(minute) &&
    spec.hours.has(hour) &&
    spec.months.has(month) &&
    dayMatches(spec, year, month, day)
  );
}
