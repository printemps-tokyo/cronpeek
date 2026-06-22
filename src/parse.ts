/**
 * Parse a 5-field cron expression into resolved value sets.
 *
 * Supports wildcards, steps (e.g. `1-9/2`), ranges (`1-5`), lists (`1,15,30`),
 * month names (JAN-DEC), and weekday names (SUN-SAT, with both `0` and `7`
 * meaning Sunday), plus the common `@daily`-style aliases. Parsing is pure and
 * fully validated, so bad input fails with a clear message instead of producing
 * a wrong schedule.
 */

export interface CronSpec {
  minutes: Set<number>;
  hours: Set<number>;
  doms: Set<number>;
  months: Set<number>;
  /** Weekdays as 0-6 with Sunday = 0 (a `7` in the input is normalized to 0). */
  dows: Set<number>;
  /** Whether day-of-month was restricted (not `*`). */
  domRestricted: boolean;
  /** Whether day-of-week was restricted (not `*`). */
  dowRestricted: boolean;
  raw: { minute: string; hour: string; dom: string; month: string; dow: string };
}

const MONTH_NAMES: Record<string, number> = {
  JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6,
  JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12,
};
const DOW_NAMES: Record<string, number> = {
  SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6,
};

const ALIASES: Record<string, string> = {
  "@yearly": "0 0 1 1 *",
  "@annually": "0 0 1 1 *",
  "@monthly": "0 0 1 * *",
  "@weekly": "0 0 * * 0",
  "@daily": "0 0 * * *",
  "@midnight": "0 0 * * *",
  "@hourly": "0 * * * *",
};

interface FieldConfig {
  min: number;
  max: number;
  names?: Record<string, number>;
  label: string;
}

function resolveToken(token: string, cfg: FieldConfig): number {
  const upper = token.toUpperCase();
  if (cfg.names && upper in cfg.names) {
    return cfg.names[upper] as number;
  }
  if (!/^\d+$/.test(token)) {
    throw new Error(`invalid value "${token}" in ${cfg.label}`);
  }
  return Number(token);
}

/** Parse one cron field into a sorted set of integers. */
export function parseField(raw: string, cfg: FieldConfig): { set: Set<number>; restricted: boolean } {
  const set = new Set<number>();
  for (const part of raw.split(",")) {
    if (part === "") {
      throw new Error(`empty term in ${cfg.label} field "${raw}"`);
    }
    const [rangePart, stepPart] = part.split("/");
    let step = 1;
    if (stepPart !== undefined) {
      if (!/^\d+$/.test(stepPart) || Number(stepPart) === 0) {
        throw new Error(`invalid step "/${stepPart}" in ${cfg.label}`);
      }
      step = Number(stepPart);
    }

    let lo: number;
    let hi: number;
    if (rangePart === "*") {
      lo = cfg.min;
      hi = cfg.max;
    } else if (rangePart!.includes("-")) {
      const [a, b] = rangePart!.split("-");
      lo = resolveToken(a as string, cfg);
      hi = resolveToken(b as string, cfg);
    } else {
      lo = resolveToken(rangePart as string, cfg);
      hi = stepPart !== undefined ? cfg.max : lo;
    }

    if (lo < cfg.min || hi > cfg.max || lo > hi) {
      throw new Error(`value out of range in ${cfg.label}: "${part}" (allowed ${cfg.min}-${cfg.max})`);
    }
    for (let v = lo; v <= hi; v += step) {
      set.add(v === 7 && cfg.label === "day-of-week" ? 0 : v);
    }
  }
  return { set, restricted: raw !== "*" };
}

/** Parse a full cron expression (or an `@alias`) into a {@link CronSpec}. */
export function parseCron(expression: string): CronSpec {
  const trimmed = expression.trim();
  if (trimmed === "") {
    throw new Error("empty cron expression");
  }
  if (trimmed.startsWith("@")) {
    const alias = trimmed.toLowerCase();
    if (alias === "@reboot") {
      throw new Error("'@reboot' runs at startup and has no scheduled time");
    }
    const expanded = ALIASES[alias];
    if (!expanded) {
      throw new Error(`unknown alias "${trimmed}"`);
    }
    return parseCron(expanded);
  }

  const fields = trimmed.split(/\s+/);
  if (fields.length !== 5) {
    throw new Error(
      `expected 5 cron fields (minute hour day month weekday), got ${fields.length}`,
    );
  }
  const [minute, hour, dom, month, dow] = fields as [string, string, string, string, string];

  const minutes = parseField(minute, { min: 0, max: 59, label: "minute" });
  const hours = parseField(hour, { min: 0, max: 23, label: "hour" });
  const doms = parseField(dom, { min: 1, max: 31, label: "day-of-month" });
  const months = parseField(month, { min: 1, max: 12, names: MONTH_NAMES, label: "month" });
  const dows = parseField(dow, { min: 0, max: 7, names: DOW_NAMES, label: "day-of-week" });

  return {
    minutes: minutes.set,
    hours: hours.set,
    doms: doms.set,
    months: months.set,
    dows: dows.set,
    domRestricted: doms.restricted,
    dowRestricted: dows.restricted,
    raw: { minute, hour, dom, month, dow },
  };
}
