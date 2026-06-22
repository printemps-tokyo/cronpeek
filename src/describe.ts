import type { CronSpec } from "./parse.js";

const DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_LABELS = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** One explained field: its raw text and a resolved, human-readable summary. */
export interface FieldExplanation {
  label: string;
  raw: string;
  summary: string;
}

function summarize(raw: string, set: Set<number>, names?: string[]): string {
  if (raw === "*") {
    return "every";
  }
  const values = [...set].sort((a, b) => a - b);
  if (values.length > 16) {
    return `${values.length} values`;
  }
  return values.map((v) => (names && names[v] ? `${v} (${names[v]})` : String(v))).join(", ");
}

/** Explain each field of a parsed cron spec. */
export function describeSpec(spec: CronSpec): FieldExplanation[] {
  return [
    { label: "minute", raw: spec.raw.minute, summary: summarize(spec.raw.minute, spec.minutes) },
    { label: "hour", raw: spec.raw.hour, summary: summarize(spec.raw.hour, spec.hours) },
    { label: "day of month", raw: spec.raw.dom, summary: summarize(spec.raw.dom, spec.doms) },
    { label: "month", raw: spec.raw.month, summary: summarize(spec.raw.month, spec.months, MONTH_LABELS) },
    { label: "day of week", raw: spec.raw.dow, summary: summarize(spec.raw.dow, spec.dows, DOW_LABELS) },
  ];
}

/** Short weekday label (Sun..Sat) for a 0-6 index. */
export function weekdayLabel(dow: number): string {
  return DOW_LABELS[dow] ?? String(dow);
}
