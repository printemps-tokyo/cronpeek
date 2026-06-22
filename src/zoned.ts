/**
 * Convert between an absolute instant and wall-clock fields in a named IANA
 * timezone, using only the built-in `Intl` API (no dependencies). Cron
 * schedules are wall-clock, so the scheduler works in local fields and uses
 * these helpers to anchor results to real instants, including across DST.
 */

export interface WallClock {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

/** The wall-clock fields of `instant` as seen in `timeZone`. */
export function zonedParts(instant: Date, timeZone: string): WallClock {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const parts: Record<string, string> = {};
  for (const p of dtf.formatToParts(instant)) {
    if (p.type !== "literal") {
      parts[p.type] = p.value;
    }
  }
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
  };
}

/** The timezone's offset (ms) at `instant`: wall-clock-as-UTC minus instant. */
function offsetMs(instant: Date, timeZone: string): number {
  const w = zonedParts(instant, timeZone);
  const asUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute);
  return asUtc - instant.getTime();
}

/**
 * The instant whose wall-clock in `timeZone` is the given fields. Resolves the
 * offset twice so a DST transition between the guess and the result is handled.
 */
export function zonedToInstant(timeZone: string, w: WallClock): Date {
  const guess = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute);
  const off1 = offsetMs(new Date(guess), timeZone);
  let instant = guess - off1;
  const off2 = offsetMs(new Date(instant), timeZone);
  if (off2 !== off1) {
    instant = guess - off2;
  }
  return new Date(instant);
}

/** Validate an IANA timezone name, throwing a clear error if unknown. */
export function assertTimeZone(timeZone: string): void {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
  } catch {
    throw new Error(`unknown timezone "${timeZone}"`);
  }
}

/** The host's current IANA timezone (e.g. "Asia/Tokyo"). */
export function systemTimeZone(): string {
  return new Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}
