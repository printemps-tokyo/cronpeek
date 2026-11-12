/**
 * A cron expression as systemd timer calendar events (OnCalendar=, see
 * systemd.time(7)). Fields become lists and `a..b` ranges of the values cron
 * would match, so the result never depends on how a step was written.
 */

import type { CronSpec } from "./parse.js";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Sorted values as a systemd component: `*`, or lists and ranges of three or more. */
function component(set: Set<number>, min: number, max: number, pad: number): string {
  if (set.size === max - min + 1) return "*";
  const values = [...set].sort((a, b) => a - b);
  const parts: string[] = [];
  const fmt = (n: number): string => String(n).padStart(pad, "0");
  for (let i = 0; i < values.length; ) {
    let j = i;
    while (j + 1 < values.length && values[j + 1] === (values[j] as number) + 1) j++;
    if (j - i >= 2) {
      parts.push(`${fmt(values[i] as number)}..${fmt(values[j] as number)}`);
    } else {
      for (let k = i; k <= j; k++) parts.push(fmt(values[k] as number));
    }
    i = j + 1;
  }
  return parts.join(",");
}

/** Cron weekdays (0 = Sunday) as systemd names, Monday first, with ranges. */
function weekdays(dows: Set<number>): string {
  const mondayFirst = new Set([...dows].map((d) => (d + 6) % 7));
  return component(mondayFirst, 0, 6, 1)
    .split(",")
    .map((p) => p.split("..").map((n) => WEEKDAYS[Number(n)]).join(".."))
    .join(",");
}

/**
 * The OnCalendar= values for `spec`. Cron runs on a day when the day of the
 * month OR the weekday matches (if both are restricted), while systemd
 * requires both, so that case becomes two values; a timer runs at each of
 * its OnCalendar= lines.
 */
export function toSystemdCalendar(spec: CronSpec, timeZone?: string): string[] {
  const time = `${component(spec.hours, 0, 23, 2)}:${component(spec.minutes, 0, 59, 2)}:00`;
  const month = component(spec.months, 1, 12, 2);
  const tz = timeZone ? ` ${timeZone}` : "";
  const byDay = `*-${month}-${component(spec.doms, 1, 31, 2)} ${time}${tz}`;
  const byWeekday = `${weekdays(spec.dows)} *-${month}-* ${time}${tz}`;
  if (spec.domRestricted && spec.dowRestricted) return [byDay, byWeekday];
  if (spec.dowRestricted) return [byWeekday];
  return [byDay];
}
